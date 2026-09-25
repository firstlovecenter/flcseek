import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { generateToken, type TokenPayload } from '@/lib/auth'
import { resolveCcgScope, type AssignmentGrant } from '@/lib/ccg/scope'
import { PERMISSION_KEYS } from '@/lib/ccg/permissions'

// DB-backed lookups are mocked; token parsing, guards and scope logic are real.
const state = vi.hoisted(() => ({
  fresh: null as TokenPayload | null,
  grants: [] as AssignmentGrant[],
}))
vi.mock('@/lib/auth-verify', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth-verify')>()
  return { ...actual, resolveFreshUser: vi.fn(async () => state.fresh) }
})
vi.mock('@/lib/ccg/server/scope-loader', async (orig) => {
  const actual = await orig<typeof import('@/lib/ccg/server/scope-loader')>()
  return {
    ...actual,
    loadScope: vi.fn(async () => resolveCcgScope(state.grants, { ccfs: [{ id: 'F1', ccgId: 'G1' }], ccgs: [{ id: 'G1', councilId: null }] })),
  }
})

import { getVerifiedAuthUser, getVerifiedIdentity } from '@/lib/api/middleware'
import { withApiHandler } from '@/lib/api/handler'
import { success } from '@/lib/api/response'
import { withCcg } from '@/lib/ccg/server/handler'
import { OWNER_GRANT } from '@/lib/ccg/server/scope-loader'
import { isSeekSuperadmin } from '@/lib/ccg/access'

const base = { id: '00000000-0000-0000-0000-000000000009', username: 'u', tv: 0 }
const ctx = { params: Promise.resolve({}) }
const call = (h: (r: NextRequest, c: typeof ctx) => Promise<Response>, user: TokenPayload) =>
  h(new NextRequest('http://localhost/api/x', { headers: { Authorization: `Bearer ${generateToken(user)}` } }), ctx)

const seekRoute = withApiHandler({ auth: true }, async () => success({ ok: true }))
const ccgRoute = withCcg({}, async () => success({ ok: true }))
const approveRoute = withCcg({ permission: 'placements.approve' }, async () => success({ ok: true }))

const coordinatorOfF1: AssignmentGrant = {
  roleKey: 'ccf_coordinator',
  scopeLevel: 'ccf',
  permissions: ['people.view', 'milestones.update'],
  councilId: null,
  ccgId: null,
  ccfId: 'F1',
}

describe('Seek and CCG share users but not access', () => {
  beforeEach(() => {
    state.fresh = null
    state.grants = []
  })

  it('a CCG-only user is rejected by Seek routes', async () => {
    state.fresh = { ...base, ccg_access: true }
    state.grants = [coordinatorOfF1]
    const req = new NextRequest('http://localhost/x', { headers: { Authorization: `Bearer ${generateToken(state.fresh)}` } })
    expect(await getVerifiedAuthUser(req)).toBeNull()
    expect(await getVerifiedIdentity(req)).toMatchObject({ ccg_access: true })
    expect((await call(seekRoute as never, state.fresh)).status).toBe(401)
    expect((await call(ccgRoute, state.fresh)).status).toBe(200)
  })

  it('a Seek-only user is rejected by CCG routes', async () => {
    state.fresh = { ...base, role: 'leader' }
    expect((await call(ccgRoute, state.fresh)).status).toBe(403)
    expect((await call(seekRoute as never, state.fresh)).status).toBe(200)
  })

  it('CCG permissions are enforced', async () => {
    state.fresh = { ...base, ccg_access: true }
    state.grants = [coordinatorOfF1]
    expect((await call(approveRoute, state.fresh)).status).toBe(403)
  })

  it('the CCG owner (a Seek superadmin) reaches both apps with every CCG permission', async () => {
    state.fresh = { ...base, role: 'superadmin', ccg_access: true }
    state.grants = [OWNER_GRANT]
    expect((await call(seekRoute as never, state.fresh)).status).toBe(200)
    expect((await call(ccgRoute, state.fresh)).status).toBe(200)
    expect((await call(approveRoute, state.fresh)).status).toBe(200)
  })
})

describe('CCG owner (super superadmin)', () => {
  it('Seek superadmin is recognised from the Seek role only (it no longer grants CCG access by itself)', () => {
    expect(isSeekSuperadmin('superadmin')).toBe(true)
    expect(isSeekSuperadmin('leadpastor')).toBe(false)
    expect(isSeekSuperadmin(null)).toBe(false)
  })

  it('holds every permission on every unit', () => {
    const s = resolveCcgScope([OWNER_GRANT], { ccfs: [{ id: 'F1', ccgId: 'G1' }], ccgs: [{ id: 'G1', councilId: 'K1' }] })
    for (const p of PERMISSION_KEYS) {
      expect(s.can(p)).toBe(true)
      expect(s.canOnCcf(p, 'F1')).toBe(true)
    }
    expect(s.ccfIds('people.manage')).toBe('all')
  })
})
