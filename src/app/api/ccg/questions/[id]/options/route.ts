import type { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { created } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { invalid, notFound } from '@/lib/ccg/errors'
import { optionSchema } from '@/lib/ccg/schemas'
import { logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { assertSignalRefs } from '@/lib/ccg/server/question-admin'
import { loadQuestionBank } from '@/lib/ccg/server/questions'

export const dynamic = 'force-dynamic'

/** POST /api/ccg/questions/[id]/options (settings.manage) — add an option. */
export const POST = withCcg<z.infer<typeof optionSchema>, { id: string }>(
  { permission: 'settings.manage', schema: optionSchema },
  async ({ user, scope, body, params }) => {
    ensure(scope.can('settings.manage'))
    const q = await prisma.ccgQuestion.findUnique({ where: { id: params.id }, include: { options: true } })
    if (!q) throw notFound('Question')
    if (q.type !== 'single' && q.type !== 'multi') throw invalid('Only choice questions have options')
    assertSignalRefs(body.signal, await loadQuestionBank(), q.method)
    const o = await prisma.ccgQuestionOption.create({
      data: {
        questionId: q.id,
        key: body.key,
        label: body.label,
        catchAll: body.catch_all,
        signal: (body.signal ?? undefined) as Prisma.InputJsonValue | undefined,
        sortOrder: body.sort_order || q.options.length + 1,
        active: body.active,
      },
    })
    await logCcg({ userId: user.id, action: 'OPTION_CREATED', entityType: 'ccg_question', entityId: q.id, newValues: { key: body.key } })
    return created({ id: o.id })
  }
)
