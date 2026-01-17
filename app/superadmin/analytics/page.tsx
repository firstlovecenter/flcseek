'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, Row, Col, Statistic, Typography, Select, Spin, Empty, Table, Tag, Progress } from 'antd';
import {
  LineChartOutlined,
  TeamOutlined,
  RiseOutlined,
  HeartOutlined,
  CalendarOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import dynamic from 'next/dynamic';
import DashboardCharts from '@/components/DashboardCharts';
import { api } from '@/lib/api';

// Dynamically import chart components to avoid SSR issues
// Using 'any' type to avoid TypeScript infinite type instantiation issue
const Column = dynamic(() => import('@ant-design/charts').then(mod => mod.Column) as any, { ssr: false }) as any;
const Pie = dynamic(() => import('@ant-design/charts').then(mod => mod.Pie) as any, { ssr: false }) as any;
const Line = dynamic(() => import('@ant-design/charts').then(mod => mod.Line) as any, { ssr: false }) as any;

const { Title, Text } = Typography;
const { Option } = Select;

interface AnalyticsData {
  totalConverts: number;
  convertsByMonth: { month: string; count: number }[];
  convertsByGroup: { group: string; count: number }[];
  milestoneCompletion: { milestone: string; completed: number; total: number; percentage: number }[];
  attendanceByWeek: { week: string; count: number }[];
  topPerformers: { name: string; completed: number; total: number }[];
  genderDistribution: { gender: string; count: number }[];
  completionRate: number;
}

export default function AnalyticsPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);

  useEffect(() => {
    if (token) {
      fetchAnalyticsData();
    }
  }, [token, year]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      // Step 1: Fetch groups for the selected year using new API
      const groupsRes = await api.groups.list({ year });
      const yearGroups = groupsRes.success ? (groupsRes.data || []) : [];
      setGroups(yearGroups);

      // Step 2: If we have groups, fetch their converts with year filtering
      // Build year filter to get only converts from this year
      
      // Fetch remaining data in parallel
      const [peopleRes, milestonesRes, statsRes] = await Promise.all([
        api.people.list({ year, include: 'progress' }),
        api.milestones.list(),
        fetch(`/api/superadmin/converts/stats?year=${year}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
      ]);

      const statsData = await statsRes.json();

      // Use people data directly - already filtered by year on backend
      const filteredPeople = peopleRes.success ? (peopleRes.data || []) : [];
      const milestonesData = milestonesRes.success ? (milestonesRes.data || []) : [];

      setPeople(filteredPeople);
      setMilestones(milestonesData.filter((m: any) => m.is_active) || []);

      // Process analytics with filtered data
      processAnalytics(
        filteredPeople,
        milestonesData,
        yearGroups,
        statsData.stats || {}
      );
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const processAnalytics = (people: any[], milestones: any[], groups: any[], stats: any) => {
    const activeMilestones = milestones.filter((m: any) => m.is_active);
    const totalMilestones = activeMilestones.length;

    // Converts by month
    const monthCounts: Record<string, number> = {};
    people.forEach((p) => {
      const month = new Date(p.created_at).toLocaleString('default', { month: 'short', year: '2-digit' });
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    const convertsByMonth = Object.entries(monthCounts).map(([month, count]) => ({ month, count }));

    // Converts by group
    const groupCounts: Record<string, number> = {};
    people.forEach((p) => {
      const group = p.group_name || 'Unknown';
      groupCounts[group] = (groupCounts[group] || 0) + 1;
    });
    const convertsByGroup = Object.entries(groupCounts)
      .map(([group, count]) => ({ group, count }))
      .sort((a, b) => b.count - a.count);

    // Milestone completion
    const milestoneCompletion = activeMilestones.map((m: any) => {
      const completed = people.filter((p) =>
        p.progress?.some((pr: any) => pr.stage_number === m.stage_number && pr.is_completed)
      ).length;
      return {
        milestone: `M${m.stage_number.toString().padStart(2, '0')}`,
        fullName: m.stage_name,
        completed,
        total: people.length,
        percentage: people.length > 0 ? Math.round((completed / people.length) * 100) : 0,
      };
    });

    // Gender distribution
    const genderCounts: Record<string, number> = {};
    people.forEach((p) => {
      const gender = p.gender || 'Not specified';
      genderCounts[gender] = (genderCounts[gender] || 0) + 1;
    });
    const genderDistribution = Object.entries(genderCounts).map(([gender, count]) => ({ gender, count }));

    // Top performers (most milestones completed)
    const topPerformers = people
      .map((p) => ({
        name: `${p.first_name} ${p.last_name}`,
        completed: p.progress?.filter((pr: any) => pr.is_completed).length || 0,
        total: totalMilestones,
      }))
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 10);

    // Overall completion rate
    const totalCompleted = people.reduce(
      (sum, p) => sum + (p.progress?.filter((pr: any) => pr.is_completed).length || 0),
      0
    );
    const totalPossible = people.length * totalMilestones;
    const completionRate = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

    setData({
      totalConverts: people.length,
      convertsByMonth,
      convertsByGroup,
      milestoneCompletion,
      attendanceByWeek: [], // Would need attendance data
      topPerformers,
      genderDistribution,
      completionRate,
    });
  };

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data) {
    return <Empty description="No analytics data available" />;
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3}>
            <LineChartOutlined style={{ marginRight: 8 }} />
            Analytics Dashboard
          </Title>
          <Text type="secondary">Comprehensive overview of convert progress and engagement</Text>
        </div>
        <Select value={year} onChange={setYear} style={{ width: 120 }}>
          {years.map((y) => (
            <Option key={y} value={y}>
              {y}
            </Option>
          ))}
        </Select>
      </div>

      {/* Key Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Total Converts"
              value={data.totalConverts}
              prefix={<HeartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Overall Completion"
              value={data.completionRate}
              suffix="%"
              prefix={<TrophyOutlined />}
              valueStyle={{ color: data.completionRate >= 50 ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Active Groups"
              value={groups.filter((g: any) => g.year === year).length}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Milestones"
              value={milestones.length}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Milestone Progress Overview */}
      <DashboardCharts 
        people={people} 
        milestones={milestones}
        compact={false}
      />

      {/* Charts Row 1 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card title="Milestone Completion Rates" size="small">
            {data.milestoneCompletion.length > 0 ? (
              <Column
                data={data.milestoneCompletion}
                xField="milestone"
                yField="percentage"
                color={(datum: any) =>
                  datum.percentage >= 70 ? '#52c41a' : datum.percentage >= 40 ? '#faad14' : '#ff4d4f'
                }
                label={{
                  position: 'top' as any,
                  formatter: (datum: any) => `${datum.percentage}%`,
                }}
                height={300}
                tooltip={{
                  formatter: (datum: any) => ({
                    name: datum.fullName || datum.milestone,
                    value: `${datum.completed}/${datum.total} (${datum.percentage}%)`,
                  }),
                }}
              />
            ) : (
              <Empty description="No milestone data" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Gender Distribution" size="small">
            {data.genderDistribution.length > 0 ? (
              <Pie
                data={data.genderDistribution}
                angleField="count"
                colorField="gender"
                radius={0.8}
                innerRadius={0.6}
                height={300}
                label={{
                  type: 'outer',
                  content: '{name}: {percentage}',
                }}
                interactions={[{ type: 'element-active' }]}
              />
            ) : (
              <Empty description="No gender data" />
            )}
          </Card>
        </Col>
      </Row>

      {/* Charts Row 2 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Converts by Group" size="small">
            {data.convertsByGroup.length > 0 ? (
              <Column
                data={data.convertsByGroup.slice(0, 10)}
                xField="group"
                yField="count"
                color="#1890ff"
                height={250}
                xAxis={{
                  label: {
                    autoRotate: true,
                    autoHide: true,
                  },
                }}
              />
            ) : (
              <Empty description="No group data" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Registrations Over Time" size="small">
            {data.convertsByMonth.length > 0 ? (
              <Line
                data={data.convertsByMonth}
                xField="month"
                yField="count"
                smooth={true}
                height={250}
                point={{
                  size: 4,
                  shape: 'circle',
                }}
                color="#52c41a"
              />
            ) : (
              <Empty description="No registration data" />
            )}
          </Card>
        </Col>
      </Row>

      {/* Top Performers Table */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Top Performers" size="small">
            <Table
              dataSource={data.topPerformers}
              rowKey="name"
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Rank',
                  key: 'rank',
                  width: 60,
                  render: (_: any, __: any, index: number) => (
                    <Tag color={index < 3 ? 'gold' : 'default'}>{index + 1}</Tag>
                  ),
                },
                {
                  title: 'Name',
                  dataIndex: 'name',
                  key: 'name',
                },
                {
                  title: 'Progress',
                  key: 'progress',
                  render: (_: any, record: any) => (
                    <Progress
                      percent={Math.round((record.completed / record.total) * 100)}
                      size="small"
                      format={() => `${record.completed}/${record.total}`}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Milestones Needing Attention" size="small">
            <Table
              dataSource={[...data.milestoneCompletion].sort((a, b) => a.percentage - b.percentage).slice(0, 5)}
              rowKey="milestone"
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Milestone',
                  dataIndex: 'milestone',
                  key: 'milestone',
                },
                {
                  title: 'Name',
                  dataIndex: 'fullName',
                  key: 'fullName',
                  ellipsis: true,
                },
                {
                  title: 'Completion',
                  key: 'completion',
                  render: (_: any, record: any) => (
                    <Progress
                      percent={record.percentage}
                      size="small"
                      status={record.percentage < 30 ? 'exception' : record.percentage < 60 ? 'active' : 'success'}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
