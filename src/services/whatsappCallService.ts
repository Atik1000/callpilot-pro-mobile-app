import { apiRequest } from './api';

/**
 * WhatsApp Business calling (business-initiated). Every outbound call needs:
 * 1. a fresh permission check (Meta grants expire silently),
 * 2. a destination-bound session (2 minutes, one call) whose proof goes out
 *    as X-CallPilot-Session. The backend picks the WhatsApp SIP destination,
 *    caller ID and application; the app only dials `destination_number`.
 * There is no PSTN fallback: a blocked WhatsApp call stays blocked.
 */
export interface WhatsAppPermission {
  number: string;
  status: string;
  can_call: boolean;
  can_request: boolean;
  expires_at?: string | null;
  detail?: string;
  requested?: boolean;
}

export interface WhatsAppSession {
  destination_number: string;
  call_session_proof: string;
  extension_uid?: string;
  extension?: string;
  channel: 'whatsapp';
  expires_at?: string;
}

/** "+44 7911 123456" -> "+447911123456" (E.164). */
export function toE164(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

export const whatsappCallService = {
  getPermission(number: string): Promise<WhatsAppPermission> {
    // encodeURIComponent turns the leading "+" into %2B (not a space).
    return apiRequest<WhatsAppPermission>(
      `/voice/api/whatsapp/permissions/?number=${encodeURIComponent(toE164(number))}`,
    );
  },

  /** Asks the customer for call permission (only inside the service window). */
  requestPermission(number: string): Promise<WhatsAppPermission> {
    return apiRequest<WhatsAppPermission>('/voice/api/whatsapp/permissions/', {
      method: 'POST',
      body: { number: toE164(number) },
    });
  },

  async createSession(number: string): Promise<WhatsAppSession> {
    const session = await apiRequest<WhatsAppSession>('/voice/api/whatsapp/session/', {
      method: 'POST',
      body: { number: toE164(number) },
    });
    if (!session?.destination_number || !session.call_session_proof) {
      throw new Error('WhatsApp calling is not authorized for this number.');
    }
    return session;
  },
};
