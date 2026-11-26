# WhatsApp calling and native mobile incoming calls

This guide covers the Django and dashboard integration, provider setup, and the
contract for the developer building the native mobile app. The backend can
authorize WhatsApp calls, route incoming calls to consultants, send native call
pushes, and connect a mobile device after its SDK is ready. A mobile developer
must still implement the Telnyx native SDK, iOS PushKit/CallKit, and Android
Telecom/ConnectionService integration. Deploying this backend does not install
or complete that mobile app.

The dashboard remains a browser phone. Native incoming call screens while the
app is suspended require the native integration below; a browser tab or WebView
cannot supply it.

## Start here

1. Choose an eligible Cloud API BYON WhatsApp number in the backend's Telnyx
   voice account. Keep your existing telephone number and PSTN application
   routing unchanged; a shared PSTN/WhatsApp number is unsupported here.
2. Configure a dedicated WhatsApp-only Call Control application and the signed
   voice webhook, enable calling at Telnyx, and assign the BYON calling route.
3. Open **VoIP → Business Lines → WhatsApp calling**. Save the number, Meta
   phone number ID, application and routing profile with calling disabled;
   save the Meta system-user token, test the setup, then enable calling.
4. Check the recipient's permission before calling. Request permission within
   the active WhatsApp service window and wait for acceptance. There is no
   automatic PSTN fallback.
5. For native mobile ringing, deploy the backend push settings/migrations and
   give this guide to the mobile developer. They must implement the native
   SDK and OS call UI, register device-bound sessions/tokens, and complete the
   real-device test matrix below.

## How the calls connect

This adapter supports a verified **BYON WhatsApp number** imported into the
backend's Telnyx voice account, with WhatsApp-only inbound routing to a dedicated
Call Control application. Give each business its own WhatsApp application,
different from the existing PSTN Call Control application and the SDK credential
connection. CallPilot uses the incoming event's configured application ID to
identify this channel; it does not assume an undocumented WhatsApp SIP header.
The administrator must explicitly confirm `inbound_isolated`: this application
receives WhatsApp calls only, including no unrelated SIP or PSTN traffic.

Telnyx supports additional calling arrangements, but this isolated adapter does
not support a Telnyx-owned number shared between PSTN and WhatsApp. Telnyx routes
both through its normal number connection and does not document a reliable
channel marker for this integration. **Do not move an existing PSTN number to
the WhatsApp application.** That would change its telephone routing and make
channel classification unreliable. Use the supported BYON route below or plan
a separately implemented provider adapter.

The backend uses this managed Telnyx route for the external WhatsApp leg:

```json
POST https://api.telnyx.com/v2/calls
{
  "connection_id": "BUSINESS_WHATSAPP_CALL_CONTROL_APP_ID",
  "to": "sip:+447911123456@whatsapp-447418613982.sip.telnyx.com",
  "from": "+447418613982"
}
```

The recipient is E.164; the business number in the hostname has no leading `+`.
The consultant uses the existing Telnyx SDK/SIP agent leg. The external leg
remains on WhatsApp. Do not bridge it to a PSTN number or retry a failed
WhatsApp call as a normal telephone call. Telnyx documents managed routing and
the on-net restriction in its [calling guide](https://developers.telnyx.com/docs/messaging/whatsapp/business-calling)
and [enablement guide](https://support.telnyx.com/en/articles/14668631-enabling-whatsapp-business-calling-on-telnyx-numbers).

The manual alternative described by Telnyx sends calls directly to
`wa.meta.vc` with Meta SIP credentials, TLS and encrypted media. That is a
different provider setup and is **not implemented by this adapter**; the
CallPilot configuration here uses the managed
`whatsapp-<business digits>.sip.telnyx.com` route. See [Telnyx's manual SIP guide](https://support-v2.telnyx.com/en/articles/16300026-manually-configure-whatsapp-calling-with-telnyx)
when diagnosing an existing manual deployment.

## Prepare the business number and voice application

1. Confirm the BYON business number is imported into the intended Telnyx account,
   connected to WhatsApp Cloud API, has completed
   Meta verification, and belongs to the intended WABA. Meta requires a business
   daily messaging allowance of at least 2,000 unique recipients to enable
   production calling. A messaging connection alone does not enable calling.
2. Use a Cloud API number eligible for calling. WhatsApp Business app
   **coexistence** numbers retain calls in the Business app but do not support
   Cloud API calling. Do not enable this feature on a coexistence connection.
   See [Telnyx's coexistence limitations](https://developers.telnyx.com/docs/messaging/whatsapp/coexistence).
3. Confirm this number is in the same Telnyx account as the backend's global
   voice `TELNYX_API_KEY` and SDK credential connection. An organization's
   separate Jigsaw messaging API key does not move its number into that voice
   account. A different messaging account needs an appropriate provider/account
   migration or a separate supported voice deployment first.
4. Create a dedicated Call Control application for this business's WhatsApp
   calls. Configure its v2 HTTP POST webhook to:

   ```text
   https://YOUR-BACKEND/api/v1/voice/webhooks/telnyx/
   ```

   Keep Telnyx's signed webhook headers intact through the proxy. Configure the
   backend with the Ed25519 public key from that same Telnyx account; leave
   `VOICE_ALLOW_UNSIGNED_WEBHOOKS` disabled in production.
5. Enable calling on the verified number in Telnyx Mission Control, or use the
   backend-only provider API:

   ```http
   GET /v2/whatsapp/phone_numbers/{E164}/calling_settings
   PATCH /v2/whatsapp/phone_numbers/{E164}/calling_settings
   Content-Type: application/json

   {"enabled": true}
   ```

   Confirm the returned `data.enabled` is true. These are Telnyx API paths, not
   public mobile endpoints. See the [calling settings reference](https://developers.telnyx.com/api-reference/whatsapp-phone-numbers/enable-or-disable-whatsapp-calling-for-a-phone-number).
6. Route the **BYON WhatsApp number** to its dedicated WhatsApp-only application.
   Set the inbound connection in the Calling tab or
   `PATCH /v2/whatsapp/phone_numbers/{E164}/calling_routing` with
   `{"connection_id":"BUSINESS_WHATSAPP_CALL_CONTROL_APP_ID"}`. The BYON update
   is asynchronous: HTTP 202 accepts the request; GET the same route until the
   saved connection matches. The target must be in the same account and cannot
   be a WhatsApp authentication connection. Telnyx-owned numbers do not use
   this BYON route and are unsupported by this adapter. Its readiness check
   requires the BYON routing response; a normal number assignment is not an
   accepted substitute. Confirm with the provider that no PSTN traffic reaches
   this application. See the [routing reference](https://developers.telnyx.com/api-reference/whatsapp-phone-numbers/update-connection-id-for-a-whatsapp-calling-byon-number).
7. In **VoIP → Business Lines**, configure the separate **WhatsApp calling**
   panel with the business number, its Meta phone number ID, the dedicated
   application ID, a business routing profile, and the explicit WhatsApp-only
   inbound-isolation confirmation. The routing profile is an
   existing active CallPilot `VoiceNumber` used for ring members, hours,
   voicemail and recording settings; the external WhatsApp identity remains
   the configured WhatsApp business number. Save with calling disabled, save
   the Meta token, run the account/setup test, and enable after checks pass.
   A successful configuration test is not an answered call or a two-way audio
   test. Re-test after configuration, credentials or provider routing changes.
   Recipient permission is checked again for every outbound call.

Business-initiated calling is unavailable for business numbers from the United
States, Canada, Egypt, Vietnam and Nigeria. This is determined by the business
number, not the consultant's physical location. Inbound calling has broader
availability. Meta's limited quality-based permission exception in some
countries does not remove this implementation's explicit permission checks.
Use the provider's current result rather than assuming any recipient is
callable. See [Meta's calling availability](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling)
and [business-initiated calling](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/business-initiated-calls).

## Credentials, permissions and outbound calls

Keep the Meta system-user access token on the backend. The dashboard credential
input is write-only, and saved credentials are encrypted using the existing
Jigsaw encryption key. Do not put a Telnyx API key, Meta access token, APNs
signing key or FCM service-account private key in the dashboard bundle, native
app bundle, push payload, or any `NEXT_PUBLIC_*` environment variable.

Use an authorized Meta system-user token with access to the relevant WABA and
phone number and the required WhatsApp management/messaging permissions.
Do not use an expiring Graph API Explorer test token for production. The Meta
phone number ID is a Graph resource ID, not the E.164 number, WABA ID or Telnyx
application ID.

CallPilot queries Meta's per-recipient permission endpoint before issuing a
signed WhatsApp call session:

```http
GET /{META_PHONE_NUMBER_ID}/call_permissions?user_wa_id={RECIPIENT_NUMBER}
```

The API's `start_call` action determines whether the call is currently allowed.
`no_permission`, `temporary` and `permanent` describe permission state, while
action limits can still prevent a call. Temporary permissions expire after
seven days; a delivered request or a plain-text reply does not establish a
grant. Meta sends no webhook when a temporary grant expires. A fresh permission
lookup is therefore required at call time. See [Meta's permission contract](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/user-call-permissions/).

The dashboard can request calling permission during an open WhatsApp customer
service window. Requests are limited by Meta, including one per 24 hours and
two per seven days for the business/user pair. Honor the returned `can_request`
result; this API does not return an exact next-request timestamp. Outside the
service window, an approved call-permission
template must be created/configured through the provider; this integration
does not create or automatically send that outside-window template. A normal
free-form message cannot be substituted.

The WhatsApp API namespace below is relative to the application's API base.
The full Django prefix is `/api/v1`; dashboard API clients use `/voice/api/...`
relative to that base. All routes require the authenticated business context.

| Dashboard/API-client path | Method and request |
| --- | --- |
| `/voice/api/whatsapp/` | GET configuration/readiness; admin PATCH `{enabled,business_number,routing_number_uid,phone_number_id,call_control_app_id,inbound_isolated}`. |
| `/voice/api/whatsapp/credentials/` | Admin POST `{meta_access_token}` saves/replaces the encrypted token and disables calling until retested; its value is never returned. |
| `/voice/api/whatsapp/test/` | Admin POST `{}` checks the configured provider account, number and application. |
| `/voice/api/whatsapp/permissions/?number=E164` | GET current recipient permission/callability. |
| `/voice/api/whatsapp/permissions/` | POST `{number:E164}` requests permission inside the service window. |
| `/voice/api/whatsapp/session/` | POST `{number:E164}` obtains destination-bound signed authorization. |

Configuration responses include `ready`, `inbound_ready`, `outbound_ready`,
`checks`, `verified_at`, `has_meta_token`, `can_manage`, available routing
`numbers` and `limitations`. Permission responses include `number`, `status`,
`can_call`, `can_request`, `expires_at` and `detail`. A submitted request adds
`requested:true`; it does not change a recipient's grant by itself.
Use the HTTP client's query encoder for E.164 GET parameters so a leading `+`
is encoded as `%2B` rather than interpreted as a space.

For an outbound call, get the ordinary Telnyx SDK login token from
`POST /api/v1/voice/api/token/`, log in to the SDK, obtain the authorized
WhatsApp session, and dial its `destination_number` using that session's
`call_session_proof` as `X-CallPilot-Session`, with the returned `extension_uid`
as `X-Voice-Ext`. Session responses also include `channel:"whatsapp"`,
`extension` and `expires_at`. Each session lasts two minutes and can authorize
one call only; request a new one for a new attempt. The backend derives
the business identity and managed WhatsApp destination; clients cannot choose
an arbitrary SIP URI, caller ID, organization or provider application.

## Native mobile setup: server push mode

Use **CallPilot server push mode** for this flow. CallPilot sends the incoming
APNs PushKit/FCM invite while retaining the external call, and creates the
device's SDK leg after the user answers and the native SDK is ready. Do not
also enable Telnyx's built-in incoming-call push registration for the same
device/flow: that is a different wake-up design and can produce duplicate call
screens. The native Telnyx SDK is still needed for signaling and audio.

The mobile developer must register the real bundle/package with Apple/Firebase,
configure signed iOS Push Notifications and background audio/VoIP capabilities,
and implement native PushKit/CallKit delegates. Android needs the appropriate
microphone/network, notification and self-managed calling permissions for its
target SDK, an FCM service, Telecom integration and a foreground call service.
Use the current [Telnyx iOS SDK](https://developers.telnyx.com/docs/development/webrtc/ios-sdk)
and [Android SDK](https://developers.telnyx.com/docs/development/webrtc/android-sdk)
for signaling/audio, while retaining CallPilot's server push mode. A JavaScript
handler that starts only after opening the app cannot handle the native wake-up
and immediate incoming-call UI requirements.

An app does not need to run a permanent background WebSocket to receive an
incoming invite. The OS can wake a correctly registered app from suspension or
normal process termination. Delivery and wake-up are not guaranteed: offline
devices, denied permissions, Do Not Disturb, expired invites, Android
force-stop, iOS force-quit and OS/vendor restrictions can prevent ringing.
Reopening the app may be required after a user explicitly stops it. Test the
actual OS versions and release build. See [FCM lifecycle restrictions](https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages).

### Get the Apple and Firebase credentials

Set these up once for the publisher of the CallPilot mobile app. Each CallPilot
customer/consultant does not need separate developer accounts. If the app already
has an Apple team or Firebase project, use those existing accounts. Ask the mobile
developer to confirm the exact iOS bundle ID and Android application ID before
registering either app. Illustrative IDs below must be replaced with the IDs in
the actual builds.

| App you are releasing | Account/project to prepare | Backend values |
| --- | --- | --- |
| iPhone/iPad | Apple Account enrolled in the Apple Developer Program | The four `CALLPILOT_APNS_*` values |
| Android | Google account with a Firebase project | The three `CALLPILOT_FCM_*` / `CALLPILOT_ANDROID_PACKAGE` values |
| Both | Both of the above | Both groups |

Use accounts controlled by the app's publisher/business. Give developers named
access instead of sharing the account owner's password. These settings belong in
the Django backend's real `.env` or server secret configuration. Editing the
tracked `.env.jigsaw.example` only changes the example; it does not configure the
running server. The web dashboard alone does not need native push credentials.

**1. Prepare the Apple account.**

Create/sign in with the publisher's Apple Account at
[Apple Developer enrollment](https://developer.apple.com/programs/enroll/).
Enroll the publishing individual or organization in the Developer Program, or
have the existing team's Account Holder/Admin give you the needed access.
Complete Apple's identity/business verification and membership process. A free
personal development team is not the setup described here for native push and
release distribution. Apple provides the current enrollment requirements and
membership fee during enrollment.

**2. Get `CALLPILOT_APNS_BUNDLE_ID`.**

Ask the mobile developer for the iOS target's Bundle Identifier. For example,
`pro.callpilot.mobile` is an illustrative value, not a value discovered from your
mobile project. In the Apple developer account, open **Certificates, Identifiers
& Profiles → Identifiers → + → App IDs**. Register an explicit App ID using that
exact identifier and enable **Push Notifications**. If it already exists, open
and use it. The identifier must match Xcode's app target. Copy only the base
bundle ID into the environment value; CallPilot appends `.voip` itself for call
pushes. See [Apple's App ID registration guide](https://developer.apple.com/help/account/identifiers/register-an-app-id/).

**3. Get `CALLPILOT_APNS_TEAM_ID`.**

Open the [Apple developer account](https://developer.apple.com/account/), choose
the team that owns the app, and open **Membership details**. Copy **Team ID**,
the ten-character membership identifier. This is not your Apple email, bundle ID
or key ID. See [Apple's Team ID definition/location](https://developer.apple.com/help/glossary/team-id).

**4. Get `CALLPILOT_APNS_KEY_ID` and `CALLPILOT_APNS_PRIVATE_KEY`.**

An Account Holder/Admin opens **Certificates, Identifiers & Profiles → Keys → +**,
names the key, enables **Apple Push Notifications service**, configures its scope
and environment, then registers and downloads the `.p8`. Choose access covering
the app's alert and VoIP topics. Copy its **Key ID** to `CALLPILOT_APNS_KEY_ID`;
put the complete downloaded PEM contents in `CALLPILOT_APNS_PRIVATE_KEY`. A file
path is not accepted. Keep the `.p8` safely; Apple permits its download once.
Follow [Apple's APNs key guide](https://developer.apple.com/help/account/keys/create-a-private-key/).

The backend uses one configured APNs key. Its allowed environment must match the
installation's `sandbox`/`production` registration; use the matching credentials
on separate development/production servers when needed. Your mobile developer
must enable the app's signing capabilities, PushKit/CallKit and background audio
support; obtaining the account values alone does not implement the app.

Example backend format, with placeholders only:

```dotenv
CALLPILOT_APNS_BUNDLE_ID=pro.callpilot.mobile
CALLPILOT_APNS_TEAM_ID=YOUR_APPLE_TEAM_ID
CALLPILOT_APNS_KEY_ID=YOUR_APNS_KEY_ID
CALLPILOT_APNS_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\nPASTE_YOUR_P8_KEY_BODY_HERE\n-----END PRIVATE KEY-----'
```

Use one physical `.env` line for the key, retaining literal `\n` separators and
the PEM header/footer. The backend converts escaped newlines before signing.
Do not add a trailing shell continuation `\` to each `.env` line.

**5. Create/select the Firebase project.**

Sign in to the [Firebase console](https://console.firebase.google.com/) with a
Google account controlled by the app publisher. Create a project or select the
mobile app's existing project. Use a clear name such as **CallPilot Mobile** and
complete the console workflow. Analytics is not required by CallPilot's push
transport. Firebase project creation/Android registration is described in
[Firebase's Android setup](https://firebase.google.com/docs/android/setup).

**6. Get `CALLPILOT_FCM_PROJECT_ID`.**

Open **Project settings → General**, find **Project ID**, and copy it. For example,
`callpilot-mobile-abc123` is an illustrative project ID. Do not use Project name,
Project number, Firebase App ID or an API key. It also appears as `project_id` in
the downloaded service-account JSON. The backend can infer it from that JSON if
the environment field is empty. See [Firebase project identifiers](https://firebase.google.com/docs/projects/learn-more#project-id).

**7. Get `CALLPILOT_ANDROID_PACKAGE`.**

On the Firebase project overview, choose **Add app → Android** and enter the
native app's exact `applicationId` from the app's Gradle configuration. Example:
`pro.callpilot.mobile`. Register the app, download `google-services.json`, and
give that file to the mobile developer for the Android app. Copy the same package
name into `CALLPILOT_ANDROID_PACKAGE`. It is an optional server restriction but
should be set to the actual installed app ID. Development builds with an
application-ID suffix need their own matching registration/configuration. See
[Firebase Android app registration](https://firebase.google.com/docs/android/setup#register-app).

**8. Get `CALLPILOT_FCM_SERVICE_ACCOUNT_JSON`.**

Open **Project settings → Service accounts → Firebase Admin SDK → Generate new
private key**. Download the JSON for a service account in the intended project.
This is a backend credential and differs from Android's `google-services.json`.
Put the complete service-account JSON, including its `private_key` and
`client_email`, into `CALLPILOT_FCM_SERVICE_ACCOUNT_JSON` as one single-quoted JSON
line. Do not enter a filename, just one field, or a base64-encoded value. Use a
local editor/tool to compact the JSON and preserve its JSON `\n` escapes.
See [Firebase's service-account key instructions](https://firebase.google.com/docs/admin/setup/).

In the same project, check **Project settings → Cloud Messaging** and ensure
**Firebase Cloud Messaging API (V1)** is enabled. If needed, follow the linked
Google Cloud API page to enable it. The service account needs FCM send access in
that project; an administrator can grant **Firebase Cloud Messaging API Admin**
through **Google Cloud → IAM & Admin → IAM** if it lacks permission. Use the same
project for the mobile Firebase app and these server credentials. See
[Firebase's HTTP v1 authorization guide](https://firebase.google.com/docs/cloud-messaging/send/v1-api).

Example backend structure; replace the JSON placeholder with the entire real JSON:

```dotenv
CALLPILOT_FCM_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
CALLPILOT_FCM_SERVICE_ACCOUNT_JSON='PASTE_COMPLETE_COMPACT_SERVICE_ACCOUNT_JSON_HERE'
CALLPILOT_ANDROID_PACKAGE=YOUR_ANDROID_APPLICATION_ID
```

**9. Leave `CALLPILOT_NATIVE_PUSH_ENCRYPTED_CREDENTIALS` empty initially.**

```dotenv
CALLPILOT_NATIVE_PUSH_ENCRYPTED_CREDENTIALS=
```

There is no account or provider dashboard that supplies this value. It is an
optional alternative generated by your backend developer using the existing
`jigsaw_integrations.security.encrypt_credentials()` helper and the deployment's
`JIGSAW_CREDENTIAL_ENCRYPTION_KEY`. Keep that existing encryption key unchanged.
If you use the individual settings above, leave this alternative empty.

For administrators choosing the encrypted alternative, the helper's input is:

```json
{
  "apns": {
    "key_id": "APNS_KEY_ID",
    "team_id": "APPLE_TEAM_ID",
    "private_key": "COMPLETE_P8_PEM_CONTENTS"
  },
  "fcm": {
    "project_id": "FIREBASE_PROJECT_ID",
    "service_account": {"...": "all fields from the parsed service-account JSON"}
  }
}
```

Store the resulting encrypted string in that setting. A nonempty encrypted
setting overrides both providers' individual credential settings; there is no
provider-by-provider fallback. Include both objects if using both platforms.
`CALLPILOT_APNS_BUNDLE_ID` and `CALLPILOT_ANDROID_PACKAGE` remain separate fields.

**10. Activate and test.**

Save the real backend configuration and restart Django and the Celery workers.
Keep Celery Beat running for call expiry/recovery. Give the mobile developer the
bundle/package/project identifiers, the app configuration file and the integration
contract below. Keep server private keys on the backend. Have the app sign in,
register each installation's push tokens, and test a message plus incoming call
on real iOS/Android devices while foregrounded, locked and suspended. Normal
closed-app notifications also require the native handlers and permissions below.

If currently releasing only Android, populate the Firebase group and leave the
APNs group empty. For iOS only, populate APNs and leave Firebase empty. These
native settings do not supply WhatsApp/telephone provider credentials; preserve
the existing `TELNYX_*` settings and enter the Meta calling token through the
business's dashboard configuration.

### Backend push configuration

Use the new entries in [`.env.jigsaw.example`](../.env.jigsaw.example) alongside
the existing Telnyx voice settings. Preserve the existing
`JIGSAW_CREDENTIAL_ENCRYPTION_KEY` so stored integration credentials and native
push tokens remain readable.

| Setting | Required for |
| --- | --- |
| `CALLPILOT_APNS_KEY_ID` | APNs signing-key ID for iOS pushes. |
| `CALLPILOT_APNS_TEAM_ID` | Apple Developer team owning the app. |
| `CALLPILOT_APNS_PRIVATE_KEY` | Private `.p8` signing key, stored only on the backend. |
| `CALLPILOT_APNS_BUNDLE_ID` | Exact signed iOS bundle ID; VoIP delivery uses its `.voip` topic. |
| `CALLPILOT_FCM_SERVICE_ACCOUNT_JSON` | Firebase service-account JSON authorized to send FCM messages. |
| `CALLPILOT_FCM_PROJECT_ID` | Optional explicit project ID; otherwise taken from the service account. |
| `CALLPILOT_ANDROID_PACKAGE` | Optional exact Android package restriction for FCM delivery. |
| `CALLPILOT_NATIVE_PUSH_ENCRYPTED_CREDENTIALS` | Optional encrypted APNs/FCM credential bundle instead of individual signing credentials. |

Native token registration chooses APNs `sandbox` or `production` for that
installation. Match it to the signed build and APNs token. Replacing the APNs
environment requires replacing or clearing all retained APNs/VoIP tokens.
Ordinary iOS alerts use the APNs token; incoming calls require the separate
PushKit VoIP token. Expo alert tokens do not substitute for PushKit or FCM call
tokens.

### Sign in and register the installation

Use HTTPS and `Authorization: Bearer DEVICE_BOUND_ACCESS_JWT` for authenticated
requests after registration. Send `X-Organization-Id: BUSINESS_UUID` matching
the installation's business on all Jigsaw/voice API requests. The push's
business UUID helps select the already authorized account; it never grants
access to another business. Keep development and production URLs, accounts
and push environments separate.


1. `POST /api/v1/token` with `{email,password,remember_me}`. Retain the returned
   `otp_challenge` when `otp_required` is true.
2. `POST /api/v1/token/verify-otp` with that `otp_challenge` and six-digit
   `otp_code`. Mobile registration requires the emailed OTP sign-in; a
   password-only session is rejected.
3. With the verified access JWT, `POST /api/v1/jigsaw/auth/device/`:

   ```json
   {"name":"Consultant's iPhone","platform":"ios"}
   ```

   Use `platform:"android"` on Android. Save `device.uid` and replace/discard
   the original unbound access/refresh tokens with this response's
   device-bound `access` and `refresh` tokens. Store them in Keychain/Keystore.
   `POST /api/v1/jigsaw/devices/` alone does not issue these tokens.
4. Register the current native tokens using the **access JWT for that exact
   device**, not a desktop or another installation's JWT:

   ```http
   POST /api/v1/jigsaw/devices/{device_uid}/native-push/
   Authorization: Bearer DEVICE_BOUND_ACCESS_JWT
   Content-Type: application/json
   ```

   iOS:

   ```json
   {"apns_token":"HEX_APNS_TOKEN","voip_token":"HEX_PUSHKIT_TOKEN","environment":"production"}
   ```

   Android:

   ```json
   {"fcm_token":"CURRENT_FCM_REGISTRATION_TOKEN"}
   ```

   POST and PATCH update supplied fields; omitted fields are retained and an
   empty string clears one token. The response returns registration flags,
   never the token values. DELETE removes native registrations. Register again
   whenever the platform rotates a token, after reinstall, and after an account
   change. Backend token ownership transfer stops the previous account from
   receiving pushes for the same registration.
5. Refresh CallPilot authentication through
   `POST /api/v1/jigsaw/auth/refresh/` with `{"refresh":"DEVICE_REFRESH_JWT"}`.
   Keep the returned bound tokens. If the device was revoked, sign-in is
   required again; do not fall back to a cached unbound session.
6. `POST /api/v1/voice/api/token/` with the current bound access JWT. The backend
   provisions/uses a separate Telnyx credential for this installation and
   returns the SDK `token`, `device_uid`, extension identity and
   `call_session_proof`. Log in with this short-lived SDK token and renew it
   when needed. Do not mint provider tokens in the app or ship the server API
   key. See [Telnyx token authentication](https://developers.telnyx.com/docs/voice/webrtc/auth/jwt).

### Receive and open messages

Incoming WhatsApp and SMS receipts enqueue a native notification with
`kind:"callpilot_message"`, `message_uid`, `organization_uid`, `sent_at` and
`expires_at`. Ordinary messages use APNs alert/FCM notification delivery, not
PushKit. The lock-screen text stays generic; the message body is fetched after
normal authentication.

On notification tap, request
`GET /api/v1/jigsaw/messages/{message_uid}/`. The response contains `message`
and `conversation_number`. Open that thread using
`GET /api/v1/jigsaw/messages/?conversation_number=URL_ENCODED_NUMBER&limit=50&offset=0`.
List inbox threads through `GET /api/v1/jigsaw/conversations/?limit=30&offset=0`.
Normal reply/template/WhatsApp-window rules also apply in the mobile app.
For `kind:"callpilot_alert"`, open the authenticated Alerts view using its
`alert_uid`. Read current server state; never trust a push as a read receipt.

If migrating an installation from Expo alert delivery to this native mode,
clear its old Expo `push_token` through `PATCH /api/v1/jigsaw/devices/` with
`{"uid":"DEVICE_UUID","push_token":""}` to avoid duplicate alert notifications.
Native token registration intentionally retains the existing Expo token until
you explicitly clear it.

### Receive, answer and end a call

The server's incoming push data contains identifiers and expiry, not caller
phone numbers, message previews or credentials:

```json
{
  "v":"1",
  "kind":"incoming_call",
  "call_uuid":"CALLPILOT_VOICE_CALL_UUID",
  "organization_uid":"BUSINESS_UUID",
  "sent_at":"2026-11-18T10:00:00+00:00",
  "expires_at":"2026-11-18T10:00:25+00:00"
}
```

APNs includes its required `aps` object. FCM data values are strings. Deduplicate
by `call_uuid`; the backend may retry delivery. Check expiry and retrieve
authenticated call state before trying to connect. The push is an invitation,
not proof the caller is still present or the consultant is still eligible.

1. On iOS, handle the VoIP push natively and report the incoming call to CallKit
   immediately using `call_uuid` as the stable native UI UUID. Do not wait for
   a network lookup, token refresh or React/WebView initialization before
   reporting the real call. Complete the PushKit callback promptly. Fetch
   caller details/state afterward; if no longer callable, end that CallKit
   call. Follow [Apple's PushKit/CallKit requirements](https://developer.apple.com/documentation/pushkit/responding-to-voip-notifications-from-pushkit).
2. On Android, receive the high-priority incoming data message in native code
   and immediately display/register the incoming call through the app's
   Telecom/ConnectionService integration and call notification. Process only
   bounded work in the FCM handler. See [FCM priority and processing](https://firebase.google.com/docs/cloud-messaging/android-message-priority).
3. Refresh the device-bound CallPilot JWT if necessary, fetch current call
   state, request the SDK token, and wait for the native Telnyx SDK to be ready.
4. After the user selects **Answer**, and only when SDK registration is ready,
   POST the server's mobile `connect` endpoint for `call_uuid`. The backend
   rechecks membership, ring eligibility and call state before dialing the
   device's SIP credential.
5. Read `X-CallPilot-Call-UUID` and `X-CallPilot-Invitation-UUID` from the
   resulting incoming SIP invite. Match them to the authenticated call and
   invitation, accept that SDK invite, and associate its provider call ID with
   the **same existing native UI UUID**. Do not create a second CallKit or
   Android call screen or guess that the next unrelated SIP invite belongs to
   this call. Ignore/reject unmatched, expired or cancelled invitations. Keep
   the CallPilot UUID-to-SDK-call mapping; the provider call ID need not equal
   the CallPilot UUID. Confirm that the chosen native SDK version exposes
   incoming custom headers during real-device acceptance. Telnyx documents
   propagation in its [custom SIP header guide](https://support-v2.telnyx.com/en/articles/16666680-custom-sip-x-header-propagation-on-telnyx).
6. Mark the native call connected when the SDK/media state confirms connection.
   HTTP acceptance of `connect` alone does not mean that audio is connected.
   Propagate mute, audio route, interruptions and native end actions to the
   SDK. Keep active-call audio enabled in the background; Android needs its
   foreground call service/ongoing call notification. See [Android Telecom
   foreground support](https://developer.android.com/develop/connectivity/telecom/voip-app/telecom).
7. A decline before answer uses the mobile `decline` endpoint. An end action
   hangs up the SDK call and notifies the mobile `end` endpoint. SDK remote
   hangup, expiry, caller cancellation, voicemail or another device winning
   must also end the same native screen. Handle repeated end/decline callbacks
   idempotently.

After wake-up, poll the specific call-state endpoint while the invitation is
pending/connecting and the app has OS execution time, continuing until the
invitation deadline or a terminal/answered-elsewhere result. Stop ringing and
close the same CallKit/ConnectionService screen when the server reports
`cancelled`, `expired`, a terminal call, or another device answering. SDK remote
hangup events must do the same. This release does not send cancellation
PushKit pushes or a separate background call-state push; polling and the
native timeout are required client work.

Schedule a local native timeout using `expires_at` as soon as the incoming
screen is created. It must stop an unanswered/connecting invitation even if
networking fails, no further push arrives, or the caller cancels during SDK
initialization. Cancel that invitation timer once this handset has confirmed
its own connected SDK/media call; the original ringing deadline must not end
an established call. Do not keep polling or reconnecting a cancelled invite.

Mobile call controls use the same device-bound JWT. They never accept a
caller-supplied business or user identity:

| Full backend route | Purpose |
| --- | --- |
| `GET /api/v1/voice/api/mobile/calls/` | Return `{calls:[...]}` for this device's pending/connecting and answered invitations. |
| `GET /api/v1/voice/api/mobile/calls/{call_uid}/` | Refresh one call's current state. |
| `POST /api/v1/voice/api/mobile/calls/{call_uid}/connect/` | Request this ready device's SDK leg after user answer. |
| `POST /api/v1/voice/api/mobile/calls/{call_uid}/decline/` | Decline this device's invitation. |
| `POST /api/v1/voice/api/mobile/calls/{call_uid}/end/` | End the device's call according to current server ownership/state. |

POST actions have an empty JSON body `{}`. Do not send a device UID, user,
business, SIP address or provider call ID. A call-state/action response contains
`call_uuid`, `invitation_uid`, `organization_uid`, `state`, `call_status`,
`channel`, `expires_at`, `started_at`, `answered_at`, `ended_at`, `caller` and
`can_connect`. `caller` exposes only the authorized `number`, `name` and
`contact_uid`. Invitation states are `pending`, `connecting`, `answered`,
`declined`, `cancelled` and `expired`.

Repeated `connect` while connecting/answered returns current state without
redialing. HTTP 409 means no longer available, HTTP 410 means expired, and
HTTP 403 means this session/device cannot perform the action. HTTP 502 can
mean the provider result is uncertain: poll the specific call state and await
SDK events instead of starting another provider call. HTTP 404 does not grant
access to another device's invitation.

Several phones and the browser may ring for one call. A connect attempt is not
a reservation that overrides another answer. Reconcile the server's latest
state and SDK hangup events when another device wins; stop ringing immediately
and do not reconnect the lost invitation. Do not globally end a colleague's
answered call because this device's stale native screen was dismissed.

On logout, unregister native tokens while the bound session is still valid,
revoke the device through `POST /api/v1/jigsaw/devices/{device_uid}/revoke/`,
disconnect its SDK session and clear locally stored tokens. Provider cleanup
that needs review must be resolved by the administrator; losing the refresh
token alone does not unregister an already logged-in SDK session.

## Deploy and verify

Install the updated backend requirements, apply migrations, and restart Django,
the Celery worker and the single Beat scheduler. Native push uses the worker;
ring expiry/voicemail cleanup also needs the `voice.expire_mobile_calls`
per-call deadline task and recurring recovery sweep. Keep
worker latency short enough for the ring window. Rebuild/restart the dashboard
with the backend changes. Configure valid HTTPS endpoints and synchronized
server clocks before provider testing.

This release includes `ai_jigsaw.0014_device_native_push` and
`voice.0008_voicecall_business_number_voicecall_channel_and_more`. Apply both
before running the updated API and workers; the normal `migrate` command
applies their dependencies in order.

Use the deployment's existing virtual environment, for example:

```bash
venv/bin/pip install -r requirements.txt
venv/bin/python manage.py migrate
venv/bin/python manage.py check
```

Run the focused backend test modules for WhatsApp authorization/routing and
native push/mobile call control, then perform this real-device acceptance
matrix with the business's own test contacts:

| Test | Expected result |
| --- | --- |
| Calling setup test, wrong account/app/number or shared PSTN routing | Clear setup failure; no existing PSTN number reassignment or unauthorized call. |
| WhatsApp incoming and permitted outgoing | Correct business identity, consultant routing, two-way audio and shared call history. |
| Missing, revoked or expired permission; request cooldown | Call blocked or request held with the current reason. |
| Coexistence number; geo-ineligible outbound business number | Unsupported setup or outbound attempt is rejected with a useful reason; verify inbound eligibility separately. |
| External PSTN transfer from a WhatsApp call | Rejected; permitted SDK/consultant routing remains within the configured flow. |
| iOS foreground, locked, suspended and normally terminated | One CallKit screen; answer wakes/logs in SDK and connects the retained call. |
| Android foreground, locked, Doze and normal process death | One native call notification/screen; answer connects after SDK readiness. |
| Two phones and browser answer together | One winner, losing screens close, no late duplicate bridge. |
| Caller hangs up during wake-up/token refresh | Current state closes the invitation; no fresh leg after cancellation. |
| Duplicate/delayed push; expired invite | No second native screen or reconnection of an ended call. |
| Token rotation, reinstall, business switch and revoked device | Only the current authorized installation receives/connects calls. |
| Offline, denied permission, DND and explicit force-stop/force-quit | Predictable missed-call/voicemail behavior; no promise of guaranteed ringing. |
| Active call then app background/lock or network change | Supported audio/service lifecycle; clean end/recovery behavior. |

Provider push acceptance is not device delivery, successful wake-up, answer or
audio confirmation. Check call events and test both audio directions. Native
app implementation, entitlements, signing, release distribution and device
acceptance testing remain the mobile developer's work.
