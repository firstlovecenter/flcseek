'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import AppBreadcrumb from '@/components/AppBreadcrumb'
import { GroupNavActions } from '@/components/group/GroupNavActions'
import { RegisterConvertForm } from '@/components/group/RegisterConvertForm'
import { LoadingScreen } from '@/components/base/LoadingScreen'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

function RegisterPersonContent() {
  const { user } = useAuth()
  const router = useRouter()
  const groupId = useParams().groupId as string

  useEffect(() => {
    if (
      user &&
      user.role !== 'superadmin' &&
      user.role !== 'leadpastor' &&
      user.role !== 'overseer' &&
      user.group_id !== groupId
    ) {
      router.push('/')
    }
  }, [user, groupId, router])

  return (
    <>
      <AppBreadcrumb />
      <div className="mb-4 flex justify-end">
        <GroupNavActions groupId={groupId} user={user} active="register" />
      </div>
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-6" />
              Register New Convert
            </CardTitle>
            <CardDescription>
              Add a new convert to track their spiritual progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterConvertForm
              groupId={groupId}
              variant="page"
              onSuccess={() => router.push(`/${groupId}`)}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default function RegisterPersonPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <RegisterPersonContent />
    </Suspense>
  )
}
