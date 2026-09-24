'use client'

import { use } from 'react'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { isGroupType } from '@/components/ccg/GroupCard'
import { GroupForm } from '@/components/ccg/GroupForm'

export default function EditGroupPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = use(params)
  if (!isGroupType(type)) return <ErrorScreen title="Unknown group" message="That kind of group does not exist." />
  return <GroupForm type={type} id={id} />
}
