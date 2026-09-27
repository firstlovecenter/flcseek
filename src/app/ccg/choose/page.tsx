'use client'

import { useRouter } from 'next/navigation'
import { Building2, HeartHandshake, Network } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/base/EmptyState'
import { useCcgMe } from '@/components/ccg/CcgMeProvider'
import { PORTAL_LABEL, useCcgFocus, type Portal } from '@/components/ccg/CcgFocusProvider'
import { markChosen } from '@/components/ccg/campus-choice'
import { OrbField } from '@/components/base/Orbs'

/**
 * Where a Campus Leader lands (as Seek's Lead Pastor chooses a group): their
 * campus, and whether to open City Church Groups or Sheep Seeking. They can
 * switch later from the sidebar.
 */
export default function CcgChoosePage() {
  const router = useRouter()
  const { me, loading } = useCcgMe()
  const { setFocus, options } = useCcgFocus()
  const campuses = (me?.roles ?? []).filter((r) => r.unit?.type === 'campus')

  const go = (portal: Portal, id: string, roleKey: string) => {
    const key = `${portal}:${roleKey}@campus:${id}`
    if (!options.some((o) => o.key === key)) return
    setFocus(key)
    markChosen()
    router.push('/ccg')
  }

  if (loading) return <Skeleton className="mx-auto mt-10 h-64 max-w-3xl rounded-2xl" />
  if (campuses.length === 0) {
    return <EmptyState icon={Building2} title="No campus" description="You don’t have a campus role." className="mt-12" />
  }

  // Only the portals this role works in (a campus Sheep Seeking role: Sheep Seeking only).
  const has = (portal: Portal, id: string, roleKey: string) => options.some((o) => o.key === `${portal}:${roleKey}@campus:${id}`)
  const buttons = (id: string, roleKey: string) => (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
      {has('ccg', id, roleKey) && (
        <Button variant="outline" className="h-10 gap-1.5" onClick={() => go('ccg', id, roleKey)}>
          <Network className="size-4 text-churches" />
          {PORTAL_LABEL.ccg}
        </Button>
      )}
      {has('seeking', id, roleKey) && (
        <Button variant="outline" className="h-10 gap-1.5" onClick={() => go('seeking', id, roleKey)}>
          <HeartHandshake className="size-4 text-members" />
          {PORTAL_LABEL.seeking}
        </Button>
      )}
    </div>
  )

  return (
    <div className="relative isolate min-h-[80dvh] overflow-hidden rounded-2xl">
      <OrbField colors={['churches', 'members']} intensity={0.28} className="-z-10" />
      <div className="mx-auto max-w-3xl space-y-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Choose where to start</h1>
          <p className="mt-2 text-muted-foreground">Open your campus’s City Church Groups or its Sheep Seeking. You can switch any time from the sidebar.</p>
        </div>
        {campuses.map((c) => (
          <Card
            key={c.assignment_id}
            className="flex flex-col gap-3 bg-card/85 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </span>
              <div>
                <p className="font-semibold">{c.unit!.name}</p>
                <p className="text-xs text-muted-foreground">The whole campus · {c.role.name}</p>
              </div>
            </div>
            {buttons(c.unit!.id, c.role.key)}
          </Card>
        ))}
      </div>
    </div>
  )
}
