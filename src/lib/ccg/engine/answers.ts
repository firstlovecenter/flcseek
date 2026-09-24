import type { AnswerValue, EngineQuestion } from './types'

/**
 * Validate answers against the question bank. The single gate for answers
 * from staff, self-service forms and imports alike.
 *
 * Input is keyed by question key. `null` / `''` / `[]` clears an answer.
 * An option that has since been deactivated is accepted only if the person
 * already held it (so re-saving an old profile never fails).
 */

export interface ValidateOptions {
  kind: 'member' | 'convert'
  /** Enforce `required` questions (full submissions, not partial edits). */
  enforceRequired: boolean
  /** The person's current answers, keyed by question key. */
  previous?: Record<string, AnswerValue>
}

export interface ValidatedAnswers {
  ok: boolean
  /** Answers to write. */
  set: Record<string, AnswerValue>
  /** Question keys whose answer is cleared. */
  cleared: string[]
  /** Question key → message. `_unknown` lists keys not in the bank. */
  errors: Record<string, string>
}

export function questionAppliesTo(q: Pick<EngineQuestion, 'audience'>, kind: 'member' | 'convert'): boolean {
  return q.audience === 'both' || q.audience === kind
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
}

export function validateAnswers(
  questions: EngineQuestion[],
  input: Record<string, unknown>,
  opts: ValidateOptions
): ValidatedAnswers {
  const out: ValidatedAnswers = { ok: true, set: {}, cleared: [], errors: {} }
  const byKey = new Map(questions.map((q) => [q.key, q]))
  const fail = (key: string, msg: string) => {
    out.errors[key] = msg
    out.ok = false
  }

  const unknown = Object.keys(input).filter((k) => !byKey.has(k))
  if (unknown.length) fail('_unknown', `Unknown questions: ${unknown.join(', ')}`)

  for (const [key, raw] of Object.entries(input)) {
    const q = byKey.get(key)
    if (!q) continue
    if (!q.active) {
      fail(key, 'This question is no longer asked')
      continue
    }
    if (!questionAppliesTo(q, opts.kind)) {
      fail(key, `This question is not asked of ${opts.kind}s`)
      continue
    }
    if (isEmpty(raw)) {
      out.cleared.push(key)
      continue
    }

    const prev = opts.previous?.[key]
    const held = new Set(Array.isArray(prev) ? prev : typeof prev === 'string' ? [prev] : [])
    const optionOk = (k: string) => {
      const o = q.options.find((x) => x.key === k)
      return !!o && (o.active || held.has(k))
    }

    switch (q.type) {
      case 'single': {
        if (typeof raw !== 'string') fail(key, 'Choose one option')
        else if (!optionOk(raw)) fail(key, `"${raw}" is not an option`)
        else out.set[key] = raw
        break
      }
      case 'multi': {
        if (!Array.isArray(raw) || raw.some((x) => typeof x !== 'string')) {
          fail(key, 'Choose from the options')
          break
        }
        const picked = [...new Set(raw as string[])]
        const bad = picked.filter((k) => !optionOk(k))
        if (bad.length) fail(key, `Not options: ${bad.join(', ')}`)
        else if (q.maxChoices && picked.length > q.maxChoices) fail(key, `Choose at most ${q.maxChoices}`)
        else out.set[key] = picked
        break
      }
      case 'scale5': {
        const n = typeof raw === 'string' ? Number(raw) : raw
        if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 5) fail(key, 'Choose a number from 1 to 5')
        else out.set[key] = n
        break
      }
      case 'text': {
        if (typeof raw !== 'string') fail(key, 'Enter text')
        else if (raw.trim().length > 2000) fail(key, 'Keep this under 2000 characters')
        else out.set[key] = raw.trim()
        break
      }
    }
  }

  if (opts.enforceRequired) {
    for (const q of questions) {
      if (!q.active || !q.required || !questionAppliesTo(q, opts.kind)) continue
      const answered = q.key in out.set || (!(q.key in input) && !isEmpty(opts.previous?.[q.key]))
      if (!answered && !out.errors[q.key]) fail(q.key, 'This question is required')
    }
  }
  return out
}


/** Answers present for every active required question that applies. */
export function isProfileComplete(
  questions: EngineQuestion[],
  answers: Record<string, AnswerValue>,
  kind: 'member' | 'convert'
): boolean {
  return questions.every(
    (q) => !q.active || !q.required || !questionAppliesTo(q, kind) || !isEmpty(answers[q.key])
  )
}
