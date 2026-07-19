'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import {
  AlertCircle,
  CheckCircle,
  Download,
  FileSpreadsheet,
  Upload,
} from 'lucide-react'
import { SynagoLoader } from '@/components/shell/SynagoLoader'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { canAccessGroupClient } from '@/lib/group-access'
import AppBreadcrumb from '@/components/AppBreadcrumb'
import {
  generateBulkRegistrationTemplate,
  parseExcelFile,
  validateMemberData,
} from '@/lib/excel-utils'
import { api } from '@/lib/api'
import type { GroupApiData } from '@/lib/types/api-responses'
import { message } from '@/lib/toast'
import { LoadingScreen } from '@/components/base/LoadingScreen'
import { GroupNavActions } from '@/components/group/GroupNavActions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface MemberData {
  first_name: string
  last_name: string
  phone_number: string
  date_of_birth: string
  gender: string
  residential_location: string
  school_residential_location?: string
  occupation_type: string
  group_id?: string
  group_name?: string
}

interface ValidationError {
  row: number
  field: string
  message: string
}

interface BulkUploadResult {
  inserted?: number
  created?: number
  skipped?: number
  duplicates?: number
}

const STEPS = ['Upload File', 'Review Data', 'Complete'] as const

function BulkRegisterContent() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [members, setMembers] = useState<MemberData[]>([])
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null)
  const [groups, setGroups] = useState<GroupApiData[]>([])

  useEffect(() => {
    if (!user) return
    fetchGroups()
  }, [user, groupId])

  useEffect(() => {
    if (!user || groups.length === 0) return
    const selected = groups.find((g) => g.id === groupId)
    if (!canAccessGroupClient(user, groupId, selected?.name)) {
      router.push('/')
    }
  }, [user, groupId, groups, router])

  const fetchGroups = async () => {
    try {
      const response = await api.groups.list()
      if (response.success) setGroups(response.data?.groups || [])
    } catch (error) {
      console.error('Failed to fetch groups:', error)
    }
  }

  const handleDownloadTemplate = async () => {
    const blob = await generateBulkRegistrationTemplate(groups.map((g) => g.name))
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bulk_registration_template.xlsx'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    message.success('Template downloaded successfully!')
  }

  const handleFileUpload = async (uploaded: File) => {
    setFile(uploaded)
    setErrors([])
    try {
      const parsedMembers = await parseExcelFile(uploaded)
      if (parsedMembers.length === 0) {
        message.error('No data found in the file')
        return
      }
      if (parsedMembers.length > 500) {
        message.error('Maximum 500 members allowed per upload')
        return
      }
      const validation = validateMemberData(
        parsedMembers,
        groups.map((g) => g.name)
      )
      if (!validation.isValid) {
        setErrors(validation.errors)
        message.warning(
          `Found ${validation.errors.length} validation error(s). Please review and fix.`
        )
      } else {
        message.success(
          `File validated successfully! ${parsedMembers.length} members ready to upload.`
        )
        setCurrentStep(1)
      }
      setMembers(parsedMembers)
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      if (errorMsg.includes('format') || errorMsg.includes('extension')) {
        message.error(
          `Invalid file format: ${errorMsg}. Please upload an Excel file (.xlsx or .xls)`
        )
      } else if (errorMsg.includes('column') || errorMsg.includes('header')) {
        message.error(
          `File structure error: ${errorMsg}. Please check the template and ensure all required columns are present.`
        )
      } else {
        message.error(
          `Error parsing file: ${errorMsg}. Please check your file format and try again.`
        )
      }
    }
  }

  const handleBulkUpload = async () => {
    if (errors.length > 0) {
      message.error('Please fix all validation errors before uploading')
      return
    }
    const selectedGroup = groups.find((g) => g.id === groupId)
    const targetGroupName = selectedGroup?.name || user?.group_name
    if (!targetGroupName) {
      message.error('Unable to determine group name. Please select a valid group.')
      return
    }
    setUploading(true)
    try {
      const membersWithGroup = members.map((member) => ({
        ...member,
        group_id: groupId || user?.group_id,
        group_name: targetGroupName,
      }))
      const response = await api.people.bulkCreate(membersWithGroup)
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to upload members')
      }
      setUploadResult(response.data)
      setCurrentStep(2)
      const insertedCount = response.data?.inserted || response.data?.created || 0
      const skippedCount = response.data?.skipped || 0
      if (skippedCount > 0) {
        message.success(
          `Successfully registered ${insertedCount} member(s)! (${skippedCount} duplicate(s) skipped)`
        )
      } else {
        message.success(`Successfully registered ${insertedCount} member(s)!`)
      }
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to upload members'
      message.error(`Upload failed: ${errorMsg}`)
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setCurrentStep(0)
    setFile(null)
    setMembers([])
    setErrors([])
    setUploadResult(null)
  }

  const groupLabel =
    groups.find((g) => g.id === groupId)?.name || 'Selected Group'

  return (
    <>
      <AppBreadcrumb />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {groupId && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm">
            Registering to: <strong>{groupLabel}</strong>
          </div>
        )}
        <GroupNavActions groupId={groupId} user={user} active="bulk-register" />
      </div>

      <div className="mx-auto max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-6" />
              Bulk Convert Registration
            </CardTitle>
            <CardDescription>
              Upload an Excel file to register multiple converts at once
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="flex flex-wrap gap-2">
              {STEPS.map((label, i) => (
                <div
                  key={label}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium',
                    i === currentStep
                      ? 'bg-primary text-primary-foreground'
                      : i < currentStep
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-background/20 text-xs">
                    {i + 1}
                  </span>
                  {label}
                </div>
              ))}
            </div>

            {currentStep === 0 && (
              <div className="space-y-6">
                <div className="rounded-lg border border-primary/20 bg-muted/30 p-4 text-sm">
                  <p className="font-medium">Before You Start</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                    <li>Download the Excel template below</li>
                    <li>Fill in the convert details (delete sample rows)</li>
                    <li>Upload the completed file</li>
                    <li>Review and submit</li>
                  </ol>
                </div>

                <Button onClick={handleDownloadTemplate}>
                  <Download className="size-4" />
                  Download Excel Template
                </Button>

                <div
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-12 transition-colors hover:border-primary/50 hover:bg-muted/40"
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && fileInputRef.current?.click()
                  }
                  role="button"
                  tabIndex={0}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleFileUpload(f)
                    }}
                  />
                  <FileSpreadsheet className="mb-3 size-12 text-primary" />
                  <p className="font-medium">
                    Click or drag Excel file to upload
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    .xlsx and .xls — maximum 500 converts per upload
                  </p>
                  <Upload className="mt-4 size-5 text-muted-foreground" />
                </div>

                {file && (
                  <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                    File uploaded: {file.name}
                  </div>
                )}

                {errors.length > 0 && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      Found {errors.length} validation error(s). Please fix and
                      re-upload.
                    </div>
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>Field</TableHead>
                            <TableHead>Error Message</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {errors.map((err) => (
                            <TableRow key={`${err.row}-${err.field}`}>
                              <TableCell>{err.row}</TableCell>
                              <TableCell>{err.field}</TableCell>
                              <TableCell>{err.message}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {members.length > 0 && errors.length === 0 && (
                  <div className="text-center">
                    <Button size="lg" onClick={() => setCurrentStep(1)}>
                      Continue to Review
                    </Button>
                  </div>
                )}
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm">
                  Ready to register {members.length} convert(s). Review the data
                  below and click Register All Converts.
                </div>
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>DOB</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Worker/Student</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((record, index) => {
                        const rowErrors = errors.filter(
                          (e) => e.row === index + 2
                        )
                        return (
                          <TableRow key={index}>
                            <TableCell>{index + 2}</TableCell>
                            <TableCell>
                              {record.first_name} {record.last_name}
                            </TableCell>
                            <TableCell>{record.phone_number}</TableCell>
                            <TableCell>{record.date_of_birth}</TableCell>
                            <TableCell>{record.gender}</TableCell>
                            <TableCell className="max-w-[160px] truncate">
                              {record.residential_location}
                            </TableCell>
                            <TableCell>{record.occupation_type}</TableCell>
                            <TableCell>
                              {rowErrors.length > 0 ? (
                                <Badge variant="destructive">
                                  <AlertCircle className="mr-1 size-3" />
                                  {rowErrors.length} Error(s)
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-success/15 text-success">
                                  <CheckCircle className="mr-1 size-3" />
                                  Valid
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-center gap-3">
                  <Button variant="outline" onClick={() => setCurrentStep(0)}>
                    Back
                  </Button>
                  <Button size="lg" disabled={uploading} onClick={handleBulkUpload}>
                    {uploading && (
                      <SynagoLoader size={16} inline />
                    )}
                    Register All Converts
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 2 && uploadResult && (
              <div className="space-y-6 text-center">
                <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm">
                  Bulk Registration Complete — registered{' '}
                  {uploadResult.inserted ?? uploadResult.created ?? 0} convert(s).
                  {uploadResult.duplicates
                    ? ` ${uploadResult.duplicates} duplicate(s) were skipped.`
                    : ''}
                </div>
                <div className="flex justify-center gap-3">
                  <Button onClick={() => router.push(`/${groupId}`)}>
                    Go to Milestones
                  </Button>
                  <Button variant="outline" onClick={resetForm}>
                    Register More Converts
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default function BulkRegisterPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <BulkRegisterContent />
    </Suspense>
  )
}
