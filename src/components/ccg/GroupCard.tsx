'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Plus, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Initials, StickyHeader, UNIT_LEVEL, groupHref } from './synago'

export type GroupType = 'campus' | 'stream' | 'council' | 'ccg' | 'ccf'

export const GROUP_PLURAL: Record<GroupType, string> = { campus: 'Campuses', stream: 'Streams', council: 'Councils', ccg: 'CCGs', ccf: 'CCFs' }
export const CHILD_GROUP: Record<GroupType, GroupType | null> = { campus: 'stream', stream: 'council', council: 'ccg', ccg: 'ccf', ccf: null }
export const LEADER_TITLE: Record<GroupType, string> = { campus: 'Campus Leader', stream: 'Sheep Seeking Overseer', council: 'Overseer', ccg: 'City Church Governor', ccf: 'CCF Coordinator' }
export const LEADER_KEY: Record<GroupType, string> = { campus: 'campus_leader', stream: 'seeking_overseer', council: 'overseer', ccg: 'ccg_governor', ccf: 'ccf_coordinator' }

export const isGroupType = (v: string): v is GroupType => v in GROUP_PLURAL

export interface GroupCardItem {
  /** When a list mixes levels (campuses and streams with no campus). */
  type?: GroupType
  id: string
  name: string
  status: string
  members: number
  placed: number
  leader: string | null
}

/**
 * Synago's "All Governorships" page: eyebrow, "{parent} <teal>CCFs</teal>",
 * an Add button, a search box and a grid of cards.
 */
export function GroupList({
  eyebrow,
  parentName,
  type,
  items,
  addHref,
}: {
  eyebrow: React.ReactNode
  parentName: string | null
  type: GroupType
  items: GroupCardItem[] | null
  addHref?: string
}) {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const shown = items?.filter((i) => !q || i.name.toLowerCase().includes(q) || i.leader?.toLowerCase().includes(q)) ?? null
  return (
    <div className="pb-10">
      <StickyHeader className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{eyebrow}</div>
            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
              {parentName ? `${parentName} ` : 'All '}
              <span className="text-members">{GROUP_PLURAL[type]}</span>
            </h1>
          </div>
          {addHref && (
            <Button className="h-10 shrink-0 gap-1.5" asChild>
              <Link href={addHref}>
                <Plus className="size-4" />
                <span className="hidden sm:inline">Add {UNIT_LEVEL[type]}</span>
              </Link>
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${GROUP_PLURAL[type]} or leaders`}
            aria-label={`Search ${GROUP_PLURAL[type]}`}
            className="h-10 pl-9"
          />
        </div>
      </StickyHeader>
      <div className="pt-4">
        {!shown ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {q ? `No ${GROUP_PLURAL[type]} match “${search.trim()}”.` : `No ${GROUP_PLURAL[type]} yet.`}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((i) => (
              <GroupCard key={i.id} type={i.type ?? type} item={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Synago's church card: leader initials, name and level, leader, counts. */
export function GroupCard({ type, item }: { type: GroupType; item: GroupCardItem }) {
  return (
    <Link
      href={groupHref(type, item.id)}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-sm"
    >
      <Initials name={item.leader ?? item.name} className="size-11 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {item.name} <span className="text-members">{UNIT_LEVEL[type]}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">{item.leader ?? 'No leader yet'}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-[11px]">
            {item.members} members
          </Badge>
          <Badge variant="secondary" className="text-[11px]">
            {item.placed} converts
          </Badge>
          {item.status !== 'active' && (
            <Badge variant="outline" className="text-[11px] capitalize">
              {item.status}
            </Badge>
          )}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  )
}
