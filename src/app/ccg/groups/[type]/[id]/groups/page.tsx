'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ccgApi } from '@/lib/ccg/client'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { useCcgMe } from '@/components/ccg/CcgMeProvider'
import { CHILD_GROUP, GroupList, isGroupType, type GroupCardItem } from '@/components/ccg/GroupCard'
import { UNIT_LEVEL, groupHref } from '@/components/ccg/synago'

/** Every sub-group of a group ("View all" on its page). */
export default function SubGroupsPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = use(params)
  const { hasGlobal } = useCcgMe()
  const [data, setData] = useState<{ unit: { name: string }; children: { items: GroupCardItem[] } | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isGroupType(type)) return
    ccgApi.get<NonNullable<typeof data>>(`/groups/${type}/${id}?history=1`).then((r) => (r.ok ? setData(r.data) : setError(r.error.message)))
  }, [type, id])

  const child = isGroupType(type) ? CHILD_GROUP[type] : null
  if (!isGroupType(type) || !child) return <ErrorScreen title="No sub-groups" message="This kind of group has no groups inside it." />
  if (error) return <ErrorScreen title="Could not load groups" message={error} />

  return (
    <GroupList
      eyebrow={
        <Link href={groupHref(type, id)} className="hover:text-foreground">
          ‹ {data ? `${data.unit.name} ${UNIT_LEVEL[type]}` : UNIT_LEVEL[type]}
        </Link>
      }
      parentName={data?.unit.name ?? null}
      type={child}
      items={data ? data.children?.items ?? [] : null}
      addHref={hasGlobal('structure.manage') ? `/ccg/groups/new?type=${child}&parent=${id}` : undefined}
    />
  )
}
