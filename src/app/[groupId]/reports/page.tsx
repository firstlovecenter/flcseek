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
} from 'antd';
import {
  BarChartOutlined,
  LineChartOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  FileExcelOutlined,
  FilterOutlined,
  HomeOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import AppBreadcrumb from '@/components/AppBreadcrumb';
import { api } from '@/lib/api';
import { useThemeStyles } from '@/lib/theme-utils';
import { ATTENDANCE_GOAL } from '@/lib/constants';
import dayjs from 'dayjs';

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
  const [people, setPeople] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [milestoneSummaries, setMilestoneSummaries] = useState<MilestoneSummary[]>([]);
  const [convertDetails, setConvertDetails] = useState<ConvertDetail[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // Check auth
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
      return;
    }

    if (user && user.role !== 'superadmin' && user.role !== 'leadpastor' && user.role !== 'overseer' && user.role !== 'admin' && user.group_id !== groupId) {
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
        const groups = response.data.groups || [];
        const selectedGroup = groups.find((g: any) => g.id === groupId);
        if (!selectedGroup) {
          throw new Error('Group not found');
        }

        const monthName = selectedGroup.name;
        const matchingGroups = groups.filter((g: any) => g.name.toLowerCase() === monthName.toLowerCase());
        const years = Array.from(new Set(matchingGroups.map((g: any) => g.year))) as number[];
        years.sort((a, b) => b - a);

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

      const peopleData = peopleResponse.data?.people || [];
      const totalMilestones = peopleResponse.data?.totalMilestones || 18;

      // Fetch milestones
      const milestonesResponse = await api.milestones.list();
      if (milestonesResponse.success) {
        setMilestones(milestonesResponse.data?.milestones || []);
      }

      // Fetch attendance records
      const attendanceResponse = await api.attendance.list({
        group_id: groupId,
      });

      // Process data
      processPeopleData(peopleData, attendanceResponse.data?.attendance || [], totalMilestones, milestonesResponse.data?.milestones || []);
      setPeople(peopleData);
    } catch (error: any) {
      console.error('Failed to fetch report data:', error);
      message.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const processPeopleData = (peopleData: any[], attendanceRecords: any[], totalMilestones: number, milestonesData: any[]) => {
    // Attendance Summary
    const withAttendance = peopleData.filter((p: any) => (p.attendance_count || 0) > 0).length;
    const totalAttendance = peopleData.reduce((sum, p: any) => sum + (p.attendance_count || 0), 0);
    const avgAttendance = peopleData.length > 0 ? totalAttendance / peopleData.length : 0;

    setAttendanceSummary({
      totalConverts: peopleData.length,
      withAttendance,
      percentage: peopleData.length > 0 ? Math.round((withAttendance / peopleData.length) * 100) : 0,
      avgAttendance: Math.round(avgAttendance * 10) / 10,
    });

    // Milestone Summaries
    const milestoneSums: Record<number, { completed: number; total: number }> = {};
    
    milestonesData.forEach((m: any) => {
      milestoneSums[m.stage_number] = { completed: 0, total: peopleData.length };
    });

    peopleData.forEach((person: any) => {
      (person.progress || []).forEach((p: any) => {
        if (p.is_completed && milestoneSums[p.stage_number]) {
          milestoneSums[p.stage_number].completed++;
        }
      });
    });

    const summaries = milestonesData.map((m: any) => ({
      stageNumber: m.stage_number,
      stageName: m.stage_name,
      completed: milestoneSums[m.stage_number]?.completed || 0,
      total: milestoneSums[m.stage_number]?.total || peopleData.length,
      percentage: peopleData.length > 0 ? Math.round(((milestoneSums[m.stage_number]?.completed || 0) / peopleData.length) * 100) : 0,
    }));

    setMilestoneSummaries(summaries);

    // Convert Details
    const details = peopleData.map((person: any) => ({
      id: person.id,
      full_name: person.full_name,
      phone_number: person.phone_number,
      attendanceCount: person.attendance_count || 0,
      attendancePercentage: Math.min(Math.round(((person.attendance_count || 0) / ATTENDANCE_GOAL) * 100), 100),
      milestonesCompleted: (person.progress || []).filter((p: any) => p.is_completed).length,
      totalMilestones,
      milestonePercentage: Math.round(((person.progress?.filter((p: any) => p.is_completed).length || 0) / totalMilestones) * 100),
    }));

    setConvertDetails(details);
  };

  const downloadAsCSV = () => {
    if (convertDetails.length === 0) {
      message.warning('No data to download');
      return;
    }

    const headers = ['Name', 'Phone', 'Attendance', 'Attendance %', 'Milestones Completed', 'Milestone %'];
    const rows = convertDetails.map((d) => [
      d.full_name,
      d.phone_number,
      d.attendanceCount,
      d.attendancePercentage,
      d.milestonesCompleted,
      d.milestonePercentage,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${groupId}-${selectedYear}.csv`;
    a.click();
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
      render: (_: any, record: ConvertDetail) => (
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
      render: (_: any, record: MilestoneSummary) => (
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
      render: (_: any, record: ConvertDetail) => (
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
      render: (_: any, record: ConvertDetail) => (
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
      render: (_: any, record: ConvertDetail) => {
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

  return (
    <>
      <AppBreadcrumb />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={2} style={{ margin: 0 }}>
            <BarChartOutlined /> Reports
          </Title>
          <Space>
            {availableYears.length > 1 && (
              <Select
                value={selectedYear}
                onChange={setSelectedYear}
                style={{ width: 120 }}
                options={availableYears.map((y) => ({ label: y.toString(), value: y }))}
              />
            )}
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={downloadAsCSV}
            >
              Download CSV
            </Button>
          </Space>
        </div>
        <Text type="secondary">
          Comprehensive analytics and reporting for convert tracking and milestone progress
        </Text>
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
                <Table
                  columns={attendanceColumns}
                  dataSource={convertDetails.sort((a, b) => b.attendanceCount - a.attendanceCount)}
                  rowKey="id"
                  pagination={{ pageSize: 20 }}
                  style={{ marginTop: 16 }}
                />
              ),
            },
            {
              key: 'milestones',
              label: 'Milestone Progress',
              children: (
                <Table
                  columns={milestoneCols}
                  dataSource={milestoneSummaries.sort((a, b) => a.stageNumber - b.stageNumber)}
                  rowKey="stageNumber"
                  pagination={false}
                  style={{ marginTop: 16 }}
                />
              ),
            },
            {
              key: 'converts',
              label: 'Convert Performance',
              children: (
                <Table
                  columns={convertCols}
                  dataSource={convertDetails.sort((a, b) => {
                    const overallA = (a.attendancePercentage + a.milestonePercentage) / 2;
                    const overallB = (b.attendancePercentage + b.milestonePercentage) / 2;
                    return overallB - overallA;
                  })}
                  rowKey="id"
                  pagination={{ pageSize: 20 }}
                  style={{ marginTop: 16 }}
                />
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
