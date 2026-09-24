import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { created, success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { invalid } from '@/lib/ccg/errors'
import { METHODS_FOR_TYPE, optionSchema, questionSchema } from '@/lib/ccg/schemas'
import { logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { assertSignalRefs, serializeQuestion } from '@/lib/ccg/server/question-admin'
import { loadQuestionBank } from '@/lib/ccg/server/questions'
import { SIGNAL_TYPES } from '@/lib/ccg/engine/signals'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/questions?include_inactive=1 — the question bank with options. */
export const GET = withCcg({}, async ({ query }) => {
  const includeInactive = query.get('include_inactive') === '1'
  const rows = await prisma.ccgQuestion.findMany({
    where: includeInactive ? {} : { active: true },
    include: { options: includeInactive ? true : { where: { active: true } } },
    orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
  })
  return success({ questions: rows.map(serializeQuestion), methods_for_type: METHODS_FOR_TYPE, signal_types: SIGNAL_TYPES })
})

const createSchema = z.intersection(questionSchema, z.object({ options: z.array(optionSchema).max(100).default([]) }))

/** POST /api/ccg/questions (settings.manage) — a question with its options. */
export const POST = withCcg<z.infer<typeof createSchema>>(
  { permission: 'settings.manage', schema: createSchema },
  async ({ user, scope, body }) => {
    ensure(scope.can('settings.manage'))
    const isChoice = body.type === 'single' || body.type === 'multi'
    if (isChoice && body.options.length === 0) throw invalid('A choice question needs options')
    if (!isChoice && body.options.length) throw invalid(`A ${body.type} question has no options`)
    const keys = body.options.map((o) => o.key)
    if (new Set(keys).size !== keys.length) throw invalid('Option keys must be unique')

    const bank = await loadQuestionBank()
    for (const o of body.options) assertSignalRefs(o.signal, bank, body.method)

    const q = await prisma.ccgQuestion.create({
      data: {
        key: body.key,
        prompt: body.prompt,
        help: body.help ?? null,
        section: body.section ?? null,
        type: body.type,
        maxChoices: body.type === 'multi' ? body.max_choices ?? null : null,
        audience: body.audience,
        required: body.required,
        factor: body.factor,
        method: body.method,
        weight: body.weight,
        sortOrder: body.sort_order,
        active: body.active,
        options: {
          create: body.options.map((o, i) => ({
            key: o.key,
            label: o.label,
            catchAll: o.catch_all,
            signal: (o.signal ?? undefined) as Prisma.InputJsonValue | undefined,
            sortOrder: o.sort_order || i + 1,
            active: o.active,
          })),
        },
      },
    })
    await logCcg({ userId: user.id, action: 'QUESTION_CREATED', entityType: 'ccg_question', entityId: q.id, newValues: { key: body.key } })
    return created({ id: q.id })
  }
)
