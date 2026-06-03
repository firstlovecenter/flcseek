'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  LineChart,
  Users,
} from 'lucide-react';
import { message } from '@/lib/toast';
import { LoadingScreen } from '@/components/base/LoadingScreen';
import { StatCard } from '@/components/base/StatCard';
import { GroupNavActions } from '@/components/group/GroupNavActions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PredictiveAnalyticsDashboard } from '@/components/PredictiveAnalyticsDashboard';
import { CohortAnalysisDashboard } from '@/components/CohortAnalysisDashboard';
import { GrowthForecastDashboard } from '@/components/GrowthForecastDashboard';
import { BulkActionsUI } from '@/components/BulkActionsUI';
import { ReportTemplateBuilder } from '@/components/ReportTemplateBuilder';
import { WidgetErrorBoundary } from '@/components/ErrorBoundary';
import { AchievementBadgesDashboard } from '@/components/AchievementBadgesDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import AppBreadcrumb from '@/components/AppBreadcrumb';
import { api } from '@/lib/api';
import { ATTENDANCE_GOAL } from '@/lib/constants';
import dayjs from 'dayjs';
import type { MilestoneData, PersonApiData, GroupApiData, AttendanceRecord } from '@/lib/types/api-responses';

interface AttendanceSummary {
  totalConverts: number;
  withAttendance: number;
  percentage: number;
  avgAttendance: number;
}

interface MilestoneSummary {
  stageNumber: number;
  stageName: string;
  completed: number;
  total: number;
  percentage: number;
}

interface ConvertDetail {
  id: string;
  full_name: string;
  phone_number: string;
  attendanceCount: number;
  attendancePercentage: number;
  milestonesCompleted: number;
  totalMilestones: number;
  milestonePercentage: number;
}

export default function ReportsPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;

  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('summary');
  const [people, setPeople] = useState<PersonApiData[]>([]);
  const [milestones, setMilestones] = useState<MilestoneData[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [milestoneSummaries, setMilestoneSummaries] = useState<MilestoneSummary[]>([]);
  const [convertDetails, setConvertDetails] = useState<ConvertDetail[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [groupName, setGroupName] = useState<string>('');

  // Check auth
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
      return;
    }

    // Reports only available to superadmin, leadpastor, and overseer (NOT admin or leader)
    if (user && user.role !== 'superadmin' && user.role !== 'leadpastor' && user.role !== 'overseer') {
      router.push('/');
      return;
    }

    if (user && token) {
      fetchAvailableYears();
    }
  }, [user, token, authLoading, router, groupId]);

  const fetchAvailableYears = async () => {
    try {
      const response = await api.groups.list({ active: true });
      if (response.success && response.data) {
        const groups: GroupApiData[] = (response.data.groups as GroupApiData[]) || [];
        const selectedGroup = groups.find((g) => g.id === groupId);
        if (!selectedGroup) {
          throw new Error('Group not found');
        }

        const monthName = selectedGroup.name;
        const matchingGroups = groups.filter((g) => g.name.toLowerCase() === monthName.toLowerCase());
        const years = Array.from(new Set(matchingGroups.map((g) => g.year))) as number[];
        years.sort((a, b) => b - a);

        setGroupName(monthName);
        setAvailableYears(years);
        if (selectedGroup.year) {
          setSelectedYear(selectedGroup.year);
        } else if (years.length > 0) {
          setSelectedYear(years[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch years:', error);
      message.error('Failed to load group data');
    }
  };

  useEffect(() => {
    if (selectedYear && token) {
      fetchReportData();
    }
  }, [selectedYear, token]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      // Fetch people with progress
      const peopleResponse = await api.people.list({
        group_id: groupId,
        year: selectedYear || undefined,
        include: 'progress',
      });

      if (!peopleResponse.success) throw new Error('Failed to fetch people');

      const peopleData: PersonApiData[] = (peopleResponse.data?.people as PersonApiData[]) || [];
      const totalMilestones: number = (peopleResponse.data?.totalMilestones as number) || 18;

      // Fetch milestones
      const milestonesResponse = await api.milestones.list();
      if (milestonesResponse.success) {
        setMilestones((milestonesResponse.data?.milestones as MilestoneData[]) || []);
      }

      // Fetch attendance records
      const attendanceResponse = await api.attendance.list({
        group_id: groupId,
      });

      // Process data
      processPeopleData(peopleData, (attendanceResponse.data?.attendance as AttendanceRecord[]) || [], totalMilestones, (milestonesResponse.data?.milestones as MilestoneData[]) || []);
      setPeople(peopleData);
    } catch (error: unknown) {
      console.error('Failed to fetch report data:', error);
      message.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const processPeopleData = (peopleData: PersonApiData[], attendanceRecords: AttendanceRecord[], totalMilestones: number, milestonesData: MilestoneData[]) => {
    // Attendance Summary
    const withAttendance = peopleData.filter((p) => (p.attendance_count || 0) > 0).length;
    const totalAttendance = peopleData.reduce((sum, p) => sum + (p.attendance_count || 0), 0);
    const avgAttendance = peopleData.length > 0 ? totalAttendance / peopleData.length : 0;

    setAttendanceSummary({
      totalConverts: peopleData.length,
      withAttendance,
      percentage: peopleData.length > 0 ? Math.round((withAttendance / peopleData.length) * 100) : 0,
      avgAttendance: Math.round(avgAttendance * 10) / 10,
    });

    // Milestone Summaries
    const milestoneSums: Record<number, { completed: number; total: number }> = {};
    
    milestonesData.forEach((m) => {
      milestoneSums[m.stage_number] = { completed: 0, total: peopleData.length };
    });

    peopleData.forEach((person) => {
      (person.progress || []).forEach((p) => {
        if (p.is_completed && milestoneSums[p.stage_number]) {
          milestoneSums[p.stage_number].completed++;
        }
      });
    });

    const summaries = milestonesData.map((m) => ({
      stageNumber: m.stage_number,
      stageName: m.stage_name,
      completed: milestoneSums[m.stage_number]?.completed || 0,
      total: milestoneSums[m.stage_number]?.total || peopleData.length,
      percentage: peopleData.length > 0 ? Math.round(((milestoneSums[m.stage_number]?.completed || 0) / peopleData.length) * 100) : 0,
    }));

    setMilestoneSummaries(summaries);

    // Convert Details
    const details = peopleData.map((person) => ({
      id: person.id,
      full_name: person.full_name ?? `${person.first_name} ${person.last_name}`,
      phone_number: person.phone_number,
      attendanceCount: person.attendance_count || 0,
      attendancePercentage: Math.min(Math.round(((person.attendance_count || 0) / ATTENDANCE_GOAL) * 100), 100),
      milestonesCompleted: (person.progress || []).filter((p) => p.is_completed).length,
      totalMilestones,
      milestonePercentage: Math.round(((person.progress?.filter((p) => p.is_completed).length || 0) / totalMilestones) * 100),
    }));

    setConvertDetails(details);
  };

  const downloadAsPDF = async (type: string = 'all') => {
    if (!attendanceSummary) {
      message.warning('No data to export');
      return;
    }

    // Lazy-load the PDF libraries so they stay out of the page's initial bundle.
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    const typeLabel = {
      all: 'Complete Report',
      attendance: 'Attendance Report',
      milestones: 'Milestone Report',
      performance: 'Performance Report',
    }[type] || 'Report';
    doc.text(typeLabel, pageWidth / 2, yPos, { align: 'center' });
    
    // Group name and year
    yPos += 10;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${groupName} - ${selectedYear || dayjs().year()}`, pageWidth / 2, yPos, { align: 'center' });
    
    // Subheader
    yPos += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${dayjs().format('YYYY-MM-DD HH:mm')}`, pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 15;

    const addSummarySection = () => {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary', 14, yPos);
      yPos += 10;

      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value']],
        body: [
          ['Total Converts', `${attendanceSummary?.totalConverts || 0}`],
          ['Converts with Attendance', `${attendanceSummary?.withAttendance || 0} (${attendanceSummary?.percentage || 0}%)`],
          ['Average Attendance', `${attendanceSummary?.avgAttendance || 0} / ${ATTENDANCE_GOAL} Sundays`],
          ['Attendance Goal', `${ATTENDANCE_GOAL} Sundays`],
          ['Total Milestones', `${milestoneSummaries.length}`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        margin: { left: 14, right: 14 },
      });

      yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
    };

    const addMilestonesTable = () => {
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Milestone Completion', 14, yPos);
      yPos += 10;

      autoTable(doc, {
        startY: yPos,
        head: [['Stage', 'Milestone Name', 'Completed', 'Total', 'Percentage']],
        body: milestoneSummaries.map((m) => [
          `${m.stageNumber}`,
          m.stageName,
          `${m.completed}`,
          `${m.total}`,
          `${m.percentage}%`,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [52, 152, 219], textColor: 255, fontStyle: 'bold' },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 25, halign: 'center' },
        },
      });

      yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
    };

    const addAttendanceTable = () => {
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Attendance Details', 14, yPos);
      yPos += 10;

      const sortedByAttendance = [...convertDetails].sort((a, b) => b.attendanceCount - a.attendanceCount);

      autoTable(doc, {
        startY: yPos,
        head: [['Name', 'Phone', 'Attendance', 'Goal', 'Progress']],
        body: sortedByAttendance.map((d) => [
          d.full_name,
          d.phone_number || 'N/A',
          `${d.attendanceCount}`,
          `${ATTENDANCE_GOAL}`,
          `${d.attendancePercentage}%`,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [46, 204, 113], textColor: 255, fontStyle: 'bold' },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 35 },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 25, halign: 'center' },
        },
      });

      yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
    };

    const addPerformanceTable = () => {
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Convert Performance', 14, yPos);
      yPos += 10;

      const sorted = [...convertDetails].sort((a, b) => {
        const overallA = (a.attendancePercentage + a.milestonePercentage) / 2;
        const overallB = (b.attendancePercentage + b.milestonePercentage) / 2;
        return overallB - overallA;
      });

      autoTable(doc, {
        startY: yPos,
        head: [['Name', 'Phone', 'Attendance', 'Milestones', 'Overall']],
        body: sorted.map((d) => {
          const overall = Math.round((d.attendancePercentage + d.milestonePercentage) / 2);
          return [
            d.full_name,
            d.phone_number || 'N/A',
            `${d.attendancePercentage}%`,
            `${d.milestonePercentage}%`,
            `${overall}%`,
          ];
        }),
        theme: 'striped',
        headStyles: { fillColor: [155, 89, 182], textColor: 255, fontStyle: 'bold' },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 35 },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 25, halign: 'center' },
          4: { cellWidth: 25, halign: 'center' },
        },
      });

      yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
    };

    // Generate content based on type
    switch (type) {
      case 'attendance':
        addSummarySection();
        addAttendanceTable();
        break;
      case 'milestones':
        addSummarySection();
        addMilestonesTable();
        break;
      case 'performance':
        addSummarySection();
        addPerformanceTable();
        break;
      case 'all':
      default:
        addSummarySection();
        addMilestonesTable();
        addAttendanceTable();
        addPerformanceTable();
        break;
    }

    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    const filename = `${type}-report-${groupId}-${selectedYear || dayjs().year()}.pdf`;
    doc.save(filename);
    message.success('PDF exported successfully');
  };

  const downloadAsCSV = (type: string = 'all') => {
    let csvContent = '';
    let filename = '';

    switch (type) {
      case 'attendance':
        if (convertDetails.length === 0) {
          message.warning('No attendance data to download');
          return;
        }
        const attendanceHeaders = ['Name', 'Phone', 'Attendance Count', 'Attendance %', 'Goal', 'Status'];
        const attendanceRows = convertDetails.map((d) => [
          `"${d.full_name}"`,
          d.phone_number,
          d.attendanceCount,
          d.attendancePercentage,
          ATTENDANCE_GOAL,
          d.attendanceCount >= ATTENDANCE_GOAL ? 'Achieved' : 'In Progress',
        ]);
        csvContent = [
          attendanceHeaders.join(','),
          ...attendanceRows.map((row) => row.join(',')),
        ].join('\n');
        filename = `attendance-report-${groupId}-${selectedYear || dayjs().year()}.csv`;
        break;

      case 'milestones':
        if (milestoneSummaries.length === 0) {
          message.warning('No milestone data to download');
          return;
        }
        const milestoneHeaders = ['Stage #', 'Milestone Name', 'Completed', 'Total Converts', 'Completion %'];
        const milestoneRows = milestoneSummaries.map((m) => [
          m.stageNumber,
          `"${m.stageName}"`,
          m.completed,
          m.total,
          m.percentage,
        ]);
        csvContent = [
          milestoneHeaders.join(','),
          ...milestoneRows.map((row) => row.join(',')),
        ].join('\n');
        filename = `milestone-report-${groupId}-${selectedYear || dayjs().year()}.csv`;
        break;

      case 'performance':
        if (convertDetails.length === 0) {
          message.warning('No performance data to download');
          return;
        }
        const perfHeaders = ['Name', 'Phone', 'Attendance Count', 'Attendance %', 'Milestones Completed', 'Milestone %', 'Overall %'];
        const perfRows = convertDetails.map((d) => {
          const overall = Math.round((d.attendancePercentage + d.milestonePercentage) / 2);
          return [
            `"${d.full_name}"`,
            d.phone_number,
            d.attendanceCount,
            d.attendancePercentage,
            d.milestonesCompleted,
            d.milestonePercentage,
            overall,
          ];
        });
        csvContent = [
          perfHeaders.join(','),
          ...perfRows.map((row) => row.join(',')),
        ].join('\n');
        filename = `performance-report-${groupId}-${selectedYear || dayjs().year()}.csv`;
        break;

      case 'all':
      default:
        if (convertDetails.length === 0) {
          message.warning('No data to download');
          return;
        }
        
        // Summary Section
        let allContent = '=== SUMMARY ===\n';
        allContent += `Group:,${groupName}\n`;
        allContent += `Year:,${selectedYear || dayjs().year()}\n`;
        allContent += `Report Date:,${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n`;
        allContent += `Total Converts:,${attendanceSummary?.totalConverts || 0}\n`;
        allContent += `Converts with Attendance:,${attendanceSummary?.withAttendance || 0}\n`;
        allContent += `Attendance Percentage:,${attendanceSummary?.percentage || 0}%\n`;
        allContent += `Average Attendance:,${attendanceSummary?.avgAttendance || 0}\n`;
        allContent += `Attendance Goal:,${ATTENDANCE_GOAL}\n`;
        allContent += `Total Milestones:,${milestoneSummaries.length}\n\n`;

        // Milestone Summary
        allContent += '=== MILESTONE COMPLETION SUMMARY ===\n';
        allContent += 'Stage #,Milestone Name,Completed,Total Converts,Completion %\n';
        milestoneSummaries.forEach((m) => {
          allContent += `${m.stageNumber},"${m.stageName}",${m.completed},${m.total},${m.percentage}%\n`;
        });
        allContent += '\n';

        // Detailed Convert Performance
        allContent += '=== CONVERT PERFORMANCE DETAILS ===\n';
        allContent += 'Name,Phone,Attendance Count,Attendance %,Milestones Completed,Milestone %,Overall %\n';
        convertDetails.forEach((d) => {
          const overall = Math.round((d.attendancePercentage + d.milestonePercentage) / 2);
          allContent += `"${d.full_name}",${d.phone_number},${d.attendanceCount},${d.attendancePercentage}%,${d.milestonesCompleted},${d.milestonePercentage}%,${overall}%\n`;
        });

        csvContent = allContent;
        filename = `complete-report-${groupId}-${selectedYear || dayjs().year()}.csv`;
        break;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    message.success('Report downloaded successfully');
  };

  const sortedAttendance = [...convertDetails].sort(
    (a, b) => b.attendanceCount - a.attendanceCount
  )
  const sortedMilestones = [...milestoneSummaries].sort(
    (a, b) => a.stageNumber - b.stageNumber
  )
  const sortedPerformance = [...convertDetails].sort((a, b) => {
    const overallA = (a.attendancePercentage + a.milestonePercentage) / 2
    const overallB = (b.attendancePercentage + b.milestonePercentage) / 2
    return overallB - overallA
  })

  if (authLoading || loading) {
    return <LoadingScreen label="Loading reports…" />
  }

  return (
    <TooltipProvider>
      <AppBreadcrumb />
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BarChart3 className="size-7" />
            Reports
          </h1>
          <GroupNavActions groupId={groupId} user={user} active="reports" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Comprehensive analytics and reporting for convert tracking and
            milestone progress
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {availableYears.length > 1 && (
              <Select
                value={selectedYear != null ? String(selectedYear) : undefined}
                onValueChange={(v) => setSelectedYear(Number(v))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
                <DropdownMenuItem onClick={() => downloadAsPDF('attendance')}>
                  Attendance Report (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadAsCSV('milestones')}>
                  <BarChart3 className="mr-2 size-4" />
                  Milestone Report
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadAsPDF('milestones')}>
                  Milestone Report (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadAsCSV('performance')}>
                  <LineChart className="mr-2 size-4" />
                  Performance Report
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadAsPDF('performance')}>
                  Performance Report (PDF)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Converts"
          value={attendanceSummary?.totalConverts || 0}
          icon={Users}
          accent="members"
        />
        <StatCard
          title="With Attendance"
          value={`${attendanceSummary?.percentage || 0}%`}
          icon={CheckCircle}
          accent="arrivals"
        />
        <StatCard
          title="Avg Attendance"
          value={attendanceSummary?.avgAttendance || 0}
          subtitle={`/${ATTENDANCE_GOAL}`}
          icon={LineChart}
          accent="campaigns"
        />
        <StatCard
          title="Milestones"
          value={milestoneSummaries.length}
          icon={Filter}
          accent="primary"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs value={reportType} onValueChange={setReportType}>
            <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="attendance">Attendance Details</TabsTrigger>
              <TabsTrigger value="milestones">Milestone Progress</TabsTrigger>
              <TabsTrigger value="converts">Convert Performance</TabsTrigger>
              <TabsTrigger value="predictive">Predictive Analytics</TabsTrigger>
              <TabsTrigger value="cohorts">Cohort Analysis</TabsTrigger>
              <TabsTrigger value="forecast">Growth Forecasting</TabsTrigger>
              <TabsTrigger value="bulk-actions">Bulk Actions</TabsTrigger>
              <TabsTrigger value="report-templates">Report Templates</TabsTrigger>
              <TabsTrigger value="badges">Achievement Badges</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Attendance Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p>
                      <strong>{attendanceSummary?.withAttendance}</strong> of{' '}
                      <strong>{attendanceSummary?.totalConverts}</strong> converts
                      have attended at least one service.
                    </p>
                    <p>
                      Average attendance:{' '}
                      <strong>{attendanceSummary?.avgAttendance}</strong> out of{' '}
                      <strong>{ATTENDANCE_GOAL}</strong> Sundays.
                    </p>
                    <Progress value={attendanceSummary?.percentage || 0} />
                    <p className="text-xs text-muted-foreground">
                      {attendanceSummary?.percentage || 0}% with attendance
                    </p>
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
                    {milestoneSummaries.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        + {milestoneSummaries.length - 5} more milestones
                      </p>
                    )}
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
                        <TableCell className="font-semibold">
                          {record.full_name}
                        </TableCell>
                        <TableCell>{record.phone_number}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              record.attendanceCount >= ATTENDANCE_GOAL
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {record.attendanceCount}/{ATTENDANCE_GOAL}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Progress
                            value={record.attendancePercentage}
                            className="h-2 max-w-[150px]"
                          />
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
                    {sortedMilestones.map((record) => (
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
                            <span className="text-xs tabular-nums">
                              {record.percentage}%
                            </span>
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
                      const overall = Math.round(
                        (record.attendancePercentage +
                          record.milestonePercentage) /
                          2
                      )
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-semibold">
                            {record.full_name}
                          </TableCell>
                          <TableCell>{record.phone_number}</TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex size-12 items-center justify-center rounded-full border-2 border-primary text-xs font-bold">
                                  {record.attendancePercentage}%
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {record.attendanceCount}/{ATTENDANCE_GOAL}{' '}
                                Sundays
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
                                {record.milestonesCompleted}/
                                {record.totalMilestones} milestones
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                overall >= 75
                                  ? 'default'
                                  : overall >= 50
                                    ? 'secondary'
                                    : 'outline'
                              }
                            >
                              {overall}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="predictive">
              <PredictiveAnalyticsDashboard
                groupId={groupId}
                userId={user?.id || 'system'}
                token={token || undefined}
              />
            </TabsContent>

            <TabsContent value="cohorts">
              <CohortAnalysisDashboard
                groupId={groupId}
                userId={user?.id || 'system'}
                token={token || undefined}
              />
            </TabsContent>

            <TabsContent value="forecast">
              <GrowthForecastDashboard
                groupId={groupId}
                userId={user?.id || 'system'}
                token={token || undefined}
              />
            </TabsContent>

            <TabsContent value="bulk-actions">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Perform Actions on Multiple Records
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Update status, assign milestones, or delete multiple converts
                    at once.
                  </p>
                </CardHeader>
                <CardContent>
                  <BulkActionsUI
                    groupId={groupId}
                    userId={user?.id || 'system'}
                    token={token || undefined}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="report-templates">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Create and Manage Report Templates
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Build reusable report templates with custom sections and
                    metrics.
                  </p>
                </CardHeader>
                <CardContent>
                  <WidgetErrorBoundary>
                    <ReportTemplateBuilder
                      groupId={groupId}
                      userId={user?.id || 'system'}
                      token={token || undefined}
                    />
                  </WidgetErrorBoundary>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="badges">
              <AchievementBadgesDashboard
                groupId={groupId}
                userId={user?.id || 'system'}
                token={token || undefined}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}

