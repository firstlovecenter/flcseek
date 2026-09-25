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

/**
 * Where a Campus Leader lands (as Seek's Lead Pastor chooses a group): pick
 * a stream of the campus, or the whole campus, and whether to open City
 * Church Groups or Sheep Seeking. They can switch later from the sidebar.
 */
export default function CcgChoosePage() {
  const router = useRouter()
  const { me, loading } = useCcgMe()
  const { setFocus, options } = useCcgFocus()
  const campuses = (me?.roles ?? []).filter((r) => r.unit?.type === 'campus')

  const go = (portal: Portal, type: 'campus' | 'stream', id: string, roleKey: string) => {
    const key = `${portal}:${roleKey}@${type}:${id}`
    if (!options.some((o) => o.key === key)) return
    setFocus(key)
    markChosen()
    router.push('/ccg')
  }

  if (loading) return <Skeleton className="mx-auto mt-10 h-64 max-w-3xl rounded-2xl" />
  if (campuses.length === 0) {
    return <EmptyState icon={Building2} title="No campus" description="You don’t lead a campus." className="mt-12" />
  }

  const buttons = (type: 'campus' | 'stream', id: string, roleKey: string) => (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
      <Button variant="outline" className="h-10 gap-1.5" onClick={() => go('ccg', type, id, roleKey)}>
        <Network className="size-4 text-churches" />
        {PORTAL_LABEL.ccg}
      </Button>
      <Button variant="outline" className="h-10 gap-1.5" onClick={() => go('seeking', type, id, roleKey)}>
        <HeartHandshake className="size-4 text-members" />
        {PORTAL_LABEL.seeking}
      </Button>
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Choose a stream</h1>
        <p className="mt-2 text-muted-foreground">Open a stream’s City Church Groups or its Sheep Seeking. You can switch any time from the sidebar.</p>
      </div>
      {campuses.map((c) => (
        <section key={c.assignment_id} className="space-y-3">
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </span>
              <div>
                <p className="font-semibold">{c.unit!.name}</p>
                <p className="text-xs text-muted-foreground">The whole campus · {c.role.name}</p>
              </div>
            </div>
            {buttons('campus', c.unit!.id, c.role.key)}
          </Card>
          {(c.unit!.streams ?? []).length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">No streams in this campus yet.</p>
          ) : (
            <ul className="space-y-2">
              {c.unit!.streams!.map((s) => (
                <li key={s.id}>
                  <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-medium">{s.name}</p>
                    {buttons('stream', s.id, c.role.key)}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
