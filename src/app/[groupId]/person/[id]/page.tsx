'use client'

import { useEffect, useState } from 'react'
import {
  Briefcase,
  Calendar,
  Home,
  MapPin,
  Phone,
  Trash2,
  User,
  Users,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import AppBreadcrumb from '@/components/AppBreadcrumb'
import { message } from '@/lib/toast'
import { useConfirm } from '@/hooks/use-confirm'
import { LoadingScreen } from '@/components/base/LoadingScreen'
import { GroupNavActions } from '@/components/group/GroupNavActions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function PersonDetailPage() {
  const { user, token, loading: authLoading } = useAuth()
  const { confirm, ConfirmDialog } = useConfirm()
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string
  const personId = params.id as string

  const [person, setPerson] = useState<Record<string, string> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const canDeleteConvert =
    user?.role === 'admin' ||
    user?.role === 'overseer' ||
    user?.role === 'leadpastor' ||
    user?.role === 'superadmin'

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth')
      return
    }
    if (
      !authLoading &&
      user &&
      user.role !== 'superadmin' &&
      user.role !== 'leadpastor' &&
      user.role !== 'overseer' &&
      user.group_id !== groupId
    ) {
      message.error('Unauthorized access to this group')
      router.push('/')
      return
    }
    if (user && token && personId) fetchPersonDetails()
  }, [user, token, authLoading, personId, groupId, router])

  const fetchPersonDetails = async () => {
    try {
      setError(null)
      const response = await fetch(`/api/people/${personId}`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        let errorMsg = 'Failed to fetch person details'
        if (typeof errorData.error === 'string') errorMsg = errorData.error
        else if (typeof errorData.error === 'object' && errorData.error?.message)
          errorMsg = errorData.error.message
        else if (typeof errorData.message === 'string') errorMsg = errorData.message
        else if (response.status === 403)
          errorMsg = 'You do not have permission to view this person'
        else if (response.status === 404) errorMsg = 'Person not found'
        else errorMsg = `HTTP ${response.status}`
        throw new Error(errorMsg)
      }
      const data = await response.json()
      setPerson(data.data?.person || data.person)
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to load person details'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!canDeleteConvert || !personId) return
    const ok = await confirm({
      title: 'Delete this convert?',
      description:
        'This will soft delete the convert. Their records are preserved but hidden from active views.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    try {
      setDeleting(true)
      const response = await fetch(`/api/people/${personId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData?.error?.message ||
            errorData?.message ||
            'Failed to delete convert'
        )
      }
      message.success('Convert deleted successfully')
      router.push(`/${groupId}`)
    } catch (err: unknown) {
      message.error(
        err instanceof Error ? err.message : 'Failed to delete convert'
      )
    } finally {
      setDeleting(false)
    }
  }

  if (authLoading || loading) {
    return <LoadingScreen label="Loading person…" />
  }

  const InfoTile = ({
    label,
    value,
    className,
  }: {
    label: string
    value: React.ReactNode
    className?: string
  }) => (
    <div className={cn('rounded-lg border bg-muted/30 p-4', className)}>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="text-base font-semibold">{value}</div>
    </div>
  )

  return (
    <>
      {ConfirmDialog}
      <AppBreadcrumb />
      {error && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive">
          {error}
          <Button size="sm" variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      )}
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">
            {person?.first_name} {person?.last_name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <GroupNavActions groupId={groupId} user={user} active="milestones" />
            {canDeleteConvert && (
              <Button
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={handleDelete}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-5xl">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-[#003366] to-[#004080] px-8 py-7">
              <div className="flex flex-wrap items-center gap-5">
                <div className="flex size-[76px] shrink-0 items-center justify-center rounded-full bg-white text-3xl font-bold text-[#003366] shadow-md">
                  {person?.first_name?.charAt(0)}
                  {person?.last_name?.charAt(0)}
                </div>
                <div className="min-w-0 space-y-2">
                  <h2 className="text-2xl font-bold text-white">
                    {person?.first_name} {person?.last_name}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {person?.group_name && (
                      <Badge className="bg-white/15 text-white hover:bg-white/20">
                        <Calendar className="mr-1 size-3" />
                        {person.group_name}
                      </Badge>
                    )}
                    {person?.occupation_type && (
                      <Badge className="bg-white/15 text-white hover:bg-white/20">
                        <Briefcase className="mr-1 size-3" />
                        {person.occupation_type}
                      </Badge>
                    )}
                    {person?.gender && (
                      <Badge className="bg-white/15 text-white hover:bg-white/20">
                        <User className="mr-1 size-3" />
                        {person.gender}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <CardContent className="space-y-8 p-6">
              <section>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-primary">
                  <Phone className="size-5" />
                  Contact Information
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoTile
                    label="Phone Number"
                    value={
                      <a
                        href={`tel:${person?.phone_number}`}
                        className="text-primary hover:underline"
                      >
                        {person?.phone_number}
                      </a>
                    }
                  />
                  <InfoTile
                    label="Date of Birth"
                    value={person?.date_of_birth || 'N/A'}
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-primary">
                  <User className="size-5" />
                  Personal Details
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoTile label="Gender" value={person?.gender || 'N/A'} />
                  <InfoTile
                    label="Occupation Type"
                    value={person?.occupation_type || 'N/A'}
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-primary">
                  <MapPin className="size-5" />
                  Location Information
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoTile
                    label="Residential Location"
                    value={
                      <span className="inline-flex items-center gap-2">
                        <Home className="size-4 text-muted-foreground" />
                        {person?.residential_location || 'N/A'}
                      </span>
                    }
                  />
                  {person?.school_residential_location && (
                    <InfoTile
                      label="School Location"
                      value={person.school_residential_location}
                    />
                  )}
                </div>
              </section>

              {user?.role === 'superadmin' && person?.department_name && (
                <section className="border-t pt-6">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-primary">
                    <Users className="size-5" />
                    Administrative Information
                  </h3>
                  <InfoTile
                    label="Department"
                    value={person.department_name}
                    className="max-w-md"
                  />
                </section>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
