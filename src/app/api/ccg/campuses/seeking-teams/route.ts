import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { campusSeekingTeams } from '@/lib/ccg/server/seekers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/campuses/seeking-teams — each campus's Sheep Seeking Admin and
 * Overseer: every campus for the central team, a campus's own for its Sheep
 * Seeking roles. `can_appoint` says whether the viewer appoints them.
 */
export const GET = withCcg({}, async ({ scope }) => {
  const seeking = scope.sheepSeeking()
  if (seeking.can('people.view') || scope.can('roles.manage')) {
    return success({ campuses: await campusSeekingTeams('all'), can_appoint: scope.can('roles.manage') })
  }
  const campuses = await prisma.ccgCampus.findMany({ where: { deletedAt: null }, select: { id: true } })
  const mine = campuses.filter((c) => seeking.canOnSeekingCampus('people.view', c.id)).map((c) => c.id)
  ensure(mine.length > 0, 'Campus Sheep Seeking teams are for the central team and campus Sheep Seeking roles')
  return success({ campuses: await campusSeekingTeams(mine), can_appoint: false })
})
