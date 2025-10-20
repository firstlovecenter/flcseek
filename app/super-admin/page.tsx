'use client';

import { useEffect, useState } from 'react';
import { Card, Table, Typography, Spin, message, Progress, Tag, Button } from 'antd';
import {
  TeamOutlined,
  TrophyOutlined,
  CalendarOutlined,
  RightOutlined,
  OrderedListOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;

interface GroupSummary {
  group: string;
  totalPeople: number;
  avgProgress: number;
  avgAttendance: number;
}

export default function SuperAdminDashboard() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'superadmin')) {
      router.push('/');
      return;
    }

    if (user && token) {
      fetchSummary();
    }
  }, [user, token, authLoading, router]);

  const fetchSummary = async () => {
    try {
      const response = await fetch('/api/departments/summary', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch summary');

      const data = await response.json();
      setSummary(data.summary);
    } catch (error: any) {
      message.error(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  const columns = [
    {
      title: 'Group',
      dataIndex: 'group',
      key: 'group',
      render: (text: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarOutlined style={{ fontSize: 18, color: '#1890ff' }} />
          <Text strong style={{ fontSize: 'clamp(14px, 3vw, 16px)' }}>{text}</Text>
        </div>
      ),
      width: 160,
      fixed: 'left' as const,
    },
    {
      title: 'Members',
      dataIndex: 'totalPeople',
      key: 'totalPeople',
      render: (value: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TeamOutlined style={{ color: '#1890ff' }} />
          <Text strong>{value}</Text>
        </div>
      ),
      width: 100,
      responsive: ['md'] as any,
      sorter: (a: GroupSummary, b: GroupSummary) => a.totalPeople - b.totalPeople,
    },
    {
      title: 'Progress',
      dataIndex: 'avgProgress',
      key: 'avgProgress',
      render: (value: number) => (
        <div style={{ width: '100%', minWidth: 120 }}>
          <Progress
            percent={value}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
            format={(percent) => `${percent}%`}
            size="small"
          />
        </div>
      ),
      width: 180,
      sorter: (a: GroupSummary, b: GroupSummary) => a.avgProgress - b.avgProgress,
    },
    {
      title: 'Attendance',
      dataIndex: 'avgAttendance',
      key: 'avgAttendance',
      render: (value: number) => (
        <div style={{ width: '100%', minWidth: 120 }}>
          <Progress
            percent={value}
            strokeColor={{
              '0%': '#ffa940',
              '100%': '#52c41a',
            }}
            format={(percent) => `${percent}%`}
            size="small"
          />
        </div>
      ),
      width: 180,
      responsive: ['lg'] as any,
      sorter: (a: GroupSummary, b: GroupSummary) => a.avgAttendance - b.avgAttendance,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: GroupSummary) => (
        <Button
          type="primary"
          icon={<RightOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/super-admin/department/${record.group}`);
          }}
          size="small"
          style={{ touchAction: 'manipulation' }}
        >
          <span className="hidden sm:inline">View</span>
        </Button>
      ),
      width: 100,
      align: 'right' as const,
      fixed: 'right' as const,
    },
  ];

  const totalMembers = summary.reduce((sum, dept) => sum + dept.totalPeople, 0);
  const overallAvgProgress = summary.length
    ? Math.round(summary.reduce((sum, dept) => sum + dept.avgProgress, 0) / summary.length)
    : 0;
  const overallAvgAttendance = summary.length
    ? Math.round(summary.reduce((sum, dept) => sum + dept.avgAttendance, 0) / summary.length)
    : 0;

  return (
    <>
      <AppBreadcrumb />
      <div className="px-4 sm:px-6 lg:px-8">
        <div style={{ 
          marginBottom: 24, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
        }}>
          <div style={{ flex: '1 1 auto', minWidth: '200px' }}>
            <Title level={2} style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', marginBottom: 8 }}>
              Group Overview
            </Title>
            <Text type="secondary" style={{ fontSize: 'clamp(0.875rem, 3vw, 1rem)' }}>
              Track progress and attendance across all 12 groups
            </Text>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              type="default"
              icon={<AppstoreOutlined />}
              onClick={() => router.push('/super-admin/streams')}
              size="large"
            >
              Manage Streams
            </Button>
            <Button
              type="primary"
              icon={<OrderedListOutlined />}
              onClick={() => router.push('/super-admin/milestones')}
              size="large"
            >
              Manage Milestones
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 24
        }}>
          <Card style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <TeamOutlined style={{ fontSize: 'clamp(24px, 6vw, 32px)', color: '#1890ff' }} />
              <div style={{ minWidth: 0 }}>
                <Text type="secondary" style={{ fontSize: 'clamp(0.75rem, 2.5vw, 0.875rem)' }}>
                  Total Members
                </Text>
                <div style={{ 
                  fontSize: 'clamp(1.25rem, 5vw, 1.5rem)', 
                  fontWeight: 'bold', 
                  color: '#1890ff' 
                }}>
                  {totalMembers}
                </div>
              </div>
            </div>
          </Card>
          <Card style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <TrophyOutlined style={{ fontSize: 'clamp(24px, 6vw, 32px)', color: '#52c41a' }} />
              <div style={{ minWidth: 0 }}>
                <Text type="secondary" style={{ fontSize: 'clamp(0.75rem, 2.5vw, 0.875rem)' }}>
                  Overall Progress
                </Text>
                <div style={{ 
                  fontSize: 'clamp(1.25rem, 5vw, 1.5rem)', 
                  fontWeight: 'bold', 
                  color: '#52c41a' 
                }}>
                  {overallAvgProgress}%
                </div>
              </div>
            </div>
          </Card>
          <Card style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CalendarOutlined style={{ fontSize: 'clamp(24px, 6vw, 32px)', color: '#faad14' }} />
              <div style={{ minWidth: 0 }}>
                <Text type="secondary" style={{ fontSize: 'clamp(0.75rem, 2.5vw, 0.875rem)' }}>
                  Overall Attendance
                </Text>
                <div style={{ 
                  fontSize: 'clamp(1.25rem, 5vw, 1.5rem)', 
                  fontWeight: 'bold', 
                  color: '#faad14' 
                }}>
                  {overallAvgAttendance}%
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Group List */}
        <Card>
          <Table
            columns={columns}
            dataSource={summary}
            rowKey="group"
            pagination={false}
            scroll={{ x: 600 }}
            style={{ cursor: 'pointer' }}
            onRow={(record) => ({
              onClick: () => router.push(`/super-admin/department/${record.group}`),
              style: { cursor: 'pointer' },
            })}
            rowClassName="hover:bg-gray-50"
            size="middle"
          />
        </Card>
      </div>
    </>
  );
}
