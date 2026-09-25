'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ccgApi } from '@/lib/ccg/client'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { useCcgMe } from '@/components/ccg/CcgMeProvider'
import { useCcgFocus } from '@/components/ccg/CcgFocusProvider'
import { GroupList, type GroupCardItem } from '@/components/ccg/GroupCard'
import { groupHref } from '@/components/ccg/synago'

/**
 * Groups: opens the group in focus, as Synago's church pages do. With the
 * whole church in focus it lists the streams.
 */
export default function CcgGroupsPage() {
  const router = useRouter()
  const { hasGlobal } = useCcgMe()
  const { focus, ready } = useCcgFocus()
  const [items, setItems] = useState<GroupCardItem[] | null>(null)
  const [topType, setTopType] = useState<'campus' | 'stream'>('stream')
  const [error, setError] = useState<string | null>(null)
  const unit = focus && focus.type !== 'global' && focus.id ? { type: focus.type, id: focus.id } : null

  useEffect(() => {
    if (!ready) return
    if (unit) {
      router.replace(groupHref(unit.type, unit.id))
      return
    }
    ccgApi.get<{ type: 'campus' | 'stream'; items: GroupCardItem[] }>('/groups').then((r) => {
      if (!r.ok) return setError(r.error.message)
      setTopType(r.data.type)
      setItems(r.data.items)
    })
  }, [ready, unit?.type, unit?.id, router]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorScreen title="Could not load groups" message={error} />
  return (
    <GroupList
      eyebrow="The whole church"
      parentName={null}
      type={topType}
      items={unit ? null : items}
      addHref={hasGlobal('structure.manage') ? `/ccg/groups/new?type=${topType}` : undefined}
    />
  )
}
