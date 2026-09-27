import { createHash } from 'node:crypto'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { currentAssignmentWhere } from '../access'
import { logCcg, normalizePhone } from './common'
import { LEADER_ROLE } from './roles'
import { sendSms, smsConfigured } from './sms'

/**
 * Texts CCF Coordinators when converts are placed in (or transferred to) their
 * CCF: one short, personal SMS per coordinator per action, asking them to log
 * in. Converts' own details are never in the text.
 */

export type NewConvertEvent = 'placed' | 'transferred'
export interface NewConvertItem {
  ccfId: string
  placementId: string
}

/** One SMS segment: 160 characters of the GSM 03.38 basic set. */
export const SMS_SEGMENT = 160
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
const GSM_SET = new Set(GSM_BASIC)
const REPLACE: Record<string, string> = {
  '‘': "'", '’': "'", '‚': "'", '`': "'", '“': '"', '”': '"', '„': '"',
  '–': '-', '—': '-', '…': '...', ' ': ' ', '\t': ' ',
  // GSM extension characters take two places; keep to the basic set.
  '[': '(', ']': ')', '{': '(', '}': ')', '~': '-', '|': '/', '\\': '/', '^': '', '€': 'EUR',
}

/** Text that stays in the GSM basic set (so one segment holds 160 characters). */
export function gsmSafe(text: string): string {
  let out = ''
  for (const ch of text) {
    if (GSM_SET.has(ch)) out += ch
    else if (ch in REPLACE) out += REPLACE[ch]
    else {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
      out += [...base].every((c) => GSM_SET.has(c)) ? base : ''
    }
  }
  return out.replace(/ {2,}/g, ' ').trim()
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/**
 * The coordinator's message: first name only, at most one segment. Only the
 * CCF name is shortened to fit, falling back to "your CCF".
 */
export function buildLeaderSms(p: { firstName: string | null; count: number; ccfNames: string[]; event: NewConvertEvent }): string {
  const first = gsmSafe(p.firstName ?? '').split(' ')[0]
  const hi = first ? `Hi ${first},` : 'Hi,'
  const n = p.count
  const text = (where: string) =>
    p.event === 'transferred'
      ? `${hi} ${n} ${plural(n, 'soul has', 'souls have')} been transferred to ${where}. Please log in to the CCG app to see them.`
      : `${hi} you have ${n} new ${plural(n, 'soul', 'souls')} in ${where}. Please log in to the CCG app to see and welcome them.`

  const names = [...new Set(p.ccfNames.map(gsmSafe).filter(Boolean))]
  if (names.length !== 1) return fit(text('your CCFs'))
  const full = text(names[0])
  if (full.length <= SMS_SEGMENT) return full
  const room = SMS_SEGMENT - text('').length - 2
  return fit(room >= 6 ? text(`${names[0].slice(0, room).trimEnd()}..`) : text('your CCF'))
}

/** Last resort for a very long first name: a shorter sentence, then a hard cut. */
function fit(text: string): string {
  if (text.length <= SMS_SEGMENT) return text
  const short = text.replace(' Please log in to the CCG app', ' Log in to the CCG app')
  return short.length <= SMS_SEGMENT ? short : short.slice(0, SMS_SEGMENT)
}

export const smsKey = (event: NewConvertEvent, phone: string, placementIds: string[]) =>
  createHash('sha256').update(`ccg-new-converts|${event}|${phone}|${[...placementIds].sort().join(',')}`).digest('hex')

export interface CoordinatorContact {
  userId: string
  firstName: string | null
  phone: string
  ccfIds: string[]
}

/**
 * The current CCF Coordinators of these CCFs who have a phone number, one
 * entry per phone (someone coordinating two of the CCFs gets one text).
 */
export async function ccfCoordinatorContacts(ccfIds: string[]): Promise<CoordinatorContact[]> {
  if (!ccfIds.length) return []
  const rows = await prisma.ccgRoleAssignment.findMany({
    where: { roleKey: LEADER_ROLE.ccf, ccfId: { in: ccfIds }, ...currentAssignmentWhere() },
    select: {
      ccfId: true,
      user: {
        select: {
          id: true,
          firstName: true,
          phoneNumber: true,
          ccgPeople: { where: { deletedAt: null }, select: { firstName: true, phone: true }, orderBy: { createdAt: 'asc' }, take: 1 },
        },
      },
    },
  })
  const byPhone = new Map<string, CoordinatorContact>()
  for (const r of rows) {
    const person = r.user.ccgPeople[0]
    const phone = normalizePhone(person?.phone || r.user.phoneNumber)
    if (!phone || !r.ccfId) continue
    const c = byPhone.get(phone) ?? { userId: r.user.id, firstName: person?.firstName || r.user.firstName || null, phone, ccfIds: [] }
    if (!c.ccfIds.includes(r.ccfId)) c.ccfIds.push(r.ccfId)
    byPhone.set(phone, c)
  }
  return [...byPhone.values()]
}

/** Text each CCF's coordinators about the converts just placed there. */
export async function notifyNewConverts(items: NewConvertItem[], actorId: string | null, event: NewConvertEvent) {
  if (!items.length) return
  const byCcf = new Map<string, string[]>()
  for (const it of items) byCcf.set(it.ccfId, [...(byCcf.get(it.ccfId) ?? []), it.placementId])
  const ccfIds = [...byCcf.keys()]
  const [contacts, ccfs] = await Promise.all([
    ccfCoordinatorContacts(ccfIds),
    prisma.ccgFamily.findMany({ where: { id: { in: ccfIds } }, select: { id: true, name: true } }),
  ])
  const nameOf = new Map(ccfs.map((f) => [f.id, f.name]))

  const reached = new Set(contacts.flatMap((c) => c.ccfIds))
  for (const ccfId of ccfIds.filter((id) => !reached.has(id))) {
    await logCcg({
      userId: actorId,
      action: 'LEADER_SMS_SKIPPED',
      entityType: 'ccg_family',
      entityId: ccfId,
      newValues: { event, converts: byCcf.get(ccfId)!.length, reason: 'No CCF Coordinator with a phone number' },
    })
  }

  for (const c of contacts) {
    const placementIds = c.ccfIds.flatMap((id) => byCcf.get(id) ?? [])
    const message = buildLeaderSms({ firstName: c.firstName, count: placementIds.length, ccfNames: c.ccfIds.map((id) => nameOf.get(id) ?? ''), event })
    const configured = smsConfigured()
    const r = configured ? await sendSms({ phones: [c.phone], message, idempotencyKey: smsKey(event, c.phone, placementIds) }) : null
    await logCcg({
      userId: actorId,
      action: !r ? 'LEADER_SMS_SKIPPED' : r.sent ? 'LEADER_SMS_SENT' : 'LEADER_SMS_FAILED',
      entityType: 'ccg_family',
      entityId: c.ccfIds[0],
      newValues: {
        event,
        ccf_ids: c.ccfIds,
        converts: placementIds.length,
        coordinator_user_id: c.userId,
        message,
        ...(r?.id ? { message_id: r.id } : {}),
        ...(!r ? { reason: 'SMS is not set up' } : r.sent ? {} : { reason: r.reason }),
      },
    })
  }
}

/** Send after the response (never delays or fails the approval itself). */
export function queueNewConvertSms(items: NewConvertItem[], actorId: string | null, event: NewConvertEvent) {
  if (!items.length) return
  const task = () => notifyNewConverts(items, actorId, event).catch((err) => console.error('[ccg] leader sms failed:', err))
  try {
    after(task)
  } catch {
    void task()
  }
}
