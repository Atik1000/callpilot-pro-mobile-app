import AVFoundation
import CallKit
import Foundation
import PushKit
import UIKit
import WebRTC

/**
 * CallPilot server push mode on iOS.
 *
 * PushKit delivers the backend's `incoming_call` VoIP push (call_uuid,
 * organization_uid, sent_at, expires_at; no caller details). Apple requires
 * every VoIP push to be reported to CallKit before the callback returns, so it
 * is reported immediately with `call_uuid` as the CallKit UUID — before any
 * network, token refresh or JS work. Invalid/expired/signed-out pushes are
 * reported and ended at once.
 *
 * The JS side then fetches the call state, and on Answer asks the backend to
 * connect the SDK leg to this device. CallKit owns the audio session; WebRTC
 * is told when it is activated.
 */
final class CallManager: NSObject, PKPushRegistryDelegate, CXProviderDelegate {
  static let shared = CallManager()

  private struct CallInfo {
    var answered = false
    var connected = false
    /** Ended by the app itself: don't echo CallKit's end action back to JS. */
    var endingFromApp = false
    var expiry: Timer?
  }

  private var registry: PKPushRegistry?
  private let provider: CXProvider
  private let controller = CXCallController()
  private var calls: [UUID: CallInfo] = [:]
  private var tokenWaiters: [(String?) -> Void] = []
  private(set) var voipToken: String?

  /** JS event sink; events are buffered until JS starts listening. */
  var emit: ((String, [String: Any]) -> Void)? {
    didSet { flush() }
  }
  private var buffered: [(String, [String: Any])] = []

  private static let pushEnabledKey = "callpilot.pushEnabled"
  /** True while signed in with server push: VoIP pushes ring this phone. */
  static var pushEnabled: Bool {
    get { UserDefaults.standard.bool(forKey: pushEnabledKey) }
    set { UserDefaults.standard.set(newValue, forKey: pushEnabledKey) }
  }

  private override init() {
    let config = CXProviderConfiguration()
    config.supportsVideo = false
    config.maximumCallGroups = 1
    config.maximumCallsPerCallGroup = 1
    config.supportedHandleTypes = [.phoneNumber, .generic]
    config.includesCallsInRecents = true
    provider = CXProvider(configuration: config)
    super.init()
    provider.setDelegate(self, queue: nil)
  }

  /** Called at app launch (also when iOS launches the app for a VoIP push). */
  func start() {
    DispatchQueue.main.async {
      guard self.registry == nil else { return }
      let registry = PKPushRegistry(queue: .main)
      registry.delegate = self
      registry.desiredPushTypes = [.voIP]
      self.registry = registry
    }
  }

  // MARK: JS-facing API

  /** Resolves the PushKit token, waiting briefly for iOS to issue it. */
  func whenVoipToken(timeout: TimeInterval, _ done: @escaping (String?) -> Void) {
    DispatchQueue.main.async {
      self.start()
      if let token = self.voipToken { return done(token) }
      var finished = false
      let finish: (String?) -> Void = { token in
        if finished { return }
        finished = true
        done(token)
      }
      self.tokenWaiters.append(finish)
      DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { finish(self.voipToken) }
    }
  }

  func updateCall(_ uuid: UUID, name: String, number: String, whatsapp: Bool) {
    guard calls[uuid] != nil else { return }
    let update = CXCallUpdate()
    if !number.isEmpty {
      update.remoteHandle = CXHandle(type: .phoneNumber, value: number)
    }
    let label = name.isEmpty ? (number.isEmpty ? "Incoming call" : number) : name
    update.localizedCallerName = whatsapp ? "\(label) (WhatsApp)" : label
    provider.reportCall(with: uuid, updated: update)
  }

  /** The user answered in the app's own screen: keep CallKit in step. */
  func answerFromApp(_ uuid: UUID) {
    guard let info = calls[uuid], !info.answered else { return }
    controller.request(CXTransaction(action: CXAnswerCallAction(call: uuid))) { _ in }
  }

  /** SDK media connected on this handset: the ringing deadline no longer applies. */
  func callConnected(_ uuid: UUID) {
    guard var info = calls[uuid] else { return }
    info.expiry?.invalidate()
    info.expiry = nil
    info.connected = true
    calls[uuid] = info
    // Incoming calls are shown as connected once the answer action is fulfilled.
  }

  /**
   * Ends the native call screen. `local`: the user hung up/declined in the app
   * (goes through CXEndCallAction so iOS records it); otherwise a reason the
   * server or SDK reported.
   */
  func endCall(_ uuid: UUID, reason: String) {
    guard var info = calls[uuid] else { return }
    info.expiry?.invalidate()
    info.expiry = nil
    if reason == "local" {
      info.endingFromApp = true
      calls[uuid] = info
      controller.request(CXTransaction(action: CXEndCallAction(call: uuid))) { [weak self] error in
        if error != nil { self?.finish(uuid, reason: .remoteEnded) }
      }
      return
    }
    let mapped: CXCallEndedReason
    switch reason {
    case "unanswered", "expired": mapped = .unanswered
    case "answeredElsewhere": mapped = .answeredElsewhere
    case "declinedElsewhere": mapped = .declinedElsewhere
    case "failed": mapped = .failed
    default: mapped = .remoteEnded
    }
    finish(uuid, reason: mapped)
  }

  private func finish(_ uuid: UUID, reason: CXCallEndedReason) {
    calls[uuid]?.expiry?.invalidate()
    calls[uuid] = nil
    provider.reportCall(with: uuid, endedAt: Date(), reason: reason)
  }

  // MARK: PushKit

  func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
    let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
    voipToken = token
    let waiters = tokenWaiters
    tokenWaiters = []
    waiters.forEach { $0(token) }
    send("onVoipToken", ["token": token])
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    voipToken = nil
    send("onVoipToken", ["token": ""])
  }

  func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    let data = payload.dictionaryPayload
    let uuidString = data["call_uuid"] as? String
    let parsed = uuidString.flatMap { UUID(uuidString: $0) }
    let uuid = parsed ?? UUID()
    let expiresAt = Self.parseDate(data["expires_at"] as? String)
    let duplicate = parsed != nil && calls[uuid] != nil
    let valid = parsed != nil
      && (data["kind"] as? String ?? "incoming_call") == "incoming_call"
      && Self.pushEnabled
      && (expiresAt.map { $0 > Date() } ?? true)

    let update = CXCallUpdate()
    update.remoteHandle = CXHandle(type: .generic, value: "CallPilot")
    update.localizedCallerName = "Incoming call"
    update.hasVideo = false
    update.supportsHolding = false
    update.supportsGrouping = false
    update.supportsUngrouping = false
    update.supportsDTMF = true

    // Always report first (iOS terminates apps that don't), then decide.
    provider.reportNewIncomingCall(with: uuid, update: update) { [weak self] error in
      defer { completion() }
      guard let self else { return }
      if error != nil || duplicate { return } // DND/blocked, or a retried delivery
      if !valid {
        self.provider.reportCall(with: uuid, endedAt: Date(), reason: .failed)
        return
      }
      var info = CallInfo()
      let remaining = expiresAt.map { $0.timeIntervalSinceNow } ?? 25
      info.expiry = Timer.scheduledTimer(withTimeInterval: max(1, remaining), repeats: false) { [weak self] _ in
        guard let self, let current = self.calls[uuid], !current.connected else { return }
        self.finish(uuid, reason: .unanswered)
        self.send("onCallAction", ["action": "timeout", "call_uuid": uuidString ?? ""])
      }
      self.calls[uuid] = info
      var push: [String: Any] = [:]
      for key in ["call_uuid", "organization_uid", "sent_at", "expires_at"] {
        if let value = data[key] as? String { push[key] = value }
      }
      if let json = try? JSONSerialization.data(withJSONObject: push),
         let text = String(data: json, encoding: .utf8) {
        self.send("onCallPush", ["push": text])
      }
    }
  }

  // MARK: CallKit

  func providerDidReset(_ provider: CXProvider) {
    for uuid in calls.keys {
      send("onCallAction", ["action": "end", "call_uuid": uuid.uuidString.lowercased()])
    }
    calls.removeAll()
  }

  func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
    guard var info = calls[action.callUUID] else { return action.fail() }
    info.answered = true
    calls[action.callUUID] = info
    configureAudioSession()
    send("onCallAction", ["action": "answer", "call_uuid": action.callUUID.uuidString.lowercased()])
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
    let info = calls[action.callUUID]
    calls[action.callUUID]?.expiry?.invalidate()
    calls[action.callUUID] = nil
    if let info, !info.endingFromApp {
      send("onCallAction", ["action": "end", "call_uuid": action.callUUID.uuidString.lowercased()])
    }
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
    send("onCallAction", [
      "action": "mute",
      "call_uuid": action.callUUID.uuidString.lowercased(),
      "muted": action.isMuted,
    ])
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXPlayDTMFCallAction) {
    send("onCallAction", [
      "action": "dtmf",
      "call_uuid": action.callUUID.uuidString.lowercased(),
      "digits": action.digits,
    ])
    action.fulfill()
  }

  func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
    RTCAudioSession.sharedInstance().audioSessionDidActivate(audioSession)
  }

  func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
    RTCAudioSession.sharedInstance().audioSessionDidDeactivate(audioSession)
  }

  private func configureAudioSession() {
    let session = RTCAudioSession.sharedInstance()
    session.lockForConfiguration()
    defer { session.unlockForConfiguration() }
    try? session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetoothHFP, .allowBluetoothA2DP])
  }

  // MARK: helpers

  private func send(_ name: String, _ body: [String: Any]) {
    DispatchQueue.main.async {
      if let emit = self.emit {
        emit(name, body)
      } else {
        self.buffered.append((name, body))
      }
    }
  }

  private func flush() {
    guard let emit else { return }
    let pending = buffered
    buffered = []
    pending.forEach { emit($0.0, $0.1) }
  }

  /** ISO-8601 with optional fractional seconds. */
  static func parseDate(_ value: String?) -> Date? {
    guard let value, !value.isEmpty else { return nil }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: value) { return date }
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: value)
  }

  /**
   * APNs environment of this build, from the signed provisioning profile:
   * development profiles push via sandbox; App Store/TestFlight builds have no
   * embedded profile and use production.
   */
  static func apnsEnvironment() -> String {
    #if targetEnvironment(simulator)
      return "sandbox"
    #else
      guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
            let data = try? Data(contentsOf: url),
            let text = String(data: data, encoding: .isoLatin1) else {
        return "production"
      }
      if let range = text.range(of: "<key>aps-environment</key>") {
        let rest = text[range.upperBound...]
        if let start = rest.range(of: "<string>"), let end = rest.range(of: "</string>") {
          return rest[start.upperBound..<end.lowerBound] == "development" ? "sandbox" : "production"
        }
      }
      return "production"
    #endif
  }
}
