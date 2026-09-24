/**
 * Outgoing email for the CCG app, through Resend's HTTP API (no SDK).
 *
 *   RESEND_API_KEY   Resend API key
 *   CCG_EMAIL_FROM   sender, e.g. "City Church Group <ccg@yourdomain.org>" (a verified Resend domain)
 *
 * When either is missing, nothing is sent and { sent: false } is returned, so
 * callers can fall back (e.g. show an invite link for the admin to share).
 */

export interface EmailResult {
  sent: boolean
  /** Why it was not sent (not configured, or the provider's error). */
  reason?: string
}

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.CCG_EMAIL_FROM
}

export async function sendEmail(msg: { to: string; subject: string; text: string; html: string }): Promise<EmailResult> {
  if (!emailConfigured()) return { sent: false, reason: 'Email is not set up yet (RESEND_API_KEY, CCG_EMAIL_FROM)' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.CCG_EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      console.error('[ccg] email failed:', res.status, body?.message ?? '')
      return { sent: false, reason: body?.message ?? `Email provider returned ${res.status}` }
    }
    return { sent: true }
  } catch (err) {
    console.error('[ccg] email failed:', err)
    return { sent: false, reason: 'Could not reach the email provider' }
  }
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** "Forgot password": a one-time link to choose a new password. */
export function resetEmail(p: { name: string; link: string; expiresMinutes: number; signInName: string }) {
  const subject = 'Reset your password — City Church Group'
  const text = [
    `Hello ${p.name},`,
    '',
    'Someone asked to reset the password for your City Church Group login.',
    '',
    `Choose a new password here: ${p.link}`,
    `The link works once and expires in ${p.expiresMinutes} minutes. You sign in with ${p.signInName}.`,
    '',
    'If you did not ask for this, ignore this email: your password stays the same.',
  ].join('\n')
  const html = `<p>Hello ${escape(p.name)},</p>
<p>Someone asked to reset the password for your City Church Group login.</p>
<p><a href="${escape(p.link)}" style="display:inline-block;padding:10px 16px;background:#e11d48;color:#fff;border-radius:6px;text-decoration:none">Choose a new password</a></p>
<p>The link works once and expires in ${p.expiresMinutes} minutes. You sign in with <strong>${escape(p.signInName)}</strong>.</p>
<p style="color:#666;font-size:12px">If you did not ask for this, ignore this email: your password stays the same.</p>`
  return { subject, text, html }
}

/** The invitation a member receives when they are first given a role. */
export function inviteEmail(p: { name: string; role: string; unit: string | null; link: string; expiresDays: number; signInName: string }) {
  const what = p.unit ? `${p.role} of ${p.unit}` : p.role
  const subject = `You have been made ${what} — City Church Group`
  const text = [
    `Hello ${p.name},`,
    '',
    `You have been made ${what} in the City Church Group app.`,
    '',
    `Create your password here: ${p.link}`,
    `The link works once and expires in ${p.expiresDays} days.`,
    '',
    `Afterwards, sign in with ${p.signInName} and your new password.`,
  ].join('\n')
  const html = `<p>Hello ${escape(p.name)},</p>
<p>You have been made <strong>${escape(what)}</strong> in the City Church Group app.</p>
<p><a href="${escape(p.link)}" style="display:inline-block;padding:10px 16px;background:#e11d48;color:#fff;border-radius:6px;text-decoration:none">Create your password</a></p>
<p>The link works once and expires in ${p.expiresDays} days. Afterwards, sign in with <strong>${escape(p.signInName)}</strong> and your new password.</p>
<p style="color:#666;font-size:12px">If you were not expecting this, you can ignore this email.</p>`
  return { subject, text, html }
}
