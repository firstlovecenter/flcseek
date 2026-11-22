/**
 * Outgoing SMS for the CCG app, through the FLC Notify service.
 *
 *   FLC_NOTIFY_KEY     API secret for the FLC Notify service
 *   FLC_NOTIFY_URL     Base URL, e.g. "https://your-api.amazonaws.com"
 *   FLC_NOTIFY_SENDER_ID  Optional approved sender ID, e.g. "FLCSeek"
 *
 * When the key or URL is missing, nothing is sent and { sent: false } is
 * returned. Tests never send: under Vitest SMS counts as not set up.
 */

export interface SmsResult {
  sent: boolean
  /** FLC Notify message id, when sent. */
  id?: string
  /** Why it was not sent (not configured, or the provider's error). */
  reason?: string
}

export function smsConfigured(): boolean {
  if (process.env.VITEST) return false
  return !!process.env.FLC_NOTIFY_KEY && !!process.env.FLC_NOTIFY_URL
}

/**
 * Send one message to one or more phones. Never throws.
 * The idempotencyKey parameter is kept for call-site compatibility but is not
 * forwarded to the FLC Notify relay (the service has no idempotency header).
 */
export async function sendSms(msg: { phones: string[]; message: string; idempotencyKey: string }): Promise<SmsResult> {
  if (!smsConfigured()) return { sent: false, reason: 'SMS is not set up (FLC_NOTIFY_KEY, FLC_NOTIFY_URL)' }
  try {
    const url = process.env.FLC_NOTIFY_URL!.replace(/\/+$/, '')
    const key = process.env.FLC_NOTIFY_KEY!
    const sender = process.env.FLC_NOTIFY_SENDER_ID

    const res = await fetch(`${url}/send-sms`, {
      method: 'POST',
      headers: {
        'x-secret-key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: msg.phones,
        message: msg.message,
        ...(sender ? { sender } : {}),
      }),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok || !body?.success) {
      const reason = body?.error ?? body?.message ?? `FLC notify returned ${res.status}`
      console.error('[ccg] sms failed:', res.status, reason)
      return { sent: false, reason }
    }
    return { sent: true, id: body?.data?.id }
  } catch (err) {
    console.error('[ccg] sms failed:', err)
    return { sent: false, reason: 'Could not reach the SMS provider' }
  }
}
