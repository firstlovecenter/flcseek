import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { invalid, notFound } from '@/lib/ccg/errors'
import { METHODS_FOR_TYPE, questionUpdateSchema } from '@/lib/ccg/schemas'
import { logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { serializeQuestion } from '@/lib/ccg/server/question-admin'

export const dynamic = 'force-dynamic'
type P = { id: string }

/** GET /api/ccg/questions/[id] */
export const GET = withCcg<undefined, P>({}, async ({ params }) => {
  const q = await prisma.ccgQuestion.findUnique({ where: { id: params.id }, include: { options: true } })
  if (!q) throw notFound('Question')
  return success({ question: serializeQuestion(q) })
})

/**
 * PATCH /api/ccg/questions/[id] (settings.manage). The key and type are fixed
 * once created — answers depend on them. Deactivate instead of deleting.
 */
export const PATCH = withCcg<z.infer<typeof questionUpdateSchema>, P>(
  { permission: 'settings.manage', schema: questionUpdateSchema },
  async ({ user, scope, body, params }) => {
    ensure(scope.can('settings.manage'))
    const before = await prisma.ccgQuestion.findUnique({ where: { id: params.id }, include: { options: true } })
    if (!before) throw notFound('Question')

    const factor = body.factor ?? before.factor
    const method = body.method ?? before.method
    if ((factor === 'none') !== (method === 'none')) throw invalid('Set both a factor and a method, or neither')
    if (!METHODS_FOR_TYPE[before.type]?.includes(method)) throw invalid(`A ${before.type} question cannot use "${method}"`)
    if (method === 'preference' && before.options.some((o) => o.active && !o.signal)) {
      throw invalid('Give every active option a signal before scoring this as a preference')
    }

    await prisma.ccgQuestion.update({
      where: { id: params.id },
      data: {
        ...(body.prompt !== undefined ? { prompt: body.prompt } : {}),
        ...(body.help !== undefined ? { help: body.help } : {}),
        ...(body.section !== undefined ? { section: body.section } : {}),
        ...(body.max_choices !== undefined ? { maxChoices: before.type === 'multi' ? body.max_choices : null } : {}),
        ...(body.audience !== undefined ? { audience: body.audience } : {}),
        ...(body.required !== undefined ? { required: body.required } : {}),
        ...(body.factor !== undefined ? { factor: body.factor } : {}),
        ...(body.method !== undefined ? { method: body.method } : {}),
        ...(body.weight !== undefined ? { weight: body.weight } : {}),
        ...(body.sort_order !== undefined ? { sortOrder: body.sort_order } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        updatedAt: new Date(),
      },
    })
    await logCcg({ userId: user.id, action: 'QUESTION_UPDATED', entityType: 'ccg_question', entityId: params.id, newValues: body })
    return success({ id: params.id })
  }
)
