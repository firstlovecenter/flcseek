'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Tabs,
  Typography,
  Spin,
  message,
  Statistic,
  Row,
  Col,
  Table,
  Progress,
  Tag,
  Space,
  Button,
  Select,
  DatePicker,
  Tooltip,
  Dropdown,
  Menu,
} from 'antd';
import {
  BarChartOutlined,
  LineChartOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  FileExcelOutlined,
  FilterOutlined,
  DownloadOutlined,
  FileTextOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
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
import { useThemeStyles } from '@/lib/theme-utils';
import { ATTENDANCE_GOAL } from '@/lib/constants';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { MilestoneData, PersonApiData, GroupApiData, AttendanceRecord } from '@/lib/types/api-responses';

const { Title, Text } = Typography;

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
  const themeStyles = useThemeStyles();

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

  const downloadAsPDF = (type: string = 'all') => {
    if (!attendanceSummary) {
      message.warning('No data to export');
      return;
    }

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

  const attendanceColumns = [
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Phone',
      dataIndex: 'phone_number',
      key: 'phone_number',
    },
    {
      title: 'Attendance',
      dataIndex: 'attendanceCount',
      key: 'attendanceCount',
      render: (count: number) => (
        <Tag color={count >= ATTENDANCE_GOAL ? 'success' : 'warning'}>{count}/{ATTENDANCE_GOAL}</Tag>
      ),
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_: unknown, record: ConvertDetail) => (
        <div style={{ width: 150 }}>
          <Progress
            percent={record.attendancePercentage}
            strokeColor={record.attendancePercentage >= 100 ? '#52c41a' : '#ff7a45'}
            size="small"
          />
        </div>
      ),
    },
  ];

  const milestoneCols = [
    {
      title: 'Milestone',
      dataIndex: 'stageName',
      key: 'stageName',
      render: (text: string, record: MilestoneSummary) => (
        <div>
          <strong>{record.stageNumber}</strong>. {text}
        </div>
      ),
    },
    {
      title: 'Completed',
      dataIndex: 'completed',
      key: 'completed',
      render: (completed: number, record: MilestoneSummary) => (
        <strong>{completed}/{record.total}</strong>
      ),
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_: unknown, record: MilestoneSummary) => (
        <div style={{ width: 200 }}>
          <Progress
            percent={record.percentage}
            strokeColor={record.percentage >= 75 ? '#52c41a' : record.percentage >= 50 ? '#faad14' : '#ff7a45'}
            size="small"
            format={() => `${record.percentage}%`}
          />
        </div>
      ),
    },
  ];

  const convertCols = [
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Phone',
      dataIndex: 'phone_number',
      key: 'phone_number',
    },
    {
      title: 'Attendance',
      key: 'attendance',
      render: (_: unknown, record: ConvertDetail) => (
        <Tooltip title={`${record.attendanceCount}/${ATTENDANCE_GOAL} Sundays`}>
          <Progress
            type="circle"
            percent={record.attendancePercentage}
            width={50}
            strokeColor={record.attendancePercentage >= 100 ? '#52c41a' : '#ff7a45'}
          />
        </Tooltip>
      ),
    },
    {
      title: 'Milestones',
      key: 'milestones',
      render: (_: unknown, record: ConvertDetail) => (
        <Tooltip title={`${record.milestonesCompleted}/${record.totalMilestones} milestones`}>
          <Progress
            type="circle"
            percent={record.milestonePercentage}
            width={50}
            strokeColor={record.milestonePercentage >= 75 ? '#52c41a' : '#faad14'}
          />
        </Tooltip>
      ),
    },
    {
      title: 'Overall Progress',
      key: 'overall',
      render: (_: unknown, record: ConvertDetail) => {
        const overall = Math.round((record.attendancePercentage + record.milestonePercentage) / 2);
        return (
          <Tag
            color={overall >= 75 ? 'success' : overall >= 50 ? 'processing' : 'warning'}
          >
            {overall}%
          </Tag>
        );
      },
    },
  ];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  const exportMenu = (
    <Menu
      items={[
        {
          key: 'all',
          label: 'Complete Report (All Data)',
          icon: <FileTextOutlined />,
          onClick: () => downloadAsCSV('all'),
        },
        {
          key: 'all-pdf',
          label: 'Complete Report (PDF)',
          icon: <FilePdfOutlined />,
          onClick: () => downloadAsPDF('all'),
        },
        {
          key: 'attendance',
          label: 'Attendance Report',
          icon: <CheckCircleOutlined />,
          onClick: () => downloadAsCSV('attendance'),
        },
        {
          key: 'attendance-pdf',
          label: 'Attendance Report (PDF)',
          icon: <FilePdfOutlined />,
          onClick: () => downloadAsPDF('attendance'),
        },
        {
          key: 'milestones',
          label: 'Milestone Report',
          icon: <BarChartOutlined />,
          onClick: () => downloadAsCSV('milestones'),
        },
        {
          key: 'milestones-pdf',
          label: 'Milestone Report (PDF)',
          icon: <FilePdfOutlined />,
          onClick: () => downloadAsPDF('milestones'),
        },
        {
          key: 'performance',
          label: 'Performance Report',
          icon: <LineChartOutlined />,
          onClick: () => downloadAsCSV('performance'),
        },
        {
          key: 'performance-pdf',
          label: 'Performance Report (PDF)',
          icon: <FilePdfOutlined />,
          onClick: () => downloadAsPDF('performance'),
        },
      ]}
    />
  );

  return (
    <>
      <AppBreadcrumb />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <Title level={2} style={{ margin: 0 }}>
            <BarChartOutlined /> Reports
          </Title>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
            <Button icon={<BarChartOutlined />} onClick={() => router.push(`/${groupId}/progress`)}>
              Milestones
            </Button>

            <Button icon={<TeamOutlined />} onClick={() => router.push(`/${groupId}/attendance`)}>
              Attendance
            </Button>

            <Button type="primary" icon={<FileExcelOutlined />} onClick={() => router.push(`/${groupId}/reports`)}>
              Reports
            </Button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Text type="secondary">
            Comprehensive analytics and reporting for convert tracking and milestone progress
          </Text>

          <Space>
            {availableYears.length > 1 && (
              <Select
                value={selectedYear}
                onChange={setSelectedYear}
                style={{ width: 120 }}
                options={availableYears.map((y) => ({ label: y.toString(), value: y }))}
              />
            )}
            <Dropdown overlay={exportMenu} placement="bottomRight">
              <Button type="primary" icon={<DownloadOutlined />}>
                Export Report
              </Button>
            </Dropdown>
          </Space>
        </div>
      </div>

      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: themeStyles.containerBg, borderRadius: 8 }}>
            <Statistic
              title="Total Converts"
              value={attendanceSummary?.totalConverts || 0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: themeStyles.containerBg, borderRadius: 8 }}>
            <Statistic
              title="With Attendance"
              value={attendanceSummary?.percentage || 0}
              suffix="%"
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: themeStyles.containerBg, borderRadius: 8 }}>
            <Statistic
              title="Avg Attendance"
              value={attendanceSummary?.avgAttendance || 0}
              suffix={`/${ATTENDANCE_GOAL}`}
              prefix={<LineChartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: themeStyles.containerBg, borderRadius: 8 }}>
            <Statistic
              title="Milestones"
              value={milestoneSummaries.length}
              prefix={<FilterOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Reports Tabs */}
      <Card style={{ background: themeStyles.containerBg, borderRadius: 8 }}>
        <Tabs
          activeKey={reportType}
          onChange={setReportType}
          items={[
            {
              key: 'summary',
              label: 'Summary',
              children: (
                <div style={{ marginTop: 16 }}>
                  <Row gutter={16}>
                    <Col xs={24} lg={12}>
                      <Card title="Attendance Overview" size="small">
                        <p>
                          <strong>{attendanceSummary?.withAttendance}</strong> of{' '}
                          <strong>{attendanceSummary?.totalConverts}</strong> converts have
                          attended at least one service.
                        </p>
                        <p>
                          Average attendance: <strong>{attendanceSummary?.avgAttendance}</strong> out of{' '}
                          <strong>{ATTENDANCE_GOAL}</strong> Sundays.
                        </p>
                        <Progress
                          percent={attendanceSummary?.percentage || 0}
                          status="active"
                          format={() => `${attendanceSummary?.percentage || 0}% with attendance`}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Card title="Milestone Completion" size="small">
                        {milestoneSummaries.slice(0, 5).map((m) => (
                          <div key={m.stageNumber} style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span>
                                <strong>{m.stageNumber}.</strong> {m.stageName}
                              </span>
                              <span>{m.completed}/{m.total}</span>
                            </div>
                            <Progress
                              percent={m.percentage}
                              size="small"
                              format={() => `${m.percentage}%`}
                            />
                          </div>
                        ))}
                        {milestoneSummaries.length > 5 && (
                          <Text type="secondary">+ {milestoneSummaries.length - 5} more milestones</Text>
                        )}
                      </Card>
                    </Col>
                  </Row>
                </div>
              ),
            },
            {
              key: 'attendance',
              label: 'Attendance Details',
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                    <Button
                      icon={<DownloadOutlined />}
                      onClick={() => downloadAsCSV('attendance')}
                    >
                      Export Attendance
                    </Button>
                  </div>
                  <Table
                    columns={attendanceColumns}
                    dataSource={convertDetails.sort((a, b) => b.attendanceCount - a.attendanceCount)}
                    rowKey="id"
                    pagination={{ pageSize: 20 }}
                  />
                </div>
              ),
            },
            {
              key: 'milestones',
              label: 'Milestone Progress',
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                    <Button
                      icon={<DownloadOutlined />}
                      onClick={() => downloadAsCSV('milestones')}
                    >
                      Export Milestones
                    </Button>
                  </div>
                  <Table
                    columns={milestoneCols}
                    dataSource={milestoneSummaries.sort((a, b) => a.stageNumber - b.stageNumber)}
                    rowKey="stageNumber"
                    pagination={false}
                  />
                </div>
              ),
            },
            {
              key: 'converts',
              label: 'Convert Performance',
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                    <Button
                      icon={<DownloadOutlined />}
                      onClick={() => downloadAsCSV('performance')}
                    >
                      Export Performance
                    </Button>
                  </div>
                  <Table
                    columns={convertCols}
                    dataSource={convertDetails.sort((a, b) => {
                      const overallA = (a.attendancePercentage + a.milestonePercentage) / 2;
                      const overallB = (b.attendancePercentage + b.milestonePercentage) / 2;
                      return overallB - overallA;
                    })}
                    rowKey="id"
                    pagination={{ pageSize: 20 }}
                  />
                </div>
              ),
            },
            {
              key: 'predictive',
              label: 'Predictive Analytics',
              children: (
                <div style={{ marginTop: 16 }}>
                  <PredictiveAnalyticsDashboard groupId={groupId} userId={user?.id || 'system'} token={token || undefined} />
                </div>
              ),
            },
            {
              key: 'cohorts',
              label: 'Cohort Analysis',
              children: (
                <div style={{ marginTop: 16 }}>
                  <CohortAnalysisDashboard groupId={groupId} userId={user?.id || 'system'} token={token || undefined} />
                </div>
              ),
            },
            {
              key: 'forecast',
              label: 'Growth Forecasting',
              children: (
                <div style={{ marginTop: 16 }}>
                  <GrowthForecastDashboard groupId={groupId} userId={user?.id || 'system'} token={token || undefined} />
                </div>
              ),
            },
            {
              key: 'bulk-actions',
              label: 'Bulk Actions',
              children: (
                <div style={{ marginTop: 16 }}>
                  <Card>
                    <div style={{ marginBottom: 16 }}>
                      <Title level={4}>Perform Actions on Multiple Records</Title>
                      <Text type="secondary">
                        Update status, assign milestones, or delete multiple converts at once.
                      </Text>
                    </div>
                    <BulkActionsUI
                      groupId={groupId}
                      userId={user?.id || 'system'}
                      token={token || undefined}
                    />
                  </Card>
                </div>
              ),
            },
            {
              key: 'report-templates',
              label: 'Report Templates',
              children: (
                <div style={{ marginTop: 16 }}>
                  <Card>
                    <div style={{ marginBottom: 16 }}>
                      <Title level={4}>Create and Manage Report Templates</Title>
                      <Text type="secondary">
                        Build reusable report templates with custom sections and metrics.
                      </Text>
                    </div>
                    <WidgetErrorBoundary>
                      <ReportTemplateBuilder
                        groupId={groupId}
                        userId={user?.id || 'system'}
                        token={token || undefined}
                      />
                    </WidgetErrorBoundary>
                  </Card>
                </div>
              ),
            },
            {
              key: 'badges',
              label: 'Achievement Badges',
              children: (
                <div style={{ marginTop: 16 }}>
                  <AchievementBadgesDashboard
                    groupId={groupId}
                    userId={user?.id || 'system'}
                    token={token || undefined}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
