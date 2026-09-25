export type UnitKind = 'campus' | 'stream' | 'council' | 'ccg' | 'ccf'

/** API collection for each level (create with POST, edit with PATCH /[id]). */
export const UNIT_PATH: Record<UnitKind, string> = {
  campus: '/campuses',
  stream: '/streams',
  council: '/councils',
  ccg: '/ccgs',
  ccf: '/ccfs',
}
