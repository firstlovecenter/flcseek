'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarCheck, ListChecks, MapPin, Pencil, Plus, Trash2, Users, UserRound } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { formatTime12h } from '@/lib/ccg/engine/meeting-slot'
import { message } from '@/lib/toast'
import { useConfirm } from '@/hooks/use-confirm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { useCcgMe } from '@/components/ccg/CcgMeProvider'
import { CHILD_GROUP, GROUP_PLURAL, GroupCard, LEADER_KEY, LEADER_TITLE, isGroupType, type GroupType } from '@/components/ccg/GroupCard'
import { StreamSeekers } from '@/components/ccg/StreamSeekers'
import { UNIT_PATH } from '@/components/ccg/structure-types'
import { Crumbs, DetailTile, LeaderBlock, SectionLabel, StickyHeader, Timeline, UNIT_LEVEL, UnitTitle, groupHref } from '@/components/ccg/synago'

/**
 * A group's page (stream, council, CCG or CCF), laid out like Synago's church
 * details page: breadcrumb, title, leader, quick actions, detail tiles,
 * sub-groups and history. Editing is its own page.
 */

interface Overview {
  unit: {
    type: GroupType
    id: string
    code: string
    name: string
    status: string
    capacity?: number
    meeting_day?: string | null
    meeting_time?: string | null
    meeting_location?: string | null
    audience?: 'adult' | 'youth'
    notes: string | null
    created_at: string | null
  }
  breadcrumb: Array<{ type: string; id: string; name: string }>
  leaders: Array<{ role: string; person_id: string | null; name: string }>
  role_holders: Array<{ assignment_id: string; role_key: string; role: string; person_id: string | null; name: string; since: string | null }>
  stats: {
    members: number
    pending_members: number
    placed_converts: number
    awaiting_approval: number
    graduated: number
    milestones_overdue: number
    open_places: number | null
    ccf_count: number | null
  }
  children: {
    type: GroupType
    items: Array<{ id: string; code: string; name: string; status: string; members: number; placed: number; leader: string | null }>
  } | null
  history: Array<{ id: string; text: string; at: string | null; by: string | null }>
}

export default function GroupPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type: rawType, id } = use(params)
  const type = rawType as GroupType
  const router = useRouter()
  const { has, hasGlobal } = useCcgMe()
  const { confirm, ConfirmDialog } = useConfirm()
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const r = await ccgApi.get<Overview>(`/groups/${type}/${id}?history=${showAll ? 50 : 5}`)
    if (r.ok) setData(r.data)
    else setError(r.error.message)
  }, [type, id, showAll])

  useEffect(() => {
    load()
  }, [load])

  if (!isGroupType(type)) return <ErrorScreen title="Unknown group" message="That kind of group does not exist." />
  if (error) return <ErrorScreen title="Could not load this group" message={error} onRetry={load} />

  const u = data?.unit
  const s = data?.stats
  const scope = u ? `unit=${type}:${id}&name=${encodeURIComponent(u.name)}` : ''
  const canEdit = hasGlobal('structure.manage') || (type === 'ccf' && has('units.edit'))
  const canClose = hasGlobal('structure.manage')
  const child = CHILD_GROUP[type]
  const leader = data?.leaders[0]
  // (A stream's Sheep Seekers have their own section.)
  const others = data?.role_holders.filter((h) => h.role_key !== LEADER_KEY[type] && !(type === 'stream' && h.role_key === 'sheep_seeker')) ?? []

  const closeDown = async () => {
    if (!u) return
    const ok = await confirm({
      title: `Close down ${u.name}?`,
      description: `The ${UNIT_LEVEL[type]} is closed and its leader roles end. It must be empty first: move what is in it elsewhere.`,
      confirmLabel: 'Close down',
      destructive: true,
    })
    if (!ok) return
    const r = await ccgApi.del(`${UNIT_PATH[type]}/${id}`)
    if (!r.ok) return message.error(r.error.message)
    message.success(`${u.name} closed down`)
    const parent = data?.breadcrumb.at(-1)
    router.push(parent ? groupHref(parent.type, parent.id) : '/ccg/groups')
  }

  const meeting =
    u?.meeting_day || u?.meeting_time
      ? [u.meeting_day, u.meeting_time ? formatTime12h(u.meeting_time) : null].filter(Boolean).join(', ')
      : 'Not set'

  return (
    <div className="pb-10">
      <StickyHeader className="space-y-1">
        {data ? <Crumbs items={data.breadcrumb} /> : <Skeleton className="h-3 w-40" />}
        <div className="flex items-center justify-between gap-3">
          {u ? <UnitTitle name={u.name} type={type} className="truncate" /> : <Skeleton className="h-8 w-56" />}
          {u && (canEdit || canClose) && (
            <div className="flex shrink-0 gap-2">
              {canEdit && (
                <Button variant="outline" size="sm" className="h-9 gap-1.5" asChild>
                  <Link href={`${groupHref(type, id)}/edit`}>
                    <Pencil className="size-4" />
                    <span className="hidden sm:inline">Edit</span>
                  </Link>
                </Button>
              )}
              {canClose && (
                <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-destructive hover:text-destructive" onClick={closeDown}>
                  <Trash2 className="size-4" />
                  <span className="hidden sm:inline">Close down</span>
                </Button>
              )}
            </div>
          )}
        </div>
        {u && u.status !== 'active' && (
          <Badge variant="outline" className="capitalize">
            {u.status}
          </Badge>
        )}
      </StickyHeader>

      <div className="space-y-8 pt-4">
        {/* Leader (a stream's Sheep Seekers have their own section below) */}
        {type === 'stream' ? null : data ? (
          <LeaderBlock
            title={LEADER_TITLE[type]}
            name={leader?.name ?? null}
            href={leader?.person_id ? `/ccg/members?person=${leader.person_id}` : undefined}
          />
        ) : (
          <Skeleton className="h-16 w-64" />
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <ActionLink href={`/ccg/converts?${scope}`} icon={ListChecks} label="Converts’ milestones" />
          {type === 'ccf' && has('attendance.mark') && <ActionLink href={`/ccg/attendance?ccf=${id}`} icon={CalendarCheck} label="Mark attendance" />}
          <ActionLink href={`/ccg/members?${scope}`} icon={Users} label="Members" />
          <ActionLink href={`/ccg/converts?view=all&${scope}`} icon={UserRound} label="All converts" />
        </div>

        {u?.meeting_location && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden />
            {u.meeting_location}
          </p>
        )}

        {/* Details */}
        <section>
          <SectionLabel>Details</SectionLabel>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            <DetailTile loading={!s} heading="Members" value={s?.members} href={`/ccg/members?${scope}`} />
            <DetailTile loading={!s} heading="Converts placed" value={s?.placed_converts} href={`/ccg/converts?${scope}`} />
            <DetailTile
              loading={!s}
              heading="Milestones overdue"
              value={s?.milestones_overdue}
              tone={s && s.milestones_overdue > 0 ? 'warning' : undefined}
              href={`/ccg/converts?${scope}`}
            />
            <DetailTile loading={!s} heading="Became members" value={s?.graduated} tone={s && s.graduated > 0 ? 'success' : undefined} />
            {s && s.pending_members > 0 && <DetailTile heading="Members to confirm" value={s.pending_members} tone="warning" href={`/ccg/members?${scope}`} />}
            {s && s.awaiting_approval > 0 && <DetailTile heading="Awaiting approval" value={s.awaiting_approval} href="/ccg/approvals" />}
            {s?.ccf_count !== null && s?.ccf_count !== undefined && <DetailTile heading="CCFs" value={s.ccf_count} />}
            {type === 'ccf' && u && (
              <>
                <DetailTile heading="Capacity" value={`${u.capacity ?? 0} (${s?.open_places ?? 0} open)`} tone={s?.open_places === 0 ? 'warning' : undefined} />
                <DetailTile heading="Meets" value={meeting} />
              </>
            )}
            {u?.audience && <DetailTile heading="Audience" value={u.audience === 'youth' ? 'Youth (under 18)' : 'Adults (18+)'} />}
          </div>
          {u?.notes && <p className="mt-3 text-sm whitespace-pre-line text-muted-foreground">{u.notes}</p>}
        </section>

        {type === 'stream' && (
          <StreamSeekers
            streamId={id}
            streamName={u?.name ?? 'this stream'}
            overseer={data ? data.role_holders.find((h) => h.role_key === 'seeking_overseer') ?? null : undefined}
            seekers={data ? data.role_holders.filter((h) => h.role_key === 'sheep_seeker') : null}
            onChanged={load}
          />
        )}

        {/* Other role holders */}
        {others.length > 0 && (
          <section>
            <SectionLabel>Other roles</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {others.map((h) => (
                <Badge key={`${h.role_key}-${h.person_id ?? h.name}`} variant="secondary" className="gap-1 py-1">
                  {h.name} · <span className="text-muted-foreground">{h.role}</span>
                </Badge>
              ))}
            </div>
          </section>
        )}

        {/* Sub-groups */}
        {child && (
          <section>
            <SectionLabel
              action={
                <div className="flex items-center gap-1">
                  {hasGlobal('structure.manage') && (
                    <Button variant="ghost" size="sm" className="h-8 gap-1" asChild>
                      <Link href={`/ccg/groups/new?type=${child}&parent=${id}`}>
                        <Plus className="size-4" /> Add
                      </Link>
                    </Button>
                  )}
                  {(data?.children?.items.length ?? 0) > 0 && (
                    <Button variant="ghost" size="sm" className="h-8" asChild>
                      <Link href={`${groupHref(type, id)}/groups`}>View all</Link>
                    </Button>
                  )}
                </div>
              }
            >
              {GROUP_PLURAL[child]}
            </SectionLabel>
            {!data ? (
              <Skeleton className="h-20 rounded-xl" />
            ) : data.children && data.children.items.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.children.items.slice(0, 6).map((c) => (
                  <GroupCard key={c.id} type={child} item={c} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No {GROUP_PLURAL[child]} yet.</p>
            )}
          </section>
        )}

        {/* History */}
        <section>
          <SectionLabel
            action={
              data && data.history.length >= 5 && !showAll ? (
                <Button variant="ghost" size="sm" className="h-8" onClick={() => setShowAll(true)}>
                  Show more
                </Button>
              ) : null
            }
          >
            History
          </SectionLabel>
          <Card>
            <CardContent className="pt-4">{data ? <Timeline entries={data.history} /> : <Skeleton className="h-32" />}</CardContent>
          </Card>
        </section>
      </div>
      {ConfirmDialog}
    </div>
  )
}

function ActionLink({ href, icon: Icon, label }: { href: string; icon: typeof Users; label: string }) {
  return (
    <Button variant="outline" className="h-11 justify-start gap-2" asChild>
      <Link href={href}>
        <Icon className="size-4 text-members" />
        {label}
      </Link>
    </Button>
  )
}
