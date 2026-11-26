import ExpoModulesCore

/**
 * iOS half of the CallPilotKeepAlive module: PushKit token + CallKit control
 * for CallPilot server push mode. The Android-only keep-alive functions are not
 * defined here; the JS wrapper treats them as no-ops on iOS.
 */
public class CallPilotKeepAliveModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CallPilotKeepAlive")

    Events("onCallPush", "onCallAction", "onVoipToken", "onNotificationOpened")

    OnStartObserving {
      CallManager.shared.emit = { [weak self] name, body in
        self?.sendEvent(name, body)
      }
    }

    OnStopObserving {
      CallManager.shared.emit = nil
    }

    /** On: VoIP pushes ring this phone. Off (signed out): they are ended at once. */
    Function("setPushMode") { (on: Bool) in
      CallManager.pushEnabled = on
    }

    /** PushKit VoIP token (hex), or null if iOS has not issued one. */
    AsyncFunction("getPushToken") { (promise: Promise) in
      CallManager.shared.whenVoipToken(timeout: 5) { token in promise.resolve(token) }
    }

    /** "sandbox" or "production", matching the signed build's APNs environment. */
    Function("getApnsEnvironment") { () -> String in
      CallManager.apnsEnvironment()
    }

    Function("updateCall") { (uuid: String, name: String, number: String, whatsapp: Bool) in
      guard let id = UUID(uuidString: uuid) else { return }
      DispatchQueue.main.async { CallManager.shared.updateCall(id, name: name, number: number, whatsapp: whatsapp) }
    }

    Function("answerCall") { (uuid: String) in
      guard let id = UUID(uuidString: uuid) else { return }
      DispatchQueue.main.async { CallManager.shared.answerFromApp(id) }
    }

    Function("callConnected") { (uuid: String) in
      guard let id = UUID(uuidString: uuid) else { return }
      DispatchQueue.main.async { CallManager.shared.callConnected(id) }
    }

    Function("endCall") { (uuid: String, reason: String) in
      guard let id = UUID(uuidString: uuid) else { return }
      DispatchQueue.main.async { CallManager.shared.endCall(id, reason: reason) }
    }

    /** iOS message/alert taps arrive through expo-notifications instead. */
    Function("getLaunchNotification") { () -> [String: String]? in
      nil
    }
  }
}
