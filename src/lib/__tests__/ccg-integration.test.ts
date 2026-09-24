/**
 * CCG backend integration tests against a real Postgres (a throwaway Neon
 * branch with migration 020 applied). Skipped unless run via
 *
 *   npm run test:ccg-db
 *
 * which points NEON_DATABASE_URL at CCG_TEST_DATABASE_URL (.env.ccg-test.local).
 * Never runs against the app's own database: both variables must match.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'

const enabled = !!process.env.CCG_TEST_DATABASE_URL && process.env.NEON_DATABASE_URL === process.env.CCG_TEST_DATABASE_URL
const d = enabled ? describe : describe.skip
const T = 90_000 // remote database: many round trips per case

// Imported lazily so the Prisma client only ever connects when enabled.
type Mods = {
  prisma: typeof import('@/lib/prisma').prisma
  people: typeof import('@/lib/ccg/server/people')
  mapping: typeof import('@/lib/ccg/server/mapping')
  placements: typeof import('@/lib/ccg/server/placements')
  links: typeof import('@/lib/ccg/server/links')
  progress: typeof import('@/lib/ccg/server/progress')
  activities: typeof import('@/lib/ccg/server/activities')
  permissionKeys: typeof import('@/lib/ccg/permissions').PERMISSION_KEYS
  scopeLoader: typeof import('@/lib/ccg/server/scope-loader')
  roles: typeof import('@/lib/ccg/server/roles')
  placementRoutes: typeof import('@/lib/ccg/server/placement-routes')
  memberLogin: typeof import('@/lib/ccg/server/member-login')
  access: typeof import('@/lib/ccg/access')
  seekUsers: typeof import('@/lib/db/queries/users')
}
let m: Mods
const run = randomUUID().slice(0, 6).toUpperCase()
const ids: Record<string, string> = {}

async function convertFor(answers: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const { person, proposal } = await m.people.createPerson({
    kind: 'convert',
    core: { first_name: 'Convert', last_name: `${randomUUID().slice(0, 4)}`, date_of_birth: '1998-05-01', stream_id: ids.stream, ...extra },
    answers,
    source: 'staff',
    actorId: ids.admin,
  })
  return { person, proposal }
}

d('CCG backend against Postgres', () => {
  beforeAll(async () => {
    m = {
      prisma: (await import('@/lib/prisma')).prisma,
      people: await import('@/lib/ccg/server/people'),
      mapping: await import('@/lib/ccg/server/mapping'),
      placements: await import('@/lib/ccg/server/placements'),
      links: await import('@/lib/ccg/server/links'),
      progress: await import('@/lib/ccg/server/progress'),
      activities: await import('@/lib/ccg/server/activities'),
      permissionKeys: (await import('@/lib/ccg/permissions')).PERMISSION_KEYS,
      scopeLoader: await import('@/lib/ccg/server/scope-loader'),
      roles: await import('@/lib/ccg/server/roles'),
      placementRoutes: await import('@/lib/ccg/server/placement-routes'),
      memberLogin: await import('@/lib/ccg/server/member-login'),
      access: await import('@/lib/ccg/access'),
      seekUsers: await import('@/lib/db/queries/users'),
    }
    const { prisma } = m

    // Users: a CCG-only coordinator and a Seek superadmin.
    const mk = (username: string, role: string | null) =>
      prisma.user.create({ data: { username, password: 'x'.repeat(60), role, firstName: username } })
    ids.admin = (await mk(`ccgadmin_${run}`, 'superadmin')).id
    ids.coord = (await mk(`ccgcoord_${run}`, null)).id

    // Structure: stream → council → CCG → two CCFs meeting weekday evenings. Converts are matched
    // within their stream, which keeps CCFs left over from earlier runs out of these tests.
    ids.stream = (await prisma.ccgStream.create({ data: { code: `S${run}`, name: 'Test stream' } })).id
    ids.council = (await prisma.ccgCouncil.create({ data: { code: `K${run}`, name: 'Test council', streamId: ids.stream } })).id
    ids.ccg = (await prisma.ccgGroup.create({ data: { code: `G${run}`, name: 'Test CCG', councilId: ids.council } })).id
    const ccf = (code: string, capacity = 10) =>
      prisma.ccgFamily.create({ data: { ccgId: ids.ccg, code: `${code}${run}`, name: `CCF ${code}`, meetingDay: 'Monday', meetingTime: '19:00', capacity } })
    ids.football = (await ccf('FB')).id
    ids.music = (await ccf('MU', 20)).id

    // Members shape each CCF's profile.
    const member = (ccfId: string, interests: string[]) =>
      m.people.createPerson({
        kind: 'member',
        core: { first_name: 'Member', last_name: `${randomUUID().slice(0, 4)}`, ccf_id: ccfId, date_of_birth: '1997-01-01' },
        answers: { interests, trait_new_people: 4, trait_group_activity: 4 },
        source: 'staff',
        actorId: ids.admin,
      })
    const footballMembers: string[] = []
    for (let i = 0; i < 4; i++) footballMembers.push((await member(ids.football, ['football', 'gym_fitness'])).person.id)
    for (let i = 0; i < 4; i++) await member(ids.music, ['music', 'arts'])

    // Leaders are members: the coordinator's login is linked to a football member.
    await expect(
      m.roles.createAssignment({ user_id: ids.coord, role_key: 'ccf_coordinator', ccf_id: ids.football }, ids.admin)
    ).rejects.toThrow(/Roles are given to members/)
    await prisma.ccgPerson.update({ where: { id: footballMembers[0] }, data: { userId: ids.coord } })
    ids.coordMember = footballMembers[0]
    ids.fbMember = footballMembers[1]
    await m.roles.createAssignment({ user_id: ids.coord, role_key: 'ccf_coordinator', ccf_id: ids.football }, ids.admin)
  }, 300_000)

  it('matches a new convert in real time and proposes the best CCF', async () => {
    const { person, proposal } = await convertFor({ interests: ['football'], availability: ['weekday_evenings'] })
    expect(proposal?.placement.status).toBe('proposed')
    expect(proposal?.placement.proposedCcfId).toBe(ids.football)
    const p = await m.prisma.ccgPerson.findUnique({ where: { id: person.id } })
    expect(p?.status).toBe('proposed')
    ids.fbConvert = person.id
    ids.fbPlacement = proposal!.placement.id
  }, T)

  it('re-matches when answers change, superseding the old proposal', async () => {
    const { proposal } = await m.people.updatePerson(ids.fbConvert, { answers: { interests: ['music'] } }, { actorId: ids.admin, source: 'staff' })
    expect(proposal?.placement.proposedCcfId).toBe(ids.music)
    const old = await m.prisma.ccgPlacement.findUnique({ where: { id: ids.fbPlacement } })
    expect(old?.status).toBe('superseded')
    ids.fbPlacement = proposal!.placement.id
  }, T)

  it('approves: placement active, person placed, clock started', async () => {
    const p = await m.placements.approvePlacement(ids.fbPlacement, ids.admin)
    expect(p.status).toBe('active')
    expect(p.finalCcfId).toBe(ids.music)
    expect(p.decidedAt).toBeTruthy()
    const person = await m.prisma.ccgPerson.findUnique({ where: { id: ids.fbConvert } })
    expect(person?.status).toBe('placed')
    await expect(m.placements.approvePlacement(ids.fbPlacement, ids.admin)).rejects.toThrow(/active/)
  }, T)

  it('remap needs a reason and records the decision', async () => {
    const { proposal } = await convertFor({ interests: ['football'], availability: ['weekday_evenings'] })
    await expect(m.placements.remapPlacement(proposal!.placement.id, ids.music, '  ', ids.admin)).rejects.toThrow(/reason/)
    const p = await m.placements.remapPlacement(proposal!.placement.id, ids.music, 'Sister is in this CCF', ids.admin)
    expect(p.decision).toBe('remapped')
    expect(p.finalCcfId).toBe(ids.music)
  }, T)

  it('two approvals racing for the last seat: exactly one wins', async () => {
    const tiny = await m.prisma.ccgFamily.create({
      data: { ccgId: ids.ccg, code: `TN${run}`, name: 'Tiny CCF', meetingDay: 'Monday', meetingTime: '19:00', capacity: 1 },
    })
    const a = await convertFor({ interests: ['cooking'] })
    const b = await convertFor({ interests: ['cooking'] })
    // Force both proposals onto the one-seat CCF.
    for (const c of [a, b]) {
      await m.prisma.ccgPlacement.update({ where: { id: c.proposal!.placement.id }, data: { proposedCcfId: tiny.id } })
    }
    const results = await Promise.allSettled([
      m.placements.approvePlacement(a.proposal!.placement.id, ids.admin),
      m.placements.approvePlacement(b.proposal!.placement.id, ids.admin),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(String(rejected.reason.message)).toMatch(/full/)
    expect(await m.prisma.ccgPlacement.count({ where: { finalCcfId: tiny.id, status: 'active' } })).toBe(1)
  }, T)

  it('member self-registration link: pending until confirmed, idempotent, revocable', async () => {
    const { token, link } = await m.links.createLink({ kind: 'member_ccf', ccfId: ids.football, actorId: ids.coord })
    const form = await m.links.getPublicForm(token)
    expect(form.audience).toBe('member')
    expect(form.questions.some((q) => q.key === 'trait_hosting')).toBe(true) // member-only question shown
    expect(form.questions.some((q) => q.key === 'availability')).toBe(false) // convert-only question hidden

    const submission = {
      client_submission_id: randomUUID(),
      person: { first_name: 'Self', last_name: `Registered ${run}`, phone: '0240000000', email: `self.${run}@example.org` },
      answers: { interests: ['football'] },
    }
    const client = { ip: '127.0.0.1', userAgent: 'vitest' }
    const first = await m.links.submitPublicForm(token, submission, client)
    const again = await m.links.submitPublicForm(token, submission, client)
    expect(again).toMatchObject({ ok: true, duplicate_submission: true, reference: first.reference })

    const created = await m.prisma.ccgPerson.findFirst({ where: { fullName: `Self Registered ${run}`, ccfId: ids.football } })
    expect(created?.status).toBe('pending')
    expect(created?.source).toBe('self')
    expect(created?.phone).toBe('233240000000')
    await m.people.confirmMember(created!.id, ids.coord)
    expect((await m.prisma.ccgPerson.findUnique({ where: { id: created!.id } }))?.status).toBe('active')

    await m.links.revokeLink(link.id, ids.coord)
    await expect(m.links.getPublicForm(token)).rejects.toThrow(/no longer valid/)
  }, T)

  it('convert intake link: required answers enforced, proposal made, max uses honoured', async () => {
    const { token } = await m.links.createLink({ kind: 'convert_intake', streamId: ids.stream, maxUses: 1, actorId: ids.admin })
    const client = { ip: '127.0.0.1', userAgent: 'vitest' }
    await expect(
      m.links.submitPublicForm(token, { client_submission_id: randomUUID(), person: { first_name: 'No', last_name: 'Answers', phone: '0241111111' }, answers: {} }, client)
    ).rejects.toThrow(/not valid/)

    const ok = await m.links.submitPublicForm(
      token,
      {
        client_submission_id: randomUUID(),
        person: { first_name: 'Intake', last_name: `Convert ${run}`, phone: '0242222222', date_of_birth: '1999-02-02' },
        answers: { interests: ['football'], availability: ['weekday_evenings'] },
      },
      client
    )
    expect(ok.ok).toBe(true)
    const p = await m.prisma.ccgPerson.findFirst({ where: { fullName: `Intake Convert ${run}` }, include: { placements: true } })
    expect(p?.status).toBe('proposed')
    expect(p?.placements[0].proposedCcfId).toBe(ids.football)

    await expect(
      m.links.submitPublicForm(token, { client_submission_id: randomUUID(), person: { first_name: 'Too', last_name: 'Late', phone: '0243333333' }, answers: { interests: ['music'], availability: ['weekday_evenings'] } }, client)
    ).rejects.toThrow(/no longer valid/)
  }, T)

  it('manual milestones: recorded after approval, not before it; auto ones cannot be ticked', async () => {
    const active = await m.prisma.ccgPlacement.findFirst({ where: { personId: ids.fbConvert, status: 'active' } })
    ids.activePlacement = active!.id
    await m.progress.setProgress(active!.id, { stage_number: 4, is_completed: true }, ids.admin) // water baptism
    const row = await m.progress.placementProgress(active!.id)
    expect(row.stages.find((s) => s.stage_number === 4)?.state).toBe('done')
    await expect(
      m.progress.setProgress(active!.id, { stage_number: 5, is_completed: true, date_completed: '2020-01-01' }, ids.admin)
    ).rejects.toThrow(/before the placement/)
    await expect(m.progress.setProgress(active!.id, { stage_number: 1, is_completed: true }, ids.admin)).rejects.toThrow(/attendance/)
    await expect(m.progress.setProgress(active!.id, { stage_number: 9, is_completed: true }, ids.admin)).rejects.toThrow(/checklist/)
  }, T)

  it('attendance: the fifth in-person fellowship completes the milestone; unmarking re-opens it', async () => {
    const mark = (ccf_id: string, event_type: 'sunday_service' | 'in_person_fellowship', event_date: string, present = true) =>
      m.progress.saveAttendance({ ccf_id, event_type, event_date, entries: [{ person_id: ids.fbConvert, present }] }, ids.admin)

    for (const d of ['2026-08-05', '2026-08-12', '2026-08-19', '2026-08-26', '2026-09-02']) {
      await mark(ids.music, 'in_person_fellowship', d)
    }
    let stage = (await m.progress.placementProgress(ids.activePlacement)).stages.find((s) => s.stage_number === 3)!
    expect(stage).toMatchObject({ is_completed: true, date_completed: '2026-09-02', progress: { done: 5, total: 5 } })
    const rec = await m.prisma.ccgProgressRecord.findFirst({ where: { placementId: ids.activePlacement, stageNumber: 3 } })
    expect(rec?.source).toBe('auto')

    // Saving the same register twice does not double count.
    await mark(ids.music, 'in_person_fellowship', '2026-09-02')
    const reg = await m.progress.attendanceRegister(ids.music, 'in_person_fellowship', '2026-09-02')
    expect(reg.rows.find((r) => r.person.id === ids.fbConvert)).toMatchObject({ present: true, total: 5 })

    await mark(ids.music, 'in_person_fellowship', '2026-08-12', false)
    stage = (await m.progress.placementProgress(ids.activePlacement)).stages.find((s) => s.stage_number === 3)!
    expect(stage).toMatchObject({ is_completed: false, progress: { done: 4, total: 5 } })

    // Only converts placed in that CCF, and never a future date.
    await expect(mark(ids.football, 'sunday_service', '2026-09-06')).rejects.toThrow(/not converts placed/)
    await expect(mark(ids.music, 'sunday_service', '2999-01-01')).rejects.toThrow(/future/)
  }, T)

  it('checklist: the Overseer introduction completes when all four items are ticked', async () => {
    const items = await m.prisma.ccgMilestoneItem.findMany({
      where: { milestone: { stageNumber: 9 }, isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    expect(items).toHaveLength(4)
    for (const [i, item] of items.entries()) {
      await m.progress.setChecklistItem(ids.activePlacement, { item_id: item.id, done: true, date_completed: `2026-09-1${i}` }, ids.admin)
    }
    let stage = (await m.progress.placementProgress(ids.activePlacement)).stages.find((s) => s.stage_number === 9)!
    expect(stage).toMatchObject({ is_completed: true, date_completed: '2026-09-13', progress: { done: 4, total: 4 } })
    expect(stage.items).toHaveLength(4)

    await m.progress.setChecklistItem(ids.activePlacement, { item_id: items[0].id, done: false }, ids.admin)
    stage = (await m.progress.placementProgress(ids.activePlacement)).stages.find((s) => s.stage_number === 9)!
    expect(stage).toMatchObject({ is_completed: false, progress: { done: 3, total: 4 } })
  }, T)

  it('CCG activities: intercession logged once per day with converts prayed for by name', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const body = { ccg_id: ids.ccg, type_key: 'intercession', held_on: today, attendee_count: 6, notes: null, person_ids: [ids.fbConvert] }
    const a = await m.activities.recordGroupActivity(body, ids.admin)
    const again = await m.activities.recordGroupActivity({ ...body, attendee_count: 7 }, ids.admin)
    expect(again.id).toBe(a.id)

    const { activities, summary } = await m.activities.listGroupActivities([ids.ccg], {})
    expect(activities).toHaveLength(1)
    expect(activities[0]).toMatchObject({ attendee_count: 7, prayed_for: [{ id: ids.fbConvert }] })
    const types = summary.find((g) => g.ccg.id === ids.ccg)!.types
    expect(types.find((t) => t.key === 'intercession')?.held_this_period).toBe(true)
    expect(types.find((t) => t.key === 'fellowship_meal')?.held_this_period).toBe(false)

    const stranger = await convertFor({ interests: ['music'] })
    await expect(m.activities.recordGroupActivity({ ...body, person_ids: [stranger.person.id] }, ids.admin)).rejects.toThrow(
      /not converts placed/
    )
  }, T)

  it('graduation: completing every milestone makes the convert a member of their CCF', async () => {
    const { prisma } = m
    const placementId = ids.activePlacement
    const personId = ids.fbConvert
    // Manual milestones (4–7).
    for (const stage_number of [5, 6, 7]) {
      await m.progress.setProgress(placementId, { stage_number, is_completed: true }, ids.admin)
    }
    // Attendance: 10 Sundays, 10 online, the missing 5th in-person (written directly, then synced by one register save).
    const days = (n: number, from: number) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 3, from + i * 7)))
    await prisma.ccgAttendance.createMany({
      data: [
        ...days(10, 5).map((eventDate) => ({ personId, eventType: 'sunday_service', eventDate, ccfId: ids.music })),
        ...days(10, 1).map((eventDate) => ({ personId, eventType: 'online_fellowship', eventDate, ccfId: ids.music })),
      ],
      skipDuplicates: true,
    })
    // Checklists: every Seeing and Hearing item, and the Overseer item unticked earlier.
    const items = await prisma.ccgMilestoneItem.findMany({ where: { milestone: { stageNumber: 8 }, isActive: true } })
    await prisma.ccgProgressItem.createMany({
      data: items.map((i) => ({ placementId, itemId: i.id, doneOn: new Date(Date.UTC(2026, 8, 1)) })),
      skipDuplicates: true,
    })
    const overseerItem = await prisma.ccgMilestoneItem.findFirst({ where: { milestone: { stageNumber: 9 }, isActive: true }, orderBy: { sortOrder: 'asc' } })
    await m.progress.setChecklistItem(placementId, { item_id: overseerItem!.id, done: true, date_completed: '2026-09-14' }, ids.admin)

    // Still one milestone short (in-person fellowship 4 of 5): not yet a member.
    expect((await prisma.ccgPerson.findUnique({ where: { id: personId } }))?.kind).toBe('convert')

    const res = await m.progress.saveAttendance(
      { ccf_id: ids.music, event_type: 'in_person_fellowship', event_date: '2026-09-09', entries: [{ person_id: personId, present: true }] },
      ids.admin
    )
    expect(res.graduated).toEqual([personId])
    const person = await prisma.ccgPerson.findUnique({ where: { id: personId } })
    expect(person).toMatchObject({ kind: 'member', status: 'active', ccfId: ids.music })
    const placement = await prisma.ccgPlacement.findUnique({ where: { id: placementId } })
    expect(placement).toMatchObject({ status: 'ended', outcome: 'graduated' })
  }, T)

  it('transfers: a member and a placed convert move CCF, with a record; progress stays', async () => {
    const { prisma } = m
    const t = await m.placements.transferPerson(ids.fbMember, ids.music, 'Moved to be near work', ids.admin)
    expect(t).toMatchObject({ kind: 'member', fromCcfId: ids.football, toCcfId: ids.music })
    expect((await prisma.ccgPerson.findUnique({ where: { id: ids.fbMember } }))?.ccfId).toBe(ids.music)
    await expect(m.placements.transferPerson(ids.fbMember, ids.music, 'Again', ids.admin)).rejects.toThrow(/already in this CCF/)
    await expect(m.placements.transferPerson(ids.fbMember, ids.football, '  ', ids.admin)).rejects.toThrow(/reason/)

    const { proposal } = await convertFor({ interests: ['music'], availability: ['weekday_evenings'] })
    const placed = await m.placements.approvePlacement(proposal!.placement.id, ids.admin)
    await m.progress.setProgress(placed.id, { stage_number: 4, is_completed: true }, ids.admin)
    await m.placements.transferPerson(placed.personId, ids.football, 'Friends are in the football CCF', ids.admin)
    const after = await prisma.ccgPlacement.findUnique({ where: { id: placed.id }, include: { progressRecords: true } })
    expect(after).toMatchObject({ status: 'active', finalCcfId: ids.football })
    expect(after?.decidedAt?.getTime()).toBe(placed.decidedAt?.getTime()) // same assessment year
    expect(after?.progressRecords.some((r) => r.stageNumber === 4 && r.isCompleted)).toBe(true)

    // A convert still awaiting placement is moved through the approvals screen instead.
    const waiting = await convertFor({ interests: ['music'] })
    await expect(m.placements.transferPerson(waiting.person.id, ids.football, 'x', ids.admin)).rejects.toThrow(/awaiting placement/)
  }, T)

  it('Sheep Seeker (stream-level): registers and maps converts in their stream only', async () => {
    const { prisma } = m
    const stream = { id: ids.stream }
    const other = await prisma.ccgStream.create({ data: { code: `O${run}`, name: 'Empty stream' } })

    // Roles go to members. A member with no email cannot be invited; with one,
    // a login is created (email = sign-in name) and they get a one-time link.
    const email = `seeker.${run}@example.org`.toLowerCase()
    const { person: seeker } = await m.people.createPerson({
      kind: 'member',
      core: { first_name: 'Seeker', last_name: `${run}`, ccf_id: ids.football, phone: '0246666666' },
      answers: {},
      source: 'staff',
      actorId: ids.admin,
    })
    await expect(
      m.roles.assignRoleToMember({ person_id: seeker.id, role_key: 'sheep_seeker', stream_id: stream.id }, ids.admin, 'http://test')
    ).rejects.toThrow(/email/)
    await prisma.ccgPerson.update({ where: { id: seeker.id }, data: { email } })
    await expect(m.roles.assignRoleToMember({ person_id: seeker.id, role_key: 'sheep_seeker' }, ids.admin, 'http://test')).rejects.toThrow()
    const { invite } = await m.roles.assignRoleToMember({ person_id: seeker.id, role_key: 'sheep_seeker', stream_id: stream.id }, ids.admin, 'http://test')
    expect(invite).toMatchObject({ sent: false, sent_to: email }) // email is not set up in tests: the admin gets the link
    const login = await prisma.user.findFirstOrThrow({ where: { ccgPeople: { some: { id: seeker.id } } } })
    expect(login).toMatchObject({ username: email, email, role: null })

    // The member chooses their own password; the link then stops working.
    const token = invite!.link!.split('/welcome/')[1]
    expect(await m.memberLogin.describeInvite(token)).toMatchObject({ sign_in_name: email })
    await m.memberLogin.acceptInvite(token, 'a-good-password')
    await expect(m.memberLogin.acceptInvite(token, 'another-password')).rejects.toThrow()
    const { verifyPassword } = await import('@/lib/auth')
    const after = await prisma.user.findUniqueOrThrow({ where: { id: login.id } })
    expect(await verifyPassword('a-good-password', after.password)).toBe(true)

    // Forgot password: nothing for an unknown email; a one-time reset link for theirs.
    expect(await m.memberLogin.requestPasswordReset('nobody.here@example.org', 'http://test')).toEqual({})
    const { link: resetLink } = await m.memberLogin.requestPasswordReset(email.toUpperCase(), 'http://test')
    const resetToken = resetLink!.split('/reset-password/')[1]
    expect(await m.memberLogin.describeInvite(resetToken)).toMatchObject({ purpose: 'reset', sign_in_name: email })
    await m.memberLogin.acceptInvite(resetToken, 'a-new-password')
    await expect(m.memberLogin.acceptInvite(resetToken, 'again-password')).rejects.toThrow()

    // Changing it while signed in needs the current password.
    await expect(m.memberLogin.changePassword(login.id, 'a-good-password', 'third-password')).rejects.toThrow(/current password/)
    await m.memberLogin.changePassword(login.id, 'a-new-password', 'third-password')
    const changed = await prisma.user.findUniqueOrThrow({ where: { id: login.id } })
    expect(await verifyPassword('third-password', changed.password)).toBe(true)
    expect(changed.tokenVersion).toBeGreaterThan(after.tokenVersion) // older sessions are signed out

    const scope = await m.scopeLoader.loadScope(login.id)
    for (const p of ['people.manage', 'links.intake', 'placements.approve', 'attendance.mark', 'milestones.update'] as const) {
      expect(scope.canOnStream(p, stream.id)).toBe(true)
      expect(scope.canOnStream(p, other.id)).toBe(false)
      expect(scope.can(p)).toBe(false)
    }
    expect(scope.canOnCcf('placements.approve', ids.music)).toBe(true)
    for (const p of ['structure.manage', 'settings.manage', 'roles.manage', 'members.confirm'] as const) {
      expect(scope.canOnStream(p, stream.id)).toBe(false)
    }
    expect(scope.streamIds('placements.approve')).toEqual([stream.id])

    // A convert from the stream's intake link is registered into the stream and matched inside it.
    const { token: intakeToken } = await m.links.createLink({ kind: 'convert_intake', streamId: stream.id, actorId: login.id })
    const submitted = await m.links.submitPublicForm(
      intakeToken,
      {
        client_submission_id: randomUUID(),
        person: { first_name: 'Stream', last_name: `Intake ${run}`, phone: '0245555555', date_of_birth: '1999-02-02' },
        answers: { interests: ['music'], availability: ['weekday_evenings'] },
      },
      { ip: '127.0.0.1', userAgent: 'vitest' }
    )
    const mine = await prisma.ccgPerson.findFirst({ where: { fullName: `Stream Intake ${run}` }, include: m.people.personInclude })
    expect(submitted.ok).toBe(true)
    expect(mine?.streamId).toBe(stream.id)
    const minePlacement = mine!.placements.find((p) => p.status === 'proposed')!
    expect(minePlacement.proposedCcfId).toBe(ids.music)
    expect(m.people.canOnPerson(scope, 'people.manage', mine!)).toBe(true)
    await expect(m.placementRoutes.authorisePlacement(scope, 'placements.approve', minePlacement.id)).resolves.toBeTruthy()

    // Another stream with no CCFs: held with a stream-specific reason, and out of this seeker's reach.
    const theirs = await convertFor({ interests: ['music'] }, { stream_id: other.id })
    expect(theirs.proposal?.placement.status).toBe('held')
    expect(theirs.proposal?.placement.holdReason).toMatch(/in this stream/)
    const tp = await prisma.ccgPerson.findUnique({ where: { id: theirs.person.id }, include: m.people.personInclude })
    expect(m.people.canOnPerson(scope, 'people.view', tp!)).toBe(false)
    await expect(m.placementRoutes.authorisePlacement(scope, 'placements.approve', theirs.proposal!.placement.id)).rejects.toThrow()
  }, T)

  it('scope: a CCF Coordinator sees only their CCF; the Seek superadmin sees everything', async () => {
    const coord = await m.scopeLoader.loadScope(ids.coord)
    expect(coord.canOnCcf('people.manage', ids.football)).toBe(true)
    expect(coord.canOnCcf('people.manage', ids.music)).toBe(false)
    expect(coord.can('placements.approve')).toBe(false)

    const admin = await m.scopeLoader.loadScope(ids.admin)
    expect(admin.can('placements.approve')).toBe(true)
    expect(admin.can('roles.manage')).toBe(true)
    // The Seek superadmin holds every permission, including the milestone ones.
    for (const p of m.permissionKeys) expect(admin.can(p)).toBe(true)
    expect(await m.access.hasCcgAccess(ids.admin, 'superadmin')).toBe(true)
    expect(await m.access.hasCcgAccess(ids.coord, null)).toBe(true)
  }, T)

  it('ending the last roles.manage holder is refused only when no superadmin exists', async () => {
    const a = await m.roles.createAssignment({ user_id: ids.coord, role_key: 'ccg_admin' }, ids.admin)
    // Superadmins exist, so ending it is fine.
    await m.roles.endAssignment(a.id, ids.admin)
    const ended = await m.prisma.ccgRoleAssignment.findUnique({ where: { id: a.id } })
    expect(ended?.endsOn ?? null).not.toBeNull()
  }, T)

  it('Seek user management does not list CCG-only users', async () => {
    const seek = await m.seekUsers.findMany({ search: `ccgcoord_${run}`, excludeSystemUsers: false })
    expect(seek).toHaveLength(0)
    const superadmin = await m.seekUsers.findMany({ search: `ccgadmin_${run}`, excludeSystemUsers: false })
    expect(superadmin).toHaveLength(1)
  }, T)
})
