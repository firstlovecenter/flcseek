import { createHash, randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { questionAppliesTo, type AnswerValue } from '../engine'
import { CcgError, conflict, invalid, notFound } from '../errors'
import type { PublicSubmission } from '../schemas'
import { dateOnly, iso, logCcg } from './common'
import { createPerson, updatePerson } from './people'
import { loadAnswers, loadQuestionBank } from './questions'

/**
 * Self-service links. The token is 32 random bytes, shown once on creation and
 * stored only as a SHA-256 hash. Links can expire, be capped and be revoked.
 *
 *  member_ccf      → creates a *pending* member of that CCF
 *  convert_intake  → creates a convert and triggers matching
 *  person_update   → lets one person complete / change their own profile
 */

export type LinkKind = 'member_ccf' | 'convert_intake' | 'person_update'

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
export const newToken = () => randomBytes(32).toString('base64url')

/** Public self-registration page for a token (no login; outside the /ccg area). */
export const linkPath = (token: string) => `/join/${token}`

function hashIp(ip: string): string {
  return createHash('sha256').update(`${ip}:${process.env.JWT_SECRET ?? 'ccg'}`).digest('hex')
}

type LinkRow = Prisma.CcgFormLinkGetPayload<{ include: { ccf: { include: { ccg: true } }; stream: true; person: true } }>

export function linkState(l: { revokedAt: Date | null; expiresAt: Date | null; maxUses: number | null; uses: number }, now = new Date()) {
  if (l.revokedAt) return 'revoked'
  if (l.expiresAt && l.expiresAt <= now) return 'expired'
  if (l.maxUses !== null && l.uses >= l.maxUses) return 'used_up'
  return 'active'
}

export function serializeLink(l: LinkRow) {
  return {
    id: l.id,
    kind: l.kind,
    label: l.label,
    ccf: l.ccf ? { id: l.ccf.id, code: l.ccf.code, name: l.ccf.name, ccg: { id: l.ccf.ccg.id, name: l.ccf.ccg.name } } : null,
    stream: l.stream ? { id: l.stream.id, code: l.stream.code, name: l.stream.name } : null,
    person: l.person ? { id: l.person.id, full_name: l.person.fullName } : null,
    state: linkState(l),
    expires_at: iso(l.expiresAt),
    max_uses: l.maxUses,
    uses: l.uses,
    revoked_at: iso(l.revokedAt),
    created_at: iso(l.createdAt),
  }
}

export const linkInclude = { ccf: { include: { ccg: true } }, stream: true, person: true } as const

export async function createLink(args: {
  kind: LinkKind
  ccfId?: string
  streamId?: string | null
  personId?: string
  label?: string | null
  expiresAt?: Date | null
  maxUses?: number | null
  actorId: string
}) {
  if (args.kind === 'member_ccf') {
    if (!args.ccfId) throw invalid('Choose the CCF this link registers members into')
    const f = await prisma.ccgFamily.findFirst({ where: { id: args.ccfId, deletedAt: null } })
    if (!f) throw notFound('CCF')
  }
  if (args.kind === 'convert_intake' && args.streamId) {
    const s = await prisma.ccgStream.findFirst({ where: { id: args.streamId, deletedAt: null } })
    if (!s) throw notFound('Stream')
  }
  if (args.kind === 'person_update') {
    if (!args.personId) throw invalid('Choose the person this link is for')
    const p = await prisma.ccgPerson.findFirst({ where: { id: args.personId, deletedAt: null } })
    if (!p) throw notFound('Person')
  }
  const token = newToken()
  const link = await prisma.ccgFormLink.create({
    data: {
      kind: args.kind,
      ccfId: args.kind === 'member_ccf' ? args.ccfId! : null,
      streamId: args.kind === 'convert_intake' ? args.streamId ?? null : null,
      personId: args.kind === 'person_update' ? args.personId! : null,
      label: args.label ?? null,
      tokenHash: hashToken(token),
      expiresAt: args.expiresAt ?? null,
      maxUses: args.kind === 'person_update' ? args.maxUses ?? 5 : args.maxUses ?? null,
      createdBy: args.actorId,
    },
    include: linkInclude,
  })
  await logCcg({ userId: args.actorId, action: 'LINK_CREATED', entityType: 'ccg_form_link', entityId: link.id, newValues: { kind: args.kind } })
  // The token is returned once, here, and never again.
  return { link: serializeLink(link), token, path: linkPath(token) }
}

export async function revokeLink(id: string, actorId: string) {
  const l = await prisma.ccgFormLink.findUnique({ where: { id } })
  if (!l) throw notFound('Link')
  if (!l.revokedAt) {
    await prisma.ccgFormLink.update({ where: { id }, data: { revokedAt: new Date() } })
    await logCcg({ userId: actorId, action: 'LINK_REVOKED', entityType: 'ccg_form_link', entityId: id })
  }
}

const GONE = () => new CcgError('not_found', 'This link is no longer valid. Ask for a new one.')

async function resolveToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw GONE()
  const l = await prisma.ccgFormLink.findUnique({ where: { tokenHash: hashToken(token) }, include: linkInclude })
  if (!l || linkState(l) !== 'active') throw GONE()
  if (l.ccf && (l.ccf.deletedAt || l.ccf.ccg.deletedAt)) throw GONE()
  if (l.person && l.person.deletedAt) throw GONE()
  return l
}

// ---------------------------------------------------------------------------
// Public form definition
// ---------------------------------------------------------------------------

const CORE_FIELDS: Record<LinkKind, Array<{ key: string; label: string; type: string; required: boolean }>> = {
  convert_intake: [
    { key: 'first_name', label: 'First name', type: 'text', required: true },
    { key: 'middle_name', label: 'Middle name', type: 'text', required: false },
    { key: 'last_name', label: 'Last name', type: 'text', required: true },
    { key: 'phone', label: 'Phone number', type: 'tel', required: true },
    { key: 'email', label: 'Email', type: 'email', required: false },
    { key: 'gender', label: 'Gender', type: 'gender', required: false },
    { key: 'date_of_birth', label: 'Date of birth', type: 'date', required: false },
    { key: 'landmark', label: 'Nearest landmark', type: 'text', required: false },
    { key: 'existing_connection_note', label: 'Do you already know someone in church? Who?', type: 'text', required: false },
  ],
  member_ccf: [
    { key: 'first_name', label: 'First name', type: 'text', required: true },
    { key: 'middle_name', label: 'Middle name', type: 'text', required: false },
    { key: 'last_name', label: 'Last name', type: 'text', required: true },
    { key: 'phone', label: 'Phone number', type: 'tel', required: true },
    { key: 'email', label: 'Email', type: 'email', required: true },
    { key: 'gender', label: 'Gender', type: 'gender', required: false },
    { key: 'date_of_birth', label: 'Date of birth', type: 'date', required: false },
    { key: 'landmark', label: 'Nearest landmark', type: 'text', required: false },
  ],
  person_update: [
    { key: 'phone', label: 'Phone number', type: 'tel', required: false },
    { key: 'email', label: 'Email', type: 'email', required: false },
    { key: 'gender', label: 'Gender', type: 'gender', required: false },
    { key: 'date_of_birth', label: 'Date of birth', type: 'date', required: false },
    { key: 'landmark', label: 'Nearest landmark', type: 'text', required: false },
  ],
}

function audienceOf(l: LinkRow): 'member' | 'convert' {
  if (l.kind === 'member_ccf') return 'member'
  if (l.kind === 'convert_intake') return 'convert'
  return l.person!.kind === 'member' ? 'member' : 'convert'
}

export async function getPublicForm(token: string) {
  const l = await resolveToken(token)
  const kind = l.kind as LinkKind
  const audience = audienceOf(l)
  const bank = await loadQuestionBank()

  let prefill: { person: Record<string, unknown>; answers: Record<string, AnswerValue> } | undefined
  if (kind === 'person_update') {
    const p = l.person!
    prefill = {
      person: {
        full_name: p.fullName,
        phone: p.phone,
        email: p.email,
        gender: p.gender,
        date_of_birth: dateOnly(p.dateOfBirth),
        landmark: p.landmark,
      },
      answers: (await loadAnswers([p.id], bank)).get(p.id) ?? {},
    }
  }

  return {
    kind,
    audience,
    title:
      kind === 'member_ccf'
        ? `Join ${l.ccf!.name}`
        : kind === 'convert_intake'
          ? 'Welcome! Tell us about yourself'
          : 'Update your details',
    ccf: l.ccf ? { name: l.ccf.name, ccg_name: l.ccf.ccg.name } : null,
    fields: CORE_FIELDS[kind],
    questions: bank.rows
      .filter((q) => q.active && questionAppliesTo({ audience: q.audience as 'member' | 'convert' | 'both' }, audience))
      .map((q) => ({
        key: q.key,
        prompt: q.prompt,
        help: q.help,
        section: q.section,
        type: q.type,
        max_choices: q.maxChoices,
        required: q.required,
        options: q.options
          .filter((o) => o.active)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((o) => ({ key: o.key, label: o.label })),
      })),
    ...(prefill ? { prefill } : {}),
  }
}

// ---------------------------------------------------------------------------
// Public submission
// ---------------------------------------------------------------------------

const reference = (personId: string) => personId.slice(0, 8).toUpperCase()

/** Atomically take one use of the link; false when it is no longer usable. */
async function consumeUse(linkId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE ccg_form_links SET uses = uses + 1
    WHERE id = ${linkId}::uuid
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (max_uses IS NULL OR uses < max_uses)
    RETURNING id`
  return rows.length > 0
}

async function releaseUse(linkId: string) {
  await prisma.$executeRaw`UPDATE ccg_form_links SET uses = GREATEST(uses - 1, 0) WHERE id = ${linkId}::uuid`
}

export async function submitPublicForm(
  token: string,
  body: PublicSubmission,
  client: { ip: string; userAgent: string | null }
) {
  const l = await resolveToken(token)
  const kind = l.kind as LinkKind

  // Idempotency: a retried submission returns the original result.
  const prior = await prisma.ccgSubmission.findUnique({ where: { clientSubmissionId: body.client_submission_id } })
  if (prior) {
    if (prior.linkId !== l.id) throw conflict('Duplicate submission id')
    return { ok: true, reference: prior.personId ? reference(prior.personId) : null, duplicate_submission: true }
  }

  if (kind !== 'person_update' && (!body.person.first_name || !body.person.last_name || !body.person.phone)) {
    throw invalid('First name, last name and phone number are required')
  }
  // Members may be made leaders; their invitation is emailed.
  if (kind === 'member_ccf' && !body.person.email) throw invalid('Email is required')

  if (!(await consumeUse(l.id))) throw GONE()
  let submissionId: string
  try {
    submissionId = (
      await prisma.ccgSubmission.create({
        data: {
          linkId: l.id,
          clientSubmissionId: body.client_submission_id,
          ipHash: hashIp(client.ip),
          userAgent: client.userAgent?.slice(0, 300) ?? null,
        },
      })
    ).id
  } catch (err) {
    await releaseUse(l.id)
    // A concurrent retry won the race: report its outcome.
    const winner = await prisma.ccgSubmission.findUnique({ where: { clientSubmissionId: body.client_submission_id } })
    if (winner) return { ok: true, reference: winner.personId ? reference(winner.personId) : null, duplicate_submission: true }
    throw err
  }

  try {
    let personId: string
    if (kind === 'person_update') {
      personId = l.personId!
      // A person updating their own details cannot change their name here.
      const { first_name: _f, middle_name: _m, last_name: _l, ...core } = body.person
      await updatePerson(personId, { ...core, answers: body.answers }, { actorId: null, source: 'self' })
    } else {
      const { person } = await createPerson({
        kind: kind === 'member_ccf' ? 'member' : 'convert',
        core: {
          ...body.person,
          first_name: body.person.first_name!,
          last_name: body.person.last_name!,
          ccf_id: l.ccfId ?? undefined,
          // An intake link registers converts into its stream.
          stream_id: kind === 'convert_intake' ? l.streamId : undefined,
        },
        answers: body.answers,
        source: 'self',
        actorId: null,
        memberStatus: 'pending',
      })
      personId = person.id
    }
    await prisma.ccgSubmission.update({ where: { id: submissionId }, data: { personId } })
    return { ok: true, reference: reference(personId) }
  } catch (err) {
    await prisma.ccgSubmission.delete({ where: { id: submissionId } }).catch(() => {})
    await releaseUse(l.id)
    throw err
  }
}
