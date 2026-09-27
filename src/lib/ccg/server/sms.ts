/**
 * Outgoing SMS for the CCG app, through the FlashSMS v2 API (no SDK).
 *
 *   FLASHSMS_API_KEY    v2 key (bms_live_…)
 *   FLASHSMS_SENDER_ID  an approved sender ID, e.g. "FLCSeek"
 *   FLASHSMS_BASE_URL   e.g. "https://api.flashsms.africa/api/v2"
 *
 * When the key or URL is missing, nothing is sent and { sent: false } is
 * returned. Tests never send: under Vitest SMS counts as not set up.
 */

export interface SmsResult {
  sent: boolean
  /** FlashSMS message id, when sent. */
  id?: string
  /** Why it was not sent (not configured, or the provider's error). */
  reason?: string
}

export function smsConfigured(): boolean {
  if (process.env.VITEST) return false
  return !!process.env.FLASHSMS_API_KEY && !!process.env.FLASHSMS_BASE_URL
}

/**
 * Send one message to one or more phones. Never throws. The idempotency key
 * makes a retried send return the first result instead of texting again.
 */
export async function sendSms(msg: { phones: string[]; message: string; idempotencyKey: string }): Promise<SmsResult> {
  if (!smsConfigured()) return { sent: false, reason: 'SMS is not set up (FLASHSMS_API_KEY, FLASHSMS_BASE_URL)' }
  try {
    const res = await fetch(`${process.env.FLASHSMS_BASE_URL!.replace(/\/+$/, '')}/sms/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FLASHSMS_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': msg.idempotencyKey,
      },
      body: JSON.stringify({
        message: msg.message,
        phones: msg.phones,
        ...(process.env.FLASHSMS_SENDER_ID ? { senderId: process.env.FLASHSMS_SENDER_ID } : {}),
      }),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      const reason = body?.error?.message ?? body?.error?.code ?? body?.message ?? `SMS provider returned ${res.status}`
      console.error('[ccg] sms failed:', res.status, reason)
      return { sent: false, reason }
    }
    return { sent: true, id: body?.data?.id }
  } catch (err) {
    console.error('[ccg] sms failed:', err)
    return { sent: false, reason: 'Could not reach the SMS provider' }
  }
}
