'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Eye } from 'lucide-react'
import { SynagoLoader } from '@/components/shell/SynagoLoader'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import AppBreadcrumb from '@/components/AppBreadcrumb'
import { useThemeStyles } from '@/lib/theme-utils'
import { api } from '@/lib/api'
import type { ProgressEntry, PersonApiData } from '@/lib/types/api-responses'
import { message } from '@/lib/toast'
import { LoadingScreen } from '@/components/base/LoadingScreen'
import { GroupNavActions } from '@/components/group/GroupNavActions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface Milestone {
  stage_number: number
  stage_name: string
  short_name?: string
}

interface PersonProgress {
  id: string
  full_name: string
  group_name: string
  phone_number: string
  completedStages: number
  percentage: number
}

export default function ProgressPage() {
  const { user, token, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string
  const [people, setPeople] = useState<PersonProgress[]>([])
  const themeStyles = useThemeStyles()
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [totalMilestones, setTotalMilestones] = useState<number>(18)
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<PersonProgress | null>(
    null
  )
  const [progressStages, setProgressStages] = useState<ProgressEntry[]>([])
  const [updating, setUpdating] = useState(false)

  const isLeader = user?.role === 'leader'
  const isSuperAdmin = user?.role === 'superadmin'
  const isReadOnly =
    user?.role === 'leader' ||
    user?.role === 'overseer' ||
    user?.role === 'leadpastor'

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/')
      return
    }
    if (
      user &&
      user.role !== 'superadmin' &&
      user.role !== 'leadpastor' &&
      user.role !== 'overseer' &&
      user.group_id !== groupId
    ) {
      router.push('/')
      return
    }
    if (user && token) {
      fetchMilestones()
      fetchPeople()
    }
  }, [user, token, authLoading, router, groupId])

  const fetchMilestones = async () => {
    try {
      const response = await api.milestones.list()
      if (response.success) {
        setMilestones(response.data?.milestones || [])
        setTotalMilestones(response.data?.milestones?.length || 18)
      }
    } catch (error) {
      console.error('Failed to fetch milestones:', error)
    }
  }

  const fetchPeople = async () => {
    try {
      const response = await api.people.list({ include: 'progress' })
      if (!response.success) throw new Error('Failed to fetch people')
      const milestoneCount = totalMilestones || 18
      const peopleWithProgress = (
        (response.data as { people?: PersonApiData[] })?.people || []
      ).map((person) => {
        const completedStages =
          (person.progress as ProgressEntry[] | undefined)?.filter(
            (p) => p.is_completed
          ).length || 0
        return {
          id: person.id,
          full_name: person.full_name ?? '',
          group_name: person.group_name ?? '',
          phone_number: person.phone_number,
          completedStages,
          percentage: Math.round((completedStages / milestoneCount) * 100),
        }
      })
      setPeople(peopleWithProgress)
    } catch (error: unknown) {
      message.error(
        error instanceof Error ? error.message : 'Failed to load people'
      )
    } finally {
      setLoading(false)
    }
  }

  const openProgressModal = async (person: PersonProgress) => {
    try {
      const response = await api.people.get(person.id)
      if (!response.success) throw new Error('Failed to load progress details')
      setSelectedPerson(person)
      setProgressStages(response.data?.progress || [])
      setModalVisible(true)
    } catch (error: unknown) {
      message.error(
        error instanceof Error ? error.message : 'Failed to load progress details'
      )
    }
  }

  const toggleStage = async (stageNumber: number, isCompleted: boolean) => {
    if (!selectedPerson) return
    if (isReadOnly) {
      message.warning('You do not have permission to edit progress')
      return
    }
    if (stageNumber === 1) {
      message.warning(
        'Milestone 1 is automatically completed on registration and cannot be edited'
      )
      return
    }
    if (stageNumber === 18) {
      message.error(
        'Milestone 18 depends on Attendance. Mark attendance for the required Sundays to complete automatically.'
      )
      return
    }
    if (isCompleted && !isSuperAdmin) {
      message.warning('Only superadmins can edit completed milestones')
      return
    }

    setUpdating(true)
    try {
      const response = await api.progress.update(selectedPerson.id, {
        stage_number: stageNumber,
        is_completed: !isCompleted,
      })
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update progress')
      }
      message.success('Progress updated successfully!')
      const detailsRes = await api.people.get(selectedPerson.id)
      if (detailsRes.success) {
        setProgressStages(detailsRes.data?.progress || [])
      }
      fetchPeople()
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to update progress'
      if (errorMsg.includes('Milestone 18')) message.error(errorMsg)
      else if (
        errorMsg.includes('permission') ||
        errorMsg.includes('superadmin')
      )
        message.warning('You do not have permission to edit this milestone')
      else message.error(`Failed to update progress: ${errorMsg}`)
    } finally {
      setUpdating(false)
    }
  }

  if (authLoading || loading) {
    return <LoadingScreen label="Loading milestones…" />
  }

  return (
    <>
      <AppBreadcrumb />
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Milestone Tracking
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLeader
                ? 'View spiritual growth milestones for all new converts'
                : 'Update and monitor spiritual growth milestones'}
            </p>
          </div>
          <GroupNavActions groupId={groupId} user={user} active="milestones" />
        </div>

        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Completed Stages</TableHead>
                <TableHead>Progress</TableHead>
                {!isReadOnly && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() =>
                        router.push(`/${groupId}/person/${record.id}`)
                      }
                    >
                      {record.full_name}
                    </button>
                    {isLeader && (
                      <div className="text-xs text-muted-foreground">
                        <a href={`tel:${record.phone_number}`}>
                          {record.phone_number}
                        </a>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {record.completedStages}/{totalMilestones}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Progress
                      value={record.percentage}
                      className="h-2 max-w-[150px] [&>div]:bg-success"
                    />
                  </TableCell>
                  {!isReadOnly && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => openProgressModal(record)}
                        >
                          <CheckCircle className="size-4" />
                          Update Progress
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            router.push(`/${groupId}/person/${record.id}`)
                          }
                        >
                          <Eye className="size-4" />
                          View
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={modalVisible} onOpenChange={setModalVisible}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Update Progress — {selectedPerson?.full_name}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-2">
                {progressStages.map((stage) => {
                  const disabled =
                    updating ||
                    stage.stage_number === 1 ||
                    stage.stage_number === 18 ||
                    (stage.is_completed && !isSuperAdmin)
                  return (
                    <div
                      key={stage.stage_number}
                      className={cn(
                        'rounded-lg border p-3',
                        stage.is_completed && 'bg-success/5'
                      )}
                      style={
                        stage.is_completed
                          ? {
                              backgroundColor: themeStyles.successBg,
                              borderColor: themeStyles.successBorder,
                            }
                          : undefined
                      }
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <Checkbox
                          checked={stage.is_completed}
                          disabled={disabled}
                          onCheckedChange={() =>
                            toggleStage(
                              stage.stage_number,
                              stage.is_completed
                            )
                          }
                        />
                        <div className="space-y-1">
                          <span className="font-medium">
                            {milestones.find(
                              (m) => m.stage_number === stage.stage_number
                            )?.stage_name || `Stage ${stage.stage_number}`}
                          </span>
                          {stage.stage_number === 1 && (
                            <p className="text-xs text-muted-foreground">
                              (Auto-completed on registration)
                            </p>
                          )}
                          {stage.stage_number === 18 && (
                            <p className="text-xs text-muted-foreground">
                              (Auto-calculated from attendance)
                            </p>
                          )}
                          {stage.is_completed &&
                            !isSuperAdmin &&
                            stage.stage_number !== 1 &&
                            stage.stage_number !== 18 && (
                              <p className="text-xs text-muted-foreground">
                                (Completed — Contact superadmin to edit)
                              </p>
                            )}
                        </div>
                      </label>
                    </div>
                  )
                })}
                {updating && (
                  <div className="flex justify-center py-2">
                    <SynagoLoader size={20} inline />
                  </div>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
