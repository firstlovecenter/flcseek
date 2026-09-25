'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCcgMe } from '@/components/ccg/CcgMeProvider'
import { useSeekingRole } from '@/components/ccg/CcgFocusProvider'
import { ConvertMilestones, useConvertScope } from '@/components/ccg/ConvertMilestones'
import { PeopleDirectory } from '@/components/ccg/PeopleDirectory'
import { StickyHeader } from '@/components/ccg/synago'

/**
 * Converts: one page, two views. Milestones (the default) is every placed
 * convert against the CCG Manual's milestones; "All converts" is the
 * directory, including those still awaiting placement.
 */
function Converts() {
  const params = useSearchParams()
  const router = useRouter()
  const { has } = useCcgMe()
  // A Sheep Seeker sees the converts in their groups (unless a group's page sent them here).
  const mine = useSeekingRole() === 'seeker' && !params.get('unit')
  const { name } = useConvertScope()
  const view = params.get('view') === 'all' || params.get('new') === '1' ? 'all' : 'milestones'

  const setView = (v: 'milestones' | 'all') => {
    const next = new URLSearchParams(params.toString())
    if (v === 'all') next.set('view', 'all')
    else next.delete('view')
    next.delete('placement')
    router.replace(`/ccg/converts${next.size ? `?${next}` : ''}`, { scroll: false })
  }

  const tabs = (
    <div className="inline-flex w-full rounded-lg border border-border p-1 sm:w-auto" role="tablist" aria-label="Converts view">
      {(
        [
          ['milestones', 'Milestones'],
          ['all', 'All converts'],
        ] as const
      ).map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={view === v}
          onClick={() => setView(v)}
          className={cn(
            'min-h-10 flex-1 rounded-md px-4 text-sm font-medium transition-colors sm:flex-none',
            view === v ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )

  if (view === 'all') return <PeopleDirectory kind="convert" tabs={tabs} />

  const register = new URLSearchParams(params.toString())
  register.set('view', 'all')
  register.set('new', '1')

  return (
    <div className="pb-8">
      <StickyHeader className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl leading-tight font-bold tracking-tight text-foreground">
            {mine ? 'My ' : name ? `${name} ` : ''}
            <span className="text-members">Converts</span>
          </h1>
          {has('people.manage') && (
            <Button variant="outline" className="h-10 gap-1.5" asChild>
              <Link href={`/ccg/converts?${register}`}>
                <UserPlus className="size-4" />
                <span className="hidden sm:inline">Register convert</span>
              </Link>
            </Button>
          )}
        </div>
        {tabs}
      </StickyHeader>
      <ConvertMilestones mine={mine} />
    </div>
  )
}

export default function CcgConvertsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
      <Converts />
    </Suspense>
  )
}
