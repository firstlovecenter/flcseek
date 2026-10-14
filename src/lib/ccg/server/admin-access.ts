import { prisma } from '@/lib/prisma'
import { invalid, notFound } from '../errors'
import type { Permission } from '../permissions'
import type { CcgScope } from '../scope'
import { isAdminLevel, type AdminLevel, type LeaderLevel } from './roles'

/** The unit's leader, the leaders above it (a grant covers what is beneath it), or the central team. */
export function canAppointAdmins(scope: CcgScope, level: AdminLevel, id: string) {
  const lead = scope.leadership()
  const here =
    level === 'campus'
      ? lead.canOnCampus('admins.appoint', id)
      : level === 'stream'
        ? lead.canOnStream('admins.appoint', id)
        : level === 'council'
          ? lead.canOnCouncil('admins.appoint', id)
          : lead.canOnCcg('admins.appoint', id)
  return scope.can('roles.manage') || here
}

/**
 * Who changes a unit's leader: the leaders and admins of the units above it
 * (leaders.appoint on its parent, so nobody changes their own unit's leader),
 * or the central team. A campus has no parent: only the central team.
 */
export async function canSetLeader(scope: CcgScope, level: LeaderLevel, id: string) {
  if (scope.can('roles.manage')) return true
  const lead = scope.leadership()
  const where = { id, deletedAt: null }
  switch (level) {
    case 'campus':
      return false
    case 'stream': {
      const s = await prisma.ccgStream.findFirst({ where, select: { campusId: true } })
      if (!s) throw notFound('Stream')
      return lead.canOnCampus('leaders.appoint', s.campusId)
    }
    case 'council': {
      const c = await prisma.ccgCouncil.findFirst({ where, select: { streamId: true } })
      if (!c) throw notFound('Council')
      return lead.canOnStream('leaders.appoint', c.streamId)
    }
    case 'ccg': {
      const g = await prisma.ccgGroup.findFirst({ where, select: { councilId: true, streamId: true } })
      if (!g) throw notFound('CCG')
      return g.councilId ? lead.canOnCouncil('leaders.appoint', g.councilId) : lead.canOnStream('leaders.appoint', g.streamId)
    }
    case 'ccf': {
      const f = await prisma.ccgFamily.findFirst({ where, select: { ccgId: true } })
      if (!f) throw notFound('CCF')
      return lead.canOnCcg('leaders.appoint', f.ccgId)
    }
  }
}

type UnitLevel = LeaderLevel

/** `perm` on a unit, counting City Church Groups roles only (a grant covers what is beneath it). */
function leadsUnit(scope: CcgScope, perm: Permission, level: UnitLevel, id: string | null | undefined) {
  const lead = scope.leadership()
  switch (level) {
    case 'campus':
      return lead.canOnCampus(perm, id)
    case 'stream':
      return lead.canOnStream(perm, id)
    case 'council':
      return lead.canOnCouncil(perm, id)
    case 'ccg':
      return lead.canOnCcg(perm, id)
    case 'ccf':
      return lead.canOnCcf(perm, id)
  }
}

/**
 * Who adds units inside this one and edits its details (and those beneath it):
 * its admins and the admins above it (units.edit; leaders only view), or the central team.
 * Moving a unit to another parent, deleting it, and campuses stay with the central team.
 */
export function canBuildIn(scope: CcgScope, level: UnitLevel, id: string | null | undefined) {
  return scope.can('structure.manage') || (!!id && leadsUnit(scope, 'units.edit', level, id))
}

/** Who names the leader of a unit added inside this one: leaders.appoint here, or the central team. */
export function canLeadBeneath(scope: CcgScope, level: UnitLevel, id: string | null | undefined) {
  return scope.can('roles.manage') || (!!id && leadsUnit(scope, 'leaders.appoint', level, id))
}

export function adminLevel(type: string): AdminLevel {
  if (!isAdminLevel(type)) throw invalid('Only campuses, streams, councils and CCGs have admins')
  return type
}
