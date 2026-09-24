import type { Prisma } from '@prisma/client'
import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { ccgConfigSchema, DEFAULT_CCG_CONFIG, FACTOR_LABELS, type CcgConfig } from '@/lib/ccg/engine'
import { getCcgConfig, logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/settings — effective matching config, defaults and factor labels. */
export const GET = withCcg({}, async () =>
  success({ config: await getCcgConfig(), defaults: DEFAULT_CCG_CONFIG, factor_labels: FACTOR_LABELS })
)

/** PUT /api/ccg/settings — replace the matching config (weights must total 100). */
export const PUT = withCcg<CcgConfig>({ permission: 'settings.manage', schema: ccgConfigSchema }, async ({ user, scope, body }) => {
  ensure(scope.can('settings.manage'))
  const before = await getCcgConfig()
  const config = { ...body, ageBands: [...body.ageBands].sort((a, b) => a.maxDiff - b.maxDiff) }
  await prisma.ccgSettings.upsert({
    where: { id: 1 },
    create: { id: 1, config: config as unknown as Prisma.InputJsonValue, updatedBy: user.id },
    update: { config: config as unknown as Prisma.InputJsonValue, updatedBy: user.id, updatedAt: new Date() },
  })
  await logCcg({ userId: user.id, action: 'SETTINGS_UPDATED', entityType: 'ccg_settings', oldValues: before, newValues: config })
  return success({ config })
})
