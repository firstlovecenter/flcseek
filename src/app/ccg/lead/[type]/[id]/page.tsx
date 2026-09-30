'use client'

import { Suspense, use, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { useLeaderView } from '@/components/ccg/CcgFocusProvider'
import { LeaderUnitView, MonthPicker, rememberedMonth, useMonthParam } from '@/components/ccg/LeaderView'

/**
 * A stream (a Campus Leader's pick) or a CCG (a Stream Leader's, from the
 * sidebar) for one month: its converts' milestones board, then its dashboard.
 * With no month in the link, the one chosen earlier this session, else ask.
 */
export default function LeaderUnitPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = use(params)
  if (type !== 'stream' && type !== 'ccg') return <ErrorScreen title="Unknown group" message="Choose a stream or a CCG." />
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
      <LeaderUnit type={type} id={id} />
    </Suspense>
  )
}

function LeaderUnit({ type, id }: { type: 'stream' | 'ccg'; id: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const leader = useLeaderView()
  const fromUrl = useMonthParam()
  const picking = useSearchParams().get('pick') === 'month'
  const [saved, setSaved] = useState<string | null | undefined>(undefined)
  useEffect(() => setSaved(rememberedMonth()), [])

  const month = picking ? null : fromUrl ?? saved
  if (month === undefined) return <Skeleton className="h-64 rounded-xl" />
  if (!month) {
    return <MonthPicker unit={{ type, id }} onPick={(m) => router.replace(`${pathname}?month=${m}`)} />
  }

  // Back to where they came from: a Campus Leader's streams, a Stream Leader's whole stream.
  const back =
    leader?.type === 'campus'
      ? { href: `/ccg?month=${month}`, label: 'All streams' }
      : leader?.type === 'stream'
        ? { href: `/ccg?month=${month}`, label: `${leader.name} Stream` }
        : undefined
  return <LeaderUnitView type={type} id={id} month={month} back={back} changeMonthHref={`${pathname}?pick=month`} />
}
