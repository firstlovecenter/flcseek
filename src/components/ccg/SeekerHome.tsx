'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, PauseCircle, PhoneCall } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PERSON_STATUS } from './people-types'

interface Home {
  seeker: { person_id: string; name: string }
  streams: Array<{ id: string; name: string }>
  counts: { registered_this_week: number; awaiting_approval: number; on_hold: number; in_assessment: number; became_members: number }
  on_hold: Array<{ person_id: string; name: string; reason: string | null; waiting_days: number | null }>
  follow_ups: Array<{ person_id: string; name: string; ccf: string | null; notes: string | null }>
  recent: Array<{ person_id: string; name: string; status: string; created_at: string | null }>
}

const person = (id: string) => `/ccg/converts?view=all&seeker=me&person=${id}`

/**
 * A Sheep Seeker's converts on their home screen: the ones they brought, what
 * is waiting on them (on hold, follow-ups) and how they are getting on.
 */
export function SeekerHome() {
  const [home, setHome] = useState<Home | null | undefined>(undefined)
  useEffect(() => {
    ccgApi.get<{ home: Home | null }>('/seekers/me').then((r) => setHome(r.ok ? r.data.home : null))
  }, [])
  if (home === null) return null

  const tiles = home
    ? [
        { label: 'Registered this week', value: home.counts.registered_this_week, href: '/ccg/converts?view=all&seeker=me' },
        { label: 'Awaiting approval', value: home.counts.awaiting_approval, href: '/ccg/converts?view=all&seeker=me&status=proposed' },
        { label: 'On hold', value: home.counts.on_hold, href: '/ccg/converts?view=all&seeker=me&status=needs_info', warn: home.counts.on_hold > 0 },
        { label: 'In their assessment year', value: home.counts.in_assessment, href: '/ccg/converts?view=all&seeker=me&status=placed' },
        { label: 'Became members', value: home.counts.became_members },
      ]
    : []

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card" aria-labelledby="seeker-home">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <h2 id="seeker-home" className="text-sm font-medium text-foreground">
            Your converts
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {home ? `Sheep Seeker · ${home.streams.map((s) => s.name).join(', ')}` : ' '}
          </p>
        </div>
        <Link href="/ccg/converts?view=all&seeker=me" className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          All my converts <ChevronRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 divide-border sm:grid-cols-5 sm:divide-x">
        {!home
          ? [0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="px-5 py-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2 h-7 w-10" />
              </div>
            ))
          : tiles.map((t) => {
              const body = (
                <>
                  <p className="text-xs leading-tight text-muted-foreground">{t.label}</p>
                  <p className={cn('mt-1 text-2xl font-semibold tabular-nums', t.warn ? 'text-warning' : 'text-foreground')}>{t.value}</p>
                </>
              )
              return t.href ? (
                <Link key={t.label} href={t.href} className="px-5 py-4 transition-colors hover:bg-accent/50">
                  {body}
                </Link>
              ) : (
                <div key={t.label} className="px-5 py-4">
                  {body}
                </div>
              )
            })}
      </div>

      {home && (home.on_hold.length > 0 || home.follow_ups.length > 0) && (
        <div className="grid gap-px border-t border-border bg-border sm:grid-cols-2">
          <List title="On hold" icon={PauseCircle} empty="Nobody on hold.">
            {home.on_hold.map((h) => (
              <Row key={h.person_id} href={person(h.person_id)} name={h.name} detail={h.reason ?? 'Waiting for more information'} />
            ))}
          </List>
          <List title="Follow-ups" icon={PhoneCall} empty="No follow-ups due.">
            {home.follow_ups.map((f) => (
              <Row key={f.person_id} href={person(f.person_id)} name={f.name} detail={[f.ccf, f.notes].filter(Boolean).join(' · ') || 'Follow up'} />
            ))}
          </List>
        </div>
      )}

      {home && home.recent.length > 0 && home.on_hold.length === 0 && home.follow_ups.length === 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {home.recent.map((r) => (
            <li key={r.person_id}>
              <Link href={person(r.person_id)} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-accent/50">
                <span className="truncate font-medium text-foreground">{r.name}</span>
                <Badge variant={PERSON_STATUS[r.status]?.tone ?? 'outline'} className="shrink-0">
                  {PERSON_STATUS[r.status]?.label ?? r.status}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function List({ title, icon: Icon, empty, children }: { title: string; icon: typeof PauseCircle; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="bg-card">
      <h3 className="flex items-center gap-1.5 px-5 pt-3 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        <Icon className="size-3.5" aria-hidden />
        {title}
      </h3>
      {children.length ? <ul className="pb-2">{children}</ul> : <p className="px-5 pb-3 text-sm text-muted-foreground">{empty}</p>}
    </div>
  )
}

function Row({ href, name, detail }: { href: string; name: string; detail: string }) {
  return (
    <li>
      <Link href={href} className="block px-5 py-1.5 hover:bg-accent/50">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </Link>
    </li>
  )
}
