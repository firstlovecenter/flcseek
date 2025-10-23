'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Table, Tag } from 'antd';
import { BarChartOutlined, UserOutlined, TeamOutlined, HeartOutlined, TrophyOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';

const { Title } = Typography;

interface AnalyticsData {
  userStats: {
    total: number;
    superAdmins: number;
    sheepSeekers: number;
    growthRate: number;
  };
  groupStats: {
    total: number;
    withLeaders: number;
    avgMembersPerGroup: number;
  };
  convertStats: {
    total: number;
    thisMonth: number;
    avgProgressCompletion: number;
  };
  topGroups: Array<{
    name: string;
    members: number;
    avgProgress: number;
  }>;
  topSeekers: Array<{
    name: string;
    converts: number;
  }>;
}

export default function AnalyticsPage() {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchAnalytics();
    }
  }, [token]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/superadmin/analytics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !analytics) {
    return <div>Loading analytics...</div>;
  }

  const groupColumns = [
    {
      title: 'Group Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Members',
      dataIndex: 'members',
      key: 'members',
      render: (count: number) => <Tag color="blue">{count}</Tag>,
    },
    {
      title: 'Avg Progress',
      dataIndex: 'avgProgress',
      key: 'avgProgress',
      render: (progress: number) => `${progress.toFixed(1)}%`,
    },
  ];

  const seekerColumns = [
    {
      title: 'Seeker Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Converts',
      dataIndex: 'converts',
      key: 'converts',
      render: (count: number) => <Tag color="green">{count}</Tag>,
    },
  ];

  return (
    <div>
      <Title level={2}>
        <BarChartOutlined /> Analytics & Reports
      </Title>

      <Title level={4}>User Analytics</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Users"
              value={analytics.userStats.total}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Super Admins"
              value={analytics.userStats.superAdmins}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Sheep Seekers"
              value={analytics.userStats.sheepSeekers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      <Title level={4}>Group Analytics</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Groups"
              value={analytics.groupStats.total}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Groups with Leaders"
              value={analytics.groupStats.withLeaders}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Avg Members per Group"
              value={analytics.groupStats.avgMembersPerGroup}
              prefix={<TeamOutlined />}
              precision={1}
            />
          </Card>
        </Col>
      </Row>

      <Title level={4}>Convert Analytics</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Converts"
              value={analytics.convertStats.total}
              prefix={<HeartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="This Month"
              value={analytics.convertStats.thisMonth}
              prefix={<HeartOutlined />}
              valueStyle={{ color: '#3f8600' }}
              suffix={<RiseOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Avg Progress Completion"
              value={analytics.convertStats.avgProgressCompletion}
              prefix={<TrophyOutlined />}
              suffix="%"
              precision={1}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Top Performing Groups">
            <Table
              dataSource={analytics.topGroups}
              columns={groupColumns}
              rowKey="name"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Top Performing Sheep Seekers">
            <Table
              dataSource={analytics.topSeekers}
              columns={seekerColumns}
              rowKey="name"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
