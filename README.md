# CallPilot

A business communication app for recruitment consultants — business-line calls, WhatsApp and SMS conversations, ATS contacts, voicemail with transcripts, AI alerts and calling preferences, in one mobile frontend.

Built with **Expo (React Native) + TypeScript + Expo Router**, faithful to the 11-page *AI Jigsaw – CallPilot* design PDF, and connected to the **live CallPilot API** (`https://devapi.callpilot.pro/api/v1` by default — override with `EXPO_PUBLIC_API_URL`). Sign in with a real CallPilot account; contacts, calls, messages, voicemails and alerts come from the backend. Set `EXPO_PUBLIC_SERVICE_MODE=mock` to run fully offline on the original mock data.

## Getting started

```bash
npm install
npm start          # Expo dev server
npm run ios        # iOS simulator
npm run android    # Android emulator / device
npm run web        # Browser (react-native-web)
```

Type-check and lint:

```bash
npx tsc --noEmit
npm run lint
```

### Real VoIP calling (Telnyx)

In-app calls use the same Telnyx WebRTC stack as the CallPilot dashboard:
the app POSTs `/voice/api/token/` for a login token, registers with
`@telnyx/react-native-voice-sdk`, and dials with the organization number
(`/organizations/me`) as caller ID and the profile uid as the `X-Voice-Ext`
header. Incoming calls ring in-app while it is open; mute, hold, DTMF,
speaker and transfer (`/voice/api/transfer/`) are wired to the live call.

Native calling needs an installed native build. Expo Go and web use the existing
browser-SDK bridge for foreground calling; closed-app Android receiving requires
the native build:

```bash
npx expo run:ios                        # local build
npx expo run:android
npx eas-cli@latest build --platform android --profile preview # cloud APK build
```

The keypad header shows the live phone status. Everything else (messages/SMS, contacts,
call history, voicemails, alerts) works over plain HTTPS in any environment.

### Sign-in

- **Live mode (default):** a real CallPilot account (same login as the dashboard). The OTP step appears only when the account has two-step enabled. Tokens are kept in `expo-secure-store` and refreshed automatically.
- **Mock mode** (`EXPO_PUBLIC_SERVICE_MODE=mock`): any email + any password, OTP `123456`.

### Android calls after Clear all

Android now receives incoming calls through native high-priority FCM invitations,
with Telecom/native call UI before React starts. It no longer starts a permanent
idle keep-alive service or automatically asks to keep the app running all day.
Actual calls still use foreground call-lifecycle support for audio.

Add the Firebase Android client file for **`pro.callpilot.app`**, rebuild/install
the native APK, and sign out/sign in once with emailed OTP to register this phone.
The app's **Settings → Calls → Incoming calls while closed** shows registration
readiness. Existing outgoing calling keeps its per-call authorization.

See [step-by-step setup, rebuild and Redmi tests](docs/android-incoming-calls.md).

## Project structure

```
src/
├── app/                     # Expo Router routes
│   ├── (auth)/              # login, verify-otp (no tab bar)
│   ├── (tabs)/              # calls, messages, contacts, alerts, settings
│   ├── keypad.tsx           # root stack + StandaloneTabBar (Calls highlighted)
│   ├── contact/[id].tsx     # root stack + StandaloneTabBar (Contacts highlighted)
│   ├── active-call.tsx      # full-screen, no tab bar
│   └── chat/[id].tsx        # full-screen, no tab bar
├── components/
│   ├── ui/                  # AppText, AppButton, AppInput, Avatar, Badge,
│   │                        # StatusBadge, SearchBar, SegmentedTabs, Card,
│   │                        # SectionHeader, IconButton, Divider, ToggleRow,
│   │                        # Empty/Loading/ErrorState, ConfirmationModal
│   ├── layout/              # ScreenContainer, ScreenHeader, DetailHeader, BottomTabBar
│   ├── calls/               # CallListItem, DialPad(Key), CallControlButton, VoicemailCard
│   ├── contacts/            # ContactListItem, FavouriteContact, ContactActionButton,
│   │                        # ATSStatusCard, DocumentListItem, ActivityListItem
│   ├── messages/            # ConversationListItem, MessageBubble, AttachmentCard,
│   │                        # ChatSystemNotice, MessageComposer
│   ├── alerts/              # AlertCard
│   └── settings/            # OptionPicker
├── data/                    # Interconnected mock data (contacts ↔ calls ↔ chats ↔ ATS)
├── hooks/                   # useContacts (TanStack Query), useCommunications
├── services/                # Mock API layer — swap for real backends here
├── store/                   # Zustand: auth, calls, messages, alerts, settings (persisted)
├── theme/                   # colors, typography (Inter), spacing, radius
├── types/                   # Shared TypeScript models
└── utils/                   # formatTime, formatPhone, getInitials, validators (zod)
```

## Reusable component system

Every repeated pattern from the designs is one shared component:

- **ScreenHeader** — black header with rounded bottom corners (all five tabs); `DetailHeader` adds the back button (Keypad, Record, Chat).
- **SegmentedTabs** — black-selected pill filters (Calls, Contacts, Messages, Settings status).
- **Avatar** — initials from any name (`J. Smith → JS`), any size, pressable.
- **AppButton** — primary (black), secondary (bordered), light, accent, danger; loading/disabled/full-width.
- **Card / StatusBadge / Badge / SectionHeader** — white cards, dot-status pills, channel labels, uppercase section labels.
- **StandaloneTabBar vs BottomTabBar** — the same `TabBarView` renders inside the tab navigator and on Keypad/Contact Record, which live in the root stack (this Expo Router version redirects away from hidden tabs, so `href: null` screens are not navigable).

Updating a component in `src/components/ui` restyles every screen that uses it.

## Motion system

All animation runs through **React Native Reanimated** (UI-thread springs) with shared primitives in `src/components/ui/motion.tsx`:

- `PressableScale` — springy press feedback on every button, card, dial key, call control and FAB.
- `PulsingDot` — breathing dot for live states: the Available badge, the in-call Recording indicator, unread conversations.
- `staggerDelay` — capped stagger for list entrances.

Where it shows: segmented filters have a black pill that **springs between tabs**; list items cascade in with `FadeInDown` and reorder with layout transitions; alerts **slide out** when dismissed; chat bubbles spring in as you send; the voicemail card expands smoothly with a continuously animated progress bar; the active call screen has a breathing blue avatar ring and staggered control reveal; OTP boxes pop in and **shake** on a wrong code; tab icons bounce on selection; modals zoom in; Keypad and Active Call slide up from the bottom of the stack.

## State & data flow

- **Zustand stores** hold interactive state: call history + active mock call, conversations/messages, alerts, settings (persisted to AsyncStorage via `zustand/middleware`).
- **TanStack Query** serves read-only ATS data (contacts, documents, activity) through the service layer.
- **Mock data is relational**: J. Smith's outgoing call appears on Calls *and* in his record's Activity; his WhatsApp document request appears in the chat, the conversation list and the ATS activity; the saved document shows in the chat notice and under Documents.

## API integration

`src/services/api.ts` is the HTTP client (Bearer auth from SecureStore, automatic token refresh on 401); `src/services/mappers.ts` converts API payloads into the app's models. Endpoints in use:

```
POST /token · /token/verify-otp · /token/refresh      auth
GET  /me/ · /phone_number/                            profile + business line
GET  /jigsaw/contacts/?q=…                            ATS contact book (server search)
GET  /jigsaw/contacts/{uid}/                          record + documents + activity
GET  /jigsaw/messages/  ·  POST /jigsaw/messages/     inbox + send (WA → SMS fallback server-side)
GET  /jigsaw/alerts/  ·  PATCH /jigsaw/alerts/        alerts + approve/dismiss decisions
GET  /voice/api/calls/ (?filter=missed)               call history with embedded contacts
GET  /voice/api/voicemails/ · POST …/{uid}/read/      voicemails
POST /jigsaw/messages/suggest-reply/                  AI reply suggestion (chat "Suggest reply")
PATCH/DELETE /jigsaw/contacts/{uid}/                  favourite star / delete contact
GET/POST /jigsaw/contacts/sync/                       ATS sync status banner + "Sync ATS"
```

Web-dashboard parity in the mobile app: AI **Suggest reply** and the approved
**document request template** in every chat, favourite star + delete on the
contact record, **Sync ATS** with the live job banner on Contacts, and
**All / Unread + Mark read** on Alerts — all against the same endpoints the
web workspace calls.

Conversations are messages grouped by contact + channel; conversation ids encode both (`<contactUid>__<channel>`). Each service in `src/services/` has a live and a mock implementation selected by `SERVICE_MODE` (`src/services/config.ts`).

## Notifications & live sync

While signed in and able to execute JavaScript, the app polls the API every 25
seconds (and immediately on returning to the foreground), so Calls and Messages
stay fresh without a manual refresh. The live-sync hook can raise local
notifications for newly discovered messages and missed calls;
tapping one opens the matching chat or the Calls tab (including from a cold
start — the tap is replayed after the session restores). Closed-app Android
incoming calls use the native FCM receiver rather than that polling hook.

Limits: local notifications work in Expo Go. Android closed-app calls use the
native FCM path documented above and require a rebuilt native app. iOS closed-app
receiving still requires its separate PushKit/CallKit integration; JavaScript
timers are not a reliable incoming-call mechanism while suspended. The existing
CallPilot backend provides device registration and native push delivery. Android
uses those endpoints after OTP sign-in; the separate iOS PushKit flow remains
mobile-client work.

## Still simulated (no backend endpoint yet)

- Voicemail audio playback (the `recordings/{uid}/audio/` blob is not streamed yet; the read receipt is real).
- Chat attachments from the composer (upload needs multipart `files` support), per-message read receipts, availability/business-hours sync, bulk device sign-out.
