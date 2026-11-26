# Android incoming calls after Clear all

The Android app now uses CallPilot's server-push flow. A native Firebase receiver
shows the incoming call without waiting for a React screen or permanent SIP
connection. After Answer, the app restores its signed-in handset session,
registers the Telnyx SDK, requests that invitation's agent leg and accepts it
only when both CallPilot correlation headers match.

This requires a **new native APK**. Expo Go and a JavaScript-only update cannot
install the new Android receiver, Telecom service or incoming-call activity.
The existing outgoing-call authorization and web/Expo Go foreground preview
remain separate. This change implements Android cold-start receiving; it does
not add iOS PushKit/CallKit to this mobile project.

## 1. Add the Android Firebase client file

1. Open the Firebase project used by your CallPilot backend's FCM service account.
2. Open **Project settings → General → Your apps**.
3. Select or register an **Android** app with package **`pro.callpilot.app`**.
   This is the package configured in this project's `app.json`.
4. Download its **`google-services.json`** and put it in the mobile project root,
   beside `package.json`. The file is ignored by Git.
5. For cloud builds, open the Expo project's **Environment variables** and add
   `GOOGLE_SERVICES_JSON` as a **file** variable containing that downloaded file,
   for the **preview** environment. `app.config.js` accepts the build runner's
   resulting file path. The Git-ignored local file is not uploaded by default.
   Add the same file variable to the production environment when releasing.
   See [Expo file environment variables](https://docs.expo.dev/eas/environment-variables/manage/).

Use the Android client configuration file here. Do not put a Firebase service
account private key, Meta token, Telnyx API key or backend signing key in this app.
No real Firebase configuration is supplied by this code change.

## 2. Confirm the existing backend settings

The actual backend environment must use:

```dotenv
CALLPILOT_ANDROID_PACKAGE=pro.callpilot.app
CALLPILOT_FCM_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
CALLPILOT_FCM_SERVICE_ACCOUNT_JSON='YOUR_COMPLETE_BACKEND_SERVICE_ACCOUNT_JSON'
```

The Android package is **not** the Firebase App ID beginning `1:...:android:...`.
The project ID and service account must belong to the project used in step 1.
Preserve the backend's existing encryption key and Telnyx voice configuration.
Restart Django and Celery after backend environment changes. Celery must process
`send_native_push`; keep Beat running for expiry/recovery workflows.

The handset's CallPilot user must have an enabled extension in the number's ring
group and be available for calls during its configured business hours. The
backend retains the caller while the handset wakes; the invitation has a short
ring deadline. This native change does not change provider routing or voicemail.

## 3. Build and install the updated APK

Use Node 24 for the checks below (the regression tests were verified with it).
From the mobile project:

```bash
cd /home/osman/Desktop/AyshaSoft/callpilot-pro-mobile-app
npm ci
npm run typecheck
npm run lint
npm test
npx eas-cli@latest build --platform android --profile preview
```

The `preview` profile produces an installable internal APK with its JavaScript
bundle included. Sign in to your existing Expo account and link the project if
the build CLI asks. Building/uploading is performed by you; this source change
does not publish an app or start a cloud build automatically.

Install the new APK on the Redmi. A locally generated native build is another
option when Android Studio/SDK are installed:

```bash
npx expo run:android
```

Configure native code through the Expo config/plugin and local `modules/`
source. Do not manually maintain the generated `android/` directory.

## 4. Register this phone once

1. Open the updated app. **Sign out once, then sign in again.**
2. Complete the emailed verification code. The backend requires emailed OTP for
   handset-bound sessions. If the account signs in without a code, enable its
   existing two-step sign-in in CallPilot and sign in again.
3. Allow CallPilot notifications and microphone access.
4. Open **Settings → Calls → Incoming calls while closed**. It must say that the
   phone is registered for incoming call notifications. If it is not ready,
   use **Check incoming call setup** and read the displayed error.

The app registers the **native FCM token**, not an Expo push token. It updates
token rotations and associates the registration with the exact signed-in device
and business. Normal screen removal is not logout; sign-out clears native state
and requests server-side handset revocation.

## 5. Test the real call path

Call the configured business number from another phone in each state:

| Redmi state | Expected result |
| --- | --- |
| App open | One invitation, authenticated caller details in the app, Answer connects audio. |
| Home pressed | Native incoming call notification appears. |
| Screen locked | Incoming call notification/native screen according to Android permissions and settings. |
| App removed with Clear all | FCM can start the native receiver and present the call without an idle SIP service, subject to the phone's restrictions. |
| Caller ends before Answer | Authenticated state rejects an obsolete Answer; local ring expiry removes an unanswered invitation. |
| Answered call passes the original ring deadline | Connected audio continues; the ringing timer does not hang up the established call. |
| Signed out/revoked phone | No new native call presentation for that old session. |

Check mute, speaker, hold, End, ordinary outgoing calls and call history too.
Test an actual incoming call; a generic Firebase-console notification does not
exercise this data-only call invitation and authenticated Answer flow.

## 6. Redmi restrictions and diagnosis

Allow CallPilot's notifications, Autostart/Background autostart and appropriate
app battery access. Labels vary by MIUI version. These can improve reliability
but cannot guarantee every delivery. Android **Force stop** is different from
ordinary task removal; a stopped app must be reopened. Some vendor task cleaners
can impose additional restrictions. This app cannot override those OS controls.

After Clear all, inspect:

```bash
adb shell dumpsys package pro.callpilot.app | rg 'User [0-9]+:|stopped='
adb logcat -s CallPilotPush
```

- `stopped=true`: reopen and investigate Redmi's stopped/autostart policy.
- `stopped=false` with no `incoming_call_received`: check the current native FCM
  registration, Firebase project/package, backend push action and network/OEM
  delivery restrictions. FCM accepting a send is not proof of handset delivery.
- `incoming_call_received` without visible ringing: check call notifications,
  full-screen call access on Android versions that require it, and the native
  `telecom_registration_unavailable`/foreground-service diagnostic markers.
- Ringing works but Answer fails: check current invitation state, device-bound
  authentication, SDK readiness and the backend connect result. Do not retry
  an uncertain connect by blindly creating extra provider calls.

The native timeout bounds ringing even if networking fails. This backend version
does not send a separate cancellation push; when React is running it polls call
state, and otherwise the native invitation deadline clears stale ringing.

## Checks in this change

`npm test` exercises the actual auth/push/API and call orchestration sources
with mocked providers. It includes matched SIP headers, duplicate Answer,
expired invites, other-business rejection, offline timeout, active-call survival,
uncertain connect, token rotation, logout and outgoing authorization. It does
not simulate Google Play delivery or Redmi's task cleaner.

The native module also contains `InviteValidatorTest.kt` for a build environment
with the Android SDK:

```bash
cd android
./gradlew :callpilot-keepalive:testDebugUnitTest
```

Primary references: [Expo SDK 58 notifications](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/),
[Firebase Android receivers](https://firebase.google.com/docs/cloud-messaging/android/receive-messages),
[Firebase priority](https://firebase.google.com/docs/cloud-messaging/android-message-priority),
[Android calling](https://developer.android.com/develop/connectivity/telecom/voip-app/telecom).
