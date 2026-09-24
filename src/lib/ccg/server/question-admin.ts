import type { Prisma } from '@prisma/client'
import type { Signal } from '../engine'
import { invalid } from '../errors'
import type { QuestionBank } from './questions'

type QuestionRow = Prisma.CcgQuestionGetPayload<{ include: { options: true } }>

export function serializeQuestion(q: QuestionRow) {
  return {
    id: q.id,
    key: q.key,
    prompt: q.prompt,
    help: q.help,
    section: q.section,
    type: q.type,
    max_choices: q.maxChoices,
    audience: q.audience,
    required: q.required,
    factor: q.factor,
    method: q.method,
    weight: Number(q.weight),
    sort_order: q.sortOrder,
    active: q.active,
    options: [...q.options]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((o) => ({
        id: o.id,
        key: o.key,
        label: o.label,
        catch_all: o.catchAll,
        signal: o.signal,
        sort_order: o.sortOrder,
        active: o.active,
      })),
  }
}

/**
 * A signal must point at things that exist: questions of the right type and
 * their options. Caught here rather than silently scoring zero.
 */
export function assertSignalRefs(signal: Signal | null | undefined, bank: QuestionBank, questionMethod: string) {
  if (!signal) {
    if (questionMethod === 'preference') throw invalid('Preference options need a signal (what the group must show)')
    return
  }
  if (questionMethod !== 'preference') throw invalid('Only preference questions use signals')
  const q = (key: string) => bank.rows.find((r) => r.key === key)
  switch (signal.type) {
    case 'option_share':
      for (const ref of signal.refs) {
        const [qk, ok] = ref.split(':')
        const target = q(qk)
        if (!target || !['single', 'multi'].includes(target.type)) throw invalid(`Signal refers to unknown choice question "${qk}"`)
        if (!target.options.some((o) => o.key === ok)) throw invalid(`Signal refers to unknown option "${ref}"`)
      }
      return
    case 'trait':
      for (const key of signal.questions) {
        const target = q(key)
        if (!target || target.type !== 'scale5') throw invalid(`Signal refers to unknown scale question "${key}"`)
      }
      return
    case 'same_answer': {
      const target = q(signal.question)
      if (!target || target.type !== 'single') throw invalid(`Signal refers to unknown single-choice question "${signal.question}"`)
      return
    }
    default:
      return
  }
}
