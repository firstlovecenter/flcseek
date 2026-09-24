import type { z } from 'zod'
import { Prisma } from '@prisma/client'
import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/ccg/errors'
import { optionUpdateSchema } from '@/lib/ccg/schemas'
import { logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { assertSignalRefs } from '@/lib/ccg/server/question-admin'
import { loadQuestionBank } from '@/lib/ccg/server/questions'

export const dynamic = 'force-dynamic'
type P = { id: string; optionId: string }

/**
 * PATCH /api/ccg/questions/[id]/options/[optionId] (settings.manage).
 * The key is fixed — answers store it. Relabel freely; deactivate to retire
 * an option (people who chose it keep it).
 */
export const PATCH = withCcg<z.infer<typeof optionUpdateSchema>, P>(
  { permission: 'settings.manage', schema: optionUpdateSchema },
  async ({ user, scope, body, params }) => {
    ensure(scope.can('settings.manage'))
    const o = await prisma.ccgQuestionOption.findFirst({
      where: { id: params.optionId, questionId: params.id },
      include: { question: true },
    })
    if (!o) throw notFound('Option')
    if (body.signal !== undefined) assertSignalRefs(body.signal, await loadQuestionBank(), o.question.method)
    await prisma.ccgQuestionOption.update({
      where: { id: o.id },
      data: {
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.catch_all !== undefined ? { catchAll: body.catch_all } : {}),
        ...(body.signal !== undefined ? { signal: body.signal === null ? Prisma.DbNull : body.signal } : {}),
        ...(body.sort_order !== undefined ? { sortOrder: body.sort_order } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
    })
    await logCcg({ userId: user.id, action: 'OPTION_UPDATED', entityType: 'ccg_question', entityId: params.id, newValues: { option: o.key, ...body } })
    return success({ id: o.id })
  }
)
