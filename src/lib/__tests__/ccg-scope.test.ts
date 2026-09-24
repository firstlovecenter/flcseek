import { describe, it, expect } from 'vitest'
import { resolveCcgScope, type AssignmentGrant, type Hierarchy } from '@/lib/ccg/scope'

// Council K1 → CCGs G1, G2 → CCFs F1, F2 (G1), F3 (G2).  CCG G3 has no council → F4.
const hierarchy: Hierarchy = {
  ccgs: [
    { id: 'G1', councilId: 'K1' },
    { id: 'G2', councilId: 'K1' },
    { id: 'G3', councilId: null },
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
  overseer: { level: 'council', perms: ['people.view', 'placements.view', 'milestones.update', 'checkins.record', 'reports.view'] },
  ccg_governor: { level: 'ccg', perms: ['units.edit', 'people.view', 'people.manage', 'members.confirm', 'links.manage', 'milestones.update'] },
  ccf_coordinator: { level: 'ccf', perms: ['people.view', 'people.manage', 'members.confirm', 'links.manage', 'milestones.update'] },
} as const

function grant(role: keyof typeof ROLES, unit?: string): AssignmentGrant {
  const r = ROLES[role]
  return {
    roleKey: role,
    scopeLevel: r.level,
    permissions: [...r.perms],
    councilId: r.level === 'council' ? unit ?? null : null,
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

  it('Overseer: every CCG and CCF in the council, read and follow-up only', () => {
    const s = scope(grant('overseer', 'K1'))
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
    const s = scope(grant('ccf_coordinator', 'F4'), grant('overseer', 'K1'))
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

  it('a stream-level role covers every council, CCG and CCF in the stream', () => {
    const withStreams: Hierarchy = { ...hierarchy, councils: [{ id: 'K1', streamId: 'S1' }] }
    const s = resolveCcgScope(
      [{ roleKey: 'stream_lead', scopeLevel: 'stream', permissions: ['people.view'], streamId: 'S1', councilId: null, ccgId: null, ccfId: null }],
      withStreams
    )
    expect(s.canOnStream('people.view', 'S1')).toBe(true)
    expect(s.canOnCouncil('people.view', 'K1')).toBe(true)
    expect(s.ccfIds('people.view')).toEqual(['F1', 'F2', 'F3'])
    expect(s.canOnCcf('people.view', 'F4')).toBe(false) // G3 has no council, so no stream
    expect(s.councilIds('people.view')).toEqual(['K1'])
    expect(s.streamIds('people.view')).toEqual(['S1'])
    expect(s.streamIds('people.manage')).toEqual([])
  })

  it('unknown units are never matched', () => {
    const s = scope(grant('ccg_governor', 'G1'))
    expect(s.canOnCcf('people.view', 'F-unknown')).toBe(false)
    expect(s.canOnCcf('people.view', null)).toBe(false)
  })
})
