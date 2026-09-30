'use client'

import { Suspense, use, useMemo, useState } from 'react'
import { BarChart3, CheckCircle, Download, FileSpreadsheet, FileText, Filter, LineChart, Users } from 'lucide-react'
import { message } from '@/lib/toast'
import { StatCard } from '@/components/base/StatCard'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { LoadingScreen } from '@/components/base/LoadingScreen'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  ContextPill,
  LeadNavActions,
  WithMonth,
  monthLabel,
  sundayAttendance,
  useLeadProgress,
  useUnitName,
  type LeadUnitType,
} from '@/components/ccg/LeaderView'
import { UNIT_LEVEL } from '@/components/ccg/synago'

/**
 * Seek's Reports page as a Lead Pastor saw it, for a stream or CCG's converts
 * of one month: summary, attendance, milestones and each convert's
 * performance, with CSV and PDF export.
 */
export default function LeadReportsPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = use(params)
  if (type !== 'stream' && type !== 'ccg') return <ErrorScreen title="Unknown group" message="Choose a stream or a CCG." />
  return (
    <Suspense fallback={<LoadingScreen label="Loading reports…" />}>
      <WithMonth type={type} id={id}>
        {(month) => <Reports type={type} id={id} month={month} />}
      </WithMonth>
    </Suspense>
  )
}

interface ConvertDetail {
  id: string
  full_name: string
  phone_number: string
  attendanceCount: number
  attendancePercentage: number
  milestonesCompleted: number
  totalMilestones: number
  milestonePercentage: number
}

function Reports({ type, id, month }: { type: LeadUnitType; id: string; month: string }) {
  const name = useUnitName(type, id)
  const { data, error, reload } = useLeadProgress(type, id, month)
  const [reportType, setReportType] = useState('summary')

  const { goal, attendanceSummary, milestoneSummaries, convertDetails } = useMemo(() => {
    const milestones = [...(data?.milestones ?? [])].sort((a, b) => a.stage_number - b.stage_number)
    const rows = data?.rows ?? []
    const total = milestones.length
    const done = (stages: (typeof rows)[number]['stages'], n: number) => stages.find((s) => s.stage_number === n)?.state === 'done'
    const details: ConvertDetail[] = rows.map((r) => {
      const a = sundayAttendance(r, milestones)
      const completed = milestones.filter((m) => done(r.stages, m.stage_number)).length
      return {
        id: r.placement_id,
        full_name: r.person.full_name,
        phone_number: r.person.phone ?? '',
        attendanceCount: a.count,
        attendancePercentage: a.percentage,
        milestonesCompleted: completed,
        totalMilestones: total,
        milestonePercentage: total ? Math.round((completed / total) * 100) : 0,
      }
    })
    const withAttendance = details.filter((d) => d.attendanceCount > 0).length
    const totalAttendance = details.reduce((sum, d) => sum + d.attendanceCount, 0)
    return {
      goal: milestones.find((m) => m.kind === 'attendance' && m.attendance_event === 'sunday_service')?.attendance_target ?? 0,
      attendanceSummary: {
        totalConverts: details.length,
        withAttendance,
        percentage: details.length ? Math.round((withAttendance / details.length) * 100) : 0,
        avgAttendance: details.length ? Math.round((totalAttendance / details.length) * 10) / 10 : 0,
      },
      milestoneSummaries: milestones.map((m) => {
        const completed = rows.filter((r) => done(r.stages, m.stage_number)).length
        return {
          stageNumber: m.stage_number,
          stageName: m.name,
          completed,
          total: rows.length,
          percentage: rows.length ? Math.round((completed / rows.length) * 100) : 0,
        }
      }),
      convertDetails: details,
    }
  }, [data])

  const sortedAttendance = useMemo(() => [...convertDetails].sort((a, b) => b.attendanceCount - a.attendanceCount), [convertDetails])
  const overallOf = (d: ConvertDetail) => (d.attendancePercentage + d.milestonePercentage) / 2
  const sortedPerformance = useMemo(() => [...convertDetails].sort((a, b) => overallOf(b) - overallOf(a)), [convertDetails])

  if (error) return <ErrorScreen title="Could not load reports" message={error} onRetry={reload} />
  if (!data) return <LoadingScreen label="Loading reports…" />

  const groupName = `${name ?? ''} ${UNIT_LEVEL[type]}`.trim()
  const fileTag = `${(name ?? type).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${month}`
  const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ')

  const save = (content: string, filename: string, type: string) => {
    const url = window.URL.createObjectURL(new Blob([content], { type }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const downloadAsCSV = (kind: string = 'all') => {
    if (convertDetails.length === 0) return message.warning('No data to download')
    let csv = ''
    if (kind === 'attendance') {
      csv = [
        'Name,Phone,Attendance Count,Attendance %,Goal,Status',
        ...convertDetails.map((d) =>
          [`"${d.full_name}"`, d.phone_number, d.attendanceCount, d.attendancePercentage, goal, d.attendanceCount >= goal ? 'Achieved' : 'In Progress'].join(',')
        ),
      ].join('\n')
    } else if (kind === 'milestones') {
      csv = [
        'Stage #,Milestone Name,Completed,Total Converts,Completion %',
        ...milestoneSummaries.map((m) => [m.stageNumber, `"${m.stageName}"`, m.completed, m.total, m.percentage].join(',')),
      ].join('\n')
    } else if (kind === 'performance') {
      csv = [
        'Name,Phone,Attendance Count,Attendance %,Milestones Completed,Milestone %,Overall %',
        ...convertDetails.map((d) =>
          [`"${d.full_name}"`, d.phone_number, d.attendanceCount, d.attendancePercentage, d.milestonesCompleted, d.milestonePercentage, Math.round(overallOf(d))].join(',')
        ),
      ].join('\n')
    } else {
      csv = '=== SUMMARY ===\n'
      csv += `Group:,${groupName}\nMonth:,${monthLabel(month)}\nReport Date:,${now()}\n`
      csv += `Total Converts:,${attendanceSummary.totalConverts}\nConverts with Attendance:,${attendanceSummary.withAttendance}\n`
      csv += `Attendance Percentage:,${attendanceSummary.percentage}%\nAverage Attendance:,${attendanceSummary.avgAttendance}\n`
      csv += `Attendance Goal:,${goal}\nTotal Milestones:,${milestoneSummaries.length}\n\n`
      csv += '=== MILESTONE COMPLETION SUMMARY ===\nStage #,Milestone Name,Completed,Total Converts,Completion %\n'
      milestoneSummaries.forEach((m) => (csv += `${m.stageNumber},"${m.stageName}",${m.completed},${m.total},${m.percentage}%\n`))
      csv += '\n=== CONVERT PERFORMANCE DETAILS ===\nName,Phone,Attendance Count,Attendance %,Milestones Completed,Milestone %,Overall %\n'
      convertDetails.forEach(
        (d) =>
          (csv += `"${d.full_name}",${d.phone_number},${d.attendanceCount},${d.attendancePercentage}%,${d.milestonesCompleted},${d.milestonePercentage}%,${Math.round(overallOf(d))}%\n`)
      )
    }
    save(csv, `${kind === 'all' ? 'complete' : kind === 'milestones' ? 'milestone' : kind}-report-${fileTag}.csv`, 'text/csv;charset=utf-8;')
    message.success('Report downloaded successfully')
  }

  const downloadAsPDF = async (kind: string = 'all') => {
    if (convertDetails.length === 0) return message.warning('No data to export')
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15
    let yPos = 20
    const title = { all: 'Complete Report', attendance: 'Attendance Report', milestones: 'Milestone Report', performance: 'Performance Report' }[kind] ?? 'Report'
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(title, pageWidth / 2, yPos, { align: 'center' })
    yPos += 10
    doc.setFontSize(14)
    doc.text(`${groupName} - ${monthLabel(month)}`, pageWidth / 2, yPos, { align: 'center' })
    yPos += 8
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${now()}`, pageWidth / 2, yPos, { align: 'center' })
    yPos += 15

    const section = (heading: string, head: string[], body: Array<Array<string | number>>, color: [number, number, number]) => {
      if (yPos > pageHeight - 60) {
        doc.addPage()
        yPos = 20
      }
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(heading, 14, yPos)
      yPos += 10
      autoTable(doc, { startY: yPos, head: [head], body, theme: 'striped', headStyles: { fillColor: color, textColor: 255, fontStyle: 'bold' }, margin: { left: 14, right: 14 } })
      yPos = lastY()
    }
    const summary = () =>
      section(
        'Summary',
        ['Metric', 'Value'],
        [
          ['Total Converts', attendanceSummary.totalConverts],
          ['Converts with Attendance', `${attendanceSummary.withAttendance} (${attendanceSummary.percentage}%)`],
          ['Average Attendance', `${attendanceSummary.avgAttendance} / ${goal} Sundays`],
          ['Attendance Goal', `${goal} Sundays`],
          ['Total Milestones', milestoneSummaries.length],
        ],
        [41, 128, 185]
      )
    const milestonesTable = () =>
      section('Milestone Completion', ['Stage', 'Milestone Name', 'Completed', 'Total', 'Percentage'], milestoneSummaries.map((m) => [m.stageNumber, m.stageName, m.completed, m.total, `${m.percentage}%`]), [52, 152, 219])
    const attendanceTable = () =>
      section('Attendance Details', ['Name', 'Phone', 'Attendance', 'Goal', 'Progress'], sortedAttendance.map((d) => [d.full_name, d.phone_number || 'N/A', d.attendanceCount, goal, `${d.attendancePercentage}%`]), [46, 204, 113])
    const performanceTable = () =>
      section(
        'Convert Performance',
        ['Name', 'Phone', 'Attendance', 'Milestones', 'Overall'],
        sortedPerformance.map((d) => [d.full_name, d.phone_number || 'N/A', `${d.attendancePercentage}%`, `${d.milestonePercentage}%`, `${Math.round(overallOf(d))}%`]),
        [155, 89, 182]
      )

    summary()
    if (kind === 'attendance') attendanceTable()
    else if (kind === 'milestones') milestonesTable()
    else if (kind === 'performance') performanceTable()
    else {
      milestonesTable()
      attendanceTable()
      performanceTable()
    }
    const pages = doc.getNumberOfPages()
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(`Page ${i} of ${pages}`, pageWidth / 2, pageHeight - 10, { align: 'center' })
    }
    doc.save(`${kind}-report-${fileTag}.pdf`)
    message.success('PDF exported successfully')
  }

  return (
    <TooltipProvider>
      <div className="mb-3 pr-12 md:pr-0">
        <ContextPill name={name} type={type} month={month} />
      </div>
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BarChart3 className="size-7" />
            Reports
          </h1>
          <LeadNavActions type={type} id={id} month={month} active="reports" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Comprehensive analytics and reporting for convert tracking and milestone progress</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Download className="size-4" />
                Export Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => downloadAsCSV('all')}>
                <FileText className="mr-2 size-4" />
                Complete Report (All Data)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadAsPDF('all')}>
                <FileSpreadsheet className="mr-2 size-4" />
                Complete Report (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadAsCSV('attendance')}>
                <CheckCircle className="mr-2 size-4" />
                Attendance Report
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadAsPDF('attendance')}>Attendance Report (PDF)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadAsCSV('milestones')}>
                <BarChart3 className="mr-2 size-4" />
                Milestone Report
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadAsPDF('milestones')}>Milestone Report (PDF)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadAsCSV('performance')}>
                <LineChart className="mr-2 size-4" />
                Performance Report
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadAsPDF('performance')}>Performance Report (PDF)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Converts" value={attendanceSummary.totalConverts} icon={Users} accent="members" />
        <StatCard title="With Attendance" value={`${attendanceSummary.percentage}%`} icon={CheckCircle} accent="arrivals" />
        <StatCard title="Avg Attendance" value={attendanceSummary.avgAttendance} subtitle={`/${goal}`} icon={LineChart} accent="campaigns" />
        <StatCard title="Milestones" value={milestoneSummaries.length} icon={Filter} accent="primary" />
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs value={reportType} onValueChange={setReportType}>
            <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="attendance">Attendance Details</TabsTrigger>
              <TabsTrigger value="milestones">Milestone Progress</TabsTrigger>
              <TabsTrigger value="converts">Convert Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Attendance Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p>
                      <strong>{attendanceSummary.withAttendance}</strong> of <strong>{attendanceSummary.totalConverts}</strong> converts have attended at least one service.
                    </p>
                    <p>
                      Average attendance: <strong>{attendanceSummary.avgAttendance}</strong> out of <strong>{goal}</strong> Sundays.
                    </p>
                    <Progress value={attendanceSummary.percentage} />
                    <p className="text-xs text-muted-foreground">{attendanceSummary.percentage}% with attendance</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Milestone Completion</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {milestoneSummaries.slice(0, 5).map((m) => (
                      <div key={m.stageNumber}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span>
                            <strong>{m.stageNumber}.</strong> {m.stageName}
                          </span>
                          <span>
                            {m.completed}/{m.total}
                          </span>
                        </div>
                        <Progress value={m.percentage} className="h-1.5" />
                      </div>
                    ))}
                    {milestoneSummaries.length > 5 && <p className="text-xs text-muted-foreground">+ {milestoneSummaries.length - 5} more milestones</p>}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="attendance">
              <div className="mb-4 flex justify-end">
                <Button variant="outline" onClick={() => downloadAsCSV('attendance')}>
                  <Download className="size-4" />
                  Export Attendance
                </Button>
              </div>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAttendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-semibold">{record.full_name}</TableCell>
                        <TableCell>{record.phone_number}</TableCell>
                        <TableCell>
                          <Badge variant={goal && record.attendanceCount >= goal ? 'default' : 'secondary'}>
                            {record.attendanceCount}/{goal}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Progress value={record.attendancePercentage} className="h-2 max-w-[150px]" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="milestones">
              <div className="mb-4 flex justify-end">
                <Button variant="outline" onClick={() => downloadAsCSV('milestones')}>
                  <Download className="size-4" />
                  Export Milestones
                </Button>
              </div>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Milestone</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {milestoneSummaries.map((record) => (
                      <TableRow key={record.stageNumber}>
                        <TableCell>
                          <strong>{record.stageNumber}</strong>. {record.stageName}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {record.completed}/{record.total}
                        </TableCell>
                        <TableCell>
                          <div className="flex max-w-[200px] items-center gap-2">
                            <Progress value={record.percentage} className="h-2 flex-1" />
                            <span className="text-xs tabular-nums">{record.percentage}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="converts">
              <div className="mb-4 flex justify-end">
                <Button variant="outline" onClick={() => downloadAsCSV('performance')}>
                  <Download className="size-4" />
                  Export Performance
                </Button>
              </div>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead>Milestones</TableHead>
                      <TableHead>Overall</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPerformance.map((record) => {
                      const overall = Math.round(overallOf(record))
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-semibold">{record.full_name}</TableCell>
                          <TableCell>{record.phone_number}</TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex size-12 items-center justify-center rounded-full border-2 border-primary text-xs font-bold">
                                  {record.attendancePercentage}%
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {record.attendanceCount}/{goal} Sundays
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex size-12 items-center justify-center rounded-full border-2 border-primary text-xs font-bold">
                                  {record.milestonePercentage}%
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {record.milestonesCompleted}/{record.totalMilestones} milestones
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Badge variant={overall >= 75 ? 'default' : overall >= 50 ? 'secondary' : 'outline'}>{overall}%</Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
