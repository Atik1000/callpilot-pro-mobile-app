/**
 * Pure validation shared by cold-start push and SIP invitation handling.
 *
 * Telnyx React Native SDK 1.2.1 exposes incoming custom SIP headers at
 * InviteEvent.params.dialogParams.custom_headers and Call.inviteCustomHeaders.
 * Never identify an invitation using the SDK's unrelated callId or by assuming
 * the next call received after a push must belong to that invitation.
 */
export interface MobileCallIdentity {
  call_uuid: string;
  invitation_uid: string;
}

export interface MobilePushInvitation {
  call_uuid: string;
  organization_uid: string;
  expires_at: string;
  action: 'open' | 'answer' | 'decline';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
// Backend invitations last at most 60 seconds. Allow a small clock skew while
// refusing an arbitrary future expiry that could keep a stale call ringing.
const MAX_PUSH_REMAINING_MS = 65_000;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function uuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** Validates a direct FCM data object or the native module's persisted event. */
export function parseMobilePush(value: unknown, now = Date.now()): MobilePushInvitation | null {
  const data = record(value);
  if (!data || !Number.isFinite(now)) return null;
  if ('kind' in data && data.kind !== 'incoming_call') return null;
  if ('v' in data && data.v !== '1') return null;
  if (!uuid(data.call_uuid) || !uuid(data.organization_uid)) return null;
  if (typeof data.expires_at !== 'string' || !ISO_TIME.test(data.expires_at)) return null;
  const action = data.action ?? 'open';
  if (action !== 'open' && action !== 'answer' && action !== 'decline') return null;
  const remaining = Date.parse(data.expires_at) - now;
  // Telecom's disconnect callback can arrive long after an answered call's
  // original ringing deadline. It is only a request to inspect authenticated
  // backend state, never proof that this handset is allowed to end the call.
  if (!Number.isFinite(remaining) || remaining > MAX_PUSH_REMAINING_MS
    || (action !== 'decline' && remaining <= 0)) return null;
  return {
    call_uuid: data.call_uuid.toLowerCase(),
    organization_uid: data.organization_uid.toLowerCase(),
    expires_at: data.expires_at,
    action,
  };
}

/**
 * Read only SDK-supported header locations. Conflicting duplicate headers,
 * malformed values or disagreement between the raw event and Call fail closed.
 */
export function readCallPilotHeaders(message: unknown, call?: unknown): MobileCallIdentity | null {
  const event = record(message);
  const params = record(event?.params);
  const dialog = record(params?.dialogParams);
  const sdkCall = record(call) ?? event;
  const collections = [dialog?.custom_headers, sdkCall?.inviteCustomHeaders]
    .filter((headers) => headers !== undefined && headers !== null);
  if (collections.length === 0 || collections.some((headers) => !Array.isArray(headers))) return null;

  const values: Partial<MobileCallIdentity> = {};
  for (const headers of collections as unknown[][]) {
    for (const raw of headers) {
      const header = record(raw);
      if (!header || typeof header.name !== 'string' || typeof header.value !== 'string') return null;
      const name = header.name.toLowerCase();
      const key = name === 'x-callpilot-call-uuid' ? 'call_uuid'
        : name === 'x-callpilot-invitation-uuid' ? 'invitation_uid' : null;
      if (!key) continue;
      if (!uuid(header.value)) return null;
      const normalized = header.value.toLowerCase();
      if (values[key] && values[key] !== normalized) return null;
      values[key] = normalized;
    }
  }
  return values.call_uuid && values.invitation_uid
    ? { call_uuid: values.call_uuid, invitation_uid: values.invitation_uid }
    : null;
}

/** Both backend identifiers must match; neither SIP caller ID nor order is proof. */
export function matchesMobileCall(message: unknown, expected: MobileCallIdentity, call?: unknown): boolean {
  if (!uuid(expected?.call_uuid) || !uuid(expected?.invitation_uid)) return false;
  const actual = readCallPilotHeaders(message, call);
  return actual !== null
    && actual.call_uuid === expected.call_uuid.toLowerCase()
    && actual.invitation_uid === expected.invitation_uid.toLowerCase();
}
