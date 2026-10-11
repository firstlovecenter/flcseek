import { invalid } from '../errors'
import type { CcgScope } from '../scope'
import { isAdminLevel, type AdminLevel } from './roles'

/** The unit's leader, the leaders above it (a grant covers what is beneath it), or the central team. */
export function canAppointAdmins(scope: CcgScope, level: AdminLevel, id: string) {
  const lead = scope.leadership()
  const here =
    level === 'stream' ? lead.canOnStream('admins.appoint', id) : level === 'council' ? lead.canOnCouncil('admins.appoint', id) : lead.canOnCcg('admins.appoint', id)
  return scope.can('roles.manage') || here
}

export function adminLevel(type: string): AdminLevel {
  if (!isAdminLevel(type)) throw invalid('Only streams, councils and CCGs have admins')
  return type
}
