import ExpoModulesCore
import UIKit

/**
 * Registers for VoIP pushes at launch, before any JS runs, so a push that
 * launched the app in the background is delivered and reported to CallKit.
 */
public class CallPilotAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    CallManager.shared.start()
    return true
  }
}
