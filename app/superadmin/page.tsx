'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Spin, Table, Tag } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  TrophyOutlined,
  HeartOutlined,
  RiseOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

const { Title, Text } = Typography;

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalGroups: number;
  totalConverts: number;
  convertsThisMonth: number;
  activeGroupLeaders: number;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  user: string;
}

export default function SuperAdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalGroups: 0,
    totalConverts: 0,
    convertsThisMonth: 0,
    activeGroupLeaders: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/superadmin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setStats(data.stats || stats);
      setRecentActivity(data.recentActivity || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const activityColumns = [
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const colors: Record<string, string> = {
          USER: 'blue',
          GROUP: 'green',
          CONVERT: 'purple',
          MILESTONE: 'orange',
        };
        return <Tag color={colors[type] || 'default'}>{type}</Tag>;
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'User',
      dataIndex: 'user',
      key: 'user',
    },
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp: string) => new Date(timestamp).toLocaleString(),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2}>System Dashboard</Title>
      <Text type="secondary">Overview of your church management system</Text>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Link href="/superadmin/users">
            <Card hoverable>
              <Statistic
                title="Total Users"
                value={stats.totalUsers}
                prefix={<UserOutlined />}
                suffix={
                  <Text type="secondary" style={{ fontSize: 14 }}>
                    ({stats.activeUsers} active)
                  </Text>
                }
              />
            </Card>
          </Link>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Link href="/superadmin/groups">
            <Card hoverable>
              <Statistic
                title="Total Groups"
                value={stats.totalGroups}
                prefix={<TeamOutlined />}
                suffix={
                  <Text type="secondary" style={{ fontSize: 14 }}>
                    ({stats.activeGroupLeaders} leaders)
                  </Text>
                }
              />
            </Card>
          </Link>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Link href="/superadmin/converts">
            <Card hoverable>
              <Statistic
                title="New Converts"
                value={stats.totalConverts}
                prefix={<HeartOutlined />}
                suffix={
                  <span style={{ fontSize: 14, color: '#52c41a' }}>
                    <RiseOutlined /> {stats.convertsThisMonth} this month
                  </span>
                }
              />
            </Card>
          </Link>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={16}>
          <Card title="Recent Activity" extra={<CalendarOutlined />}>
            <Table
              dataSource={recentActivity}
              columns={activityColumns}
              rowKey="id"
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Quick Actions">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Link href="/superadmin/users">
                <Card.Grid hoverable style={{ width: '100%', textAlign: 'center' }}>
                  <UserOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                  <div>Manage Users</div>
                </Card.Grid>
              </Link>
              <Link href="/superadmin/groups">
                <Card.Grid hoverable style={{ width: '100%', textAlign: 'center' }}>
                  <TeamOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                  <div>Manage Groups</div>
                </Card.Grid>
              </Link>
              <Link href="/superadmin/converts">
                <Card.Grid hoverable style={{ width: '100%', textAlign: 'center' }}>
                  <HeartOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                  <div>View New Converts</div>
                </Card.Grid>
              </Link>
              <Link href="/superadmin/database">
                <Card.Grid hoverable style={{ width: '100%', textAlign: 'center' }}>
                  <TrophyOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                  <div>Database Backup</div>
                </Card.Grid>
              </Link>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
