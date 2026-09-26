import { describe, it, expect } from 'vitest'
import { resolveCcgScope, type AssignmentGrant, type Hierarchy } from '@/lib/ccg/scope'

// Stream S1 → CCGs G1, G2 → CCFs F1, F2 (G1), F3 (G2).  CCG G3 is in stream S9 → F4.
const hierarchy: Hierarchy = {
  ccgs: [
    { id: 'G1', streamId: 'S1' },
    { id: 'G2', streamId: 'S1' },
    { id: 'G3', streamId: 'S9' },
  ],
  ccfs: [
    { id: 'F1', ccgId: 'G1' },
    { id: 'F2', ccgId: 'G1' },
    { id: 'F3', ccgId: 'G2' },
    { id: 'F4', ccgId: 'G3' },
  ],
}

// Mirrors the seeded roles in migration 020.
const ROLES = {
  ccg_admin: { level: 'global', perms: ['structure.manage', 'people.view', 'people.manage', 'placements.approve', 'milestones.update', 'settings.manage', 'roles.manage'] },
  overseer: { level: 'stream', perms: ['people.view', 'placements.view', 'reports.view'] },
  ccg_governor: { level: 'ccg', perms: ['units.edit', 'people.view', 'people.manage', 'members.confirm', 'links.manage', 'milestones.update'] },
  ccf_coordinator: { level: 'ccf', perms: ['people.view', 'people.manage', 'members.confirm', 'links.manage', 'milestones.update'] },
} as const

function grant(role: keyof typeof ROLES, unit?: string): AssignmentGrant {
  const r = ROLES[role]
  return {
    roleKey: role,
    scopeLevel: r.level,
    permissions: [...r.perms],
    streamId: r.level === 'stream' ? unit ?? null : null,
    ccgId: r.level === 'ccg' ? unit ?? null : null,
    ccfId: r.level === 'ccf' ? unit ?? null : null,
  }
}

const scope = (...g: AssignmentGrant[]) => resolveCcgScope(g, hierarchy)

describe('resolveCcgScope', () => {
  it('CCF Coordinator: only their own CCF', () => {
    const s = scope(grant('ccf_coordinator', 'F1'))
    expect(s.canOnCcf('people.manage', 'F1')).toBe(true)
    expect(s.canOnCcf('people.manage', 'F2')).toBe(false)
    expect(s.canOnCcg('people.manage', 'G1')).toBe(false)
    expect(s.ccfIds('milestones.update')).toEqual(['F1'])
    expect(s.can('placements.approve')).toBe(false)
  })

  it('CCG Governor: every CCF in their CCG, nothing else', () => {
    const s = scope(grant('ccg_governor', 'G1'))
    expect(s.ccfIds('people.manage')).toEqual(['F1', 'F2'])
    expect(s.canOnCcf('units.edit', 'F3')).toBe(false)
    expect(s.canOnCcg('units.edit', 'G1')).toBe(true)
  })

  it('Overseer: every CCG and CCF in the stream, view only', () => {
    const s = scope(grant('overseer', 'S1'))
    expect(s.canOnCcf('milestones.update', 'F1')).toBe(false)
    expect(s.ccfIds('people.view')).toEqual(['F1', 'F2', 'F3'])
    expect(s.ccgIds('reports.view')).toEqual(['G1', 'G2'])
    expect(s.canOnCcf('people.manage', 'F1')).toBe(false)
    expect(s.canOnCcf('people.view', 'F4')).toBe(false)
  })

  it('Admin: everything, everywhere', () => {
    const s = scope(grant('ccg_admin'))
    expect(s.can('placements.approve')).toBe(true)
    expect(s.ccfIds('people.view')).toBe('all')
    expect(s.canOnCcf('people.manage', 'F4')).toBe(true)
  })

  it('several roles combine', () => {
    const s = scope(grant('ccf_coordinator', 'F4'), grant('overseer', 'S1'))
    expect(s.ccfIds('people.view')).toEqual(['F1', 'F2', 'F3', 'F4'])
    expect(s.ccfIds('people.manage')).toEqual(['F4'])
    expect(s.roleKeys).toEqual(['ccf_coordinator', 'overseer'])
  })

  it('no assignments and mis-scoped assignments grant nothing', () => {
    expect(scope().ccfIds('people.view')).toEqual([])
    const bad = { ...grant('ccf_coordinator'), ccfId: null }
    expect(scope(bad).anywhere.size).toBe(0)
    expect(scope({ ...grant('ccf_coordinator', 'F1'), permissions: ['not.a.permission'] }).anywhere.size).toBe(0)
  })

  it('a stream-level role covers every CCG and CCF in the stream', () => {
    const s = resolveCcgScope(
      [{ roleKey: 'stream_lead', scopeLevel: 'stream', permissions: ['people.view'], streamId: 'S1', ccgId: null, ccfId: null }],
      hierarchy
    )
    expect(s.canOnStream('people.view', 'S1')).toBe(true)
    expect(s.ccgIds('people.view')).toEqual(['G1', 'G2'])
    expect(s.ccfIds('people.view')).toEqual(['F1', 'F2', 'F3'])
    expect(s.canOnCcf('people.view', 'F4')).toBe(false) // G3 is in another stream
    expect(s.streamIds('people.view')).toEqual(['S1'])
    expect(s.streamIds('people.manage')).toEqual([])
  })

  it('unknown units are never matched', () => {
    const s = scope(grant('ccg_governor', 'G1'))
    expect(s.canOnCcf('people.view', 'F-unknown')).toBe(false)
    expect(s.canOnCcf('people.view', null)).toBe(false)
  })
})

describe('campuses and sheep seeking roles', () => {
  // Campus C1 → streams S1, S2; S1 → G1, G2 → F1..F3. S9 (G3 → F4) has no campus.
  const tree: Hierarchy = {
    ...hierarchy,
    streams: [
      { id: 'S1', campusId: 'C1' },
      { id: 'S2', campusId: 'C1' },
      { id: 'S9', campusId: null },
    ],
  }
  const at = (roleKey: string, level: 'campus' | 'stream', unit: string, perms: string[]): AssignmentGrant => ({
    roleKey,
    scopeLevel: level,
    permissions: perms,
    campusId: level === 'campus' ? unit : null,
    streamId: level === 'stream' ? unit : null,
    ccgId: null,
    ccfId: null,
  })

  it('Campus Leader: every stream in the campus, down to its CCFs and members', () => {
    const s = resolveCcgScope([at('campus_leader', 'campus', 'C1', ['people.view', 'reports.view'])], tree)
    expect(s.canOnCampus('people.view', 'C1')).toBe(true)
    expect(s.canOnStream('people.view', 'S2')).toBe(true)
    expect(s.canOnStream('people.view', 'S9')).toBe(false)
    expect(s.canOnCcf('people.view', 'F3')).toBe(true)
    expect(s.canOnMembersOf('people.view', 'F3')).toBe(true)
    expect(s.canOnCcf('people.view', 'F4')).toBe(false)
    expect([...(s.streamIds('reports.view') as string[])].sort()).toEqual(['S1', 'S2'])
    expect(s.canOnStream('people.manage', 'S1')).toBe(false) // view only
  })

  it('Sheep seeking roles reach a stream’s converts but not its CCF members', () => {
    const s = resolveCcgScope([at('sheep_seeker', 'stream', 'S1', ['people.view', 'milestones.update', 'placements.approve'])], tree, { seekingGroupIds: ['SG1'] })
    // CCGs and CCFs are not theirs: they only place converts into the stream's CCFs.
    expect(s.canOnCcf('people.view', 'F1')).toBe(false)
    expect(s.canOnCcg('people.view', 'G1')).toBe(false)
    expect(s.ccfIds('people.view')).toEqual([])
    expect(s.canPlaceInto('placements.approve', 'F1')).toBe(true)
    expect(s.canPlaceInto('placements.approve', 'F4')).toBe(false) // another stream
    expect(s.canOnStream('people.view', 'S1')).toBe(true) // the stream's converts
    expect(s.canOnMembersOf('people.view', 'F1')).toBe(false)
    expect(s.memberCcfIds('people.view')).toEqual([])
    expect(s.seekingGroupIds).toEqual(['SG1'])
    expect(s.canOnSeekingGroup('milestones.update', 'SG1')).toBe(true) // converts in their groups
    expect(s.canOnSeekingGroup('milestones.update', 'SG2')).toBe(false)
    expect(s.canOnSeekingGroup('structure.manage', 'SG1')).toBe(false)
    // Also a CCF Coordinator: members of their own CCF only.
    const both = resolveCcgScope([at('sheep_seeker', 'stream', 'S1', ['people.view']), grant('ccf_coordinator', 'F2')], tree)
    expect(both.canOnMembersOf('people.view', 'F2')).toBe(true)
    expect(both.canOnMembersOf('people.view', 'F1')).toBe(false)
  })

  it('each side sees only its own: an Overseer never reaches the Sheep Seeking side, a Sheep Seeker never the City Church Groups side', () => {
    const overseer = resolveCcgScope([grant('overseer', 'S1')], tree)
    expect(overseer.leadership().canOnStream('people.view', 'S1')).toBe(true)
    expect(overseer.sheepSeeking().canOnStream('people.view', 'S1')).toBe(false)
    expect(overseer.sheepSeeking().streamIds('people.view')).toEqual([])

    const seeker = resolveCcgScope([at('sheep_seeker', 'stream', 'S1', ['people.view'])], tree)
    expect(seeker.sheepSeeking().canOnStream('people.view', 'S1')).toBe(true)
    expect(seeker.leadership().canOnStream('people.view', 'S1')).toBe(false)
    expect(seeker.leadership().ccgIds('people.view')).toEqual([])

    // The stream's Sheep Seeking Overseer approves placements into the stream's CCFs without seeing inside them.
    const ssOverseer = resolveCcgScope([at('seeking_overseer', 'stream', 'S1', ['people.view', 'placements.view', 'placements.approve'])], tree)
    expect(ssOverseer.canOnStream('placements.approve', 'S1')).toBe(true)
    expect(ssOverseer.canPlaceInto('placements.approve', 'F3')).toBe(true)
    expect(ssOverseer.canPlaceInto('placements.approve', 'F4')).toBe(false)
    expect(ssOverseer.canOnCcf('people.view', 'F3')).toBe(false)

    // A Campus Leader runs both sides of their campus.
    const campus = resolveCcgScope([at('campus_leader', 'campus', 'C1', ['people.view'])], tree)
    expect(campus.sheepSeeking().canOnStream('people.view', 'S1')).toBe(true)
    expect(campus.leadership().canOnStream('people.view', 'S1')).toBe(true)
  })
})
