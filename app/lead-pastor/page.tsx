'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  message,
  Spin,
  Tag,
  Tabs,
  Select,
} from 'antd';
import {
  TeamOutlined,
  AppstoreOutlined,
  TrophyOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import dayjs from 'dayjs';

interface Stream {
  id: string;
  name: string;
  description: string;
  stream_leader_name: string;
  active_groups_count: number;
  members_count: number;
}

interface Group {
  id: string;
  name: string;
  description: string;
  stream_name: string;
  leader_username: string;
  member_count: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export default function LeadPastorDashboard() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedStream, setSelectedStream] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'lead_pastor') {
      router.push('/');
      return;
    }

    fetchStreams();
    fetchGroups();
  }, [user, token]);

  const fetchStreams = async () => {
    try {
      const response = await fetch('/api/streams', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStreams(data);
      } else if (response.status === 401) {
        message.error('Session expired. Please login again.');
        router.push('/');
      }
    } catch (error) {
      console.error('Error fetching streams:', error);
      message.error('Failed to load streams');
    }
  };

  const fetchGroups = async (streamId?: string) => {
    setLoading(true);
    try {
      const url = streamId && streamId !== 'all'
        ? `/api/groups?stream_id=${streamId}`
        : '/api/groups';
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      message.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const handleStreamChange = (value: string) => {
    setSelectedStream(value);
    fetchGroups(value === 'all' ? undefined : value);
  };

  const streamColumns = [
    {
      title: 'Stream Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Stream Leader',
      dataIndex: 'stream_leader_name',
      key: 'stream_leader_name',
      render: (name: string) => name || <Tag color="orange">Not Assigned</Tag>,
    },
    {
      title: 'Active Groups',
      dataIndex: 'active_groups_count',
      key: 'active_groups_count',
      align: 'center' as const,
      render: (count: number) => (
        <Tag color={count > 0 ? 'green' : 'default'} icon={<AppstoreOutlined />}>
          {count}
        </Tag>
      ),
    },
    {
      title: 'Members',
      dataIndex: 'members_count',
      key: 'members_count',
      align: 'center' as const,
      render: (count: number) => (
        <Tag color={count > 0 ? 'blue' : 'default'} icon={<TeamOutlined />}>
          {count}
        </Tag>
      ),
    },
  ];

  const groupColumns = [
    {
      title: 'Group Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Stream',
      dataIndex: 'stream_name',
      key: 'stream_name',
      render: (name: string) => <Tag color="blue">{name}</Tag>,
    },
    {
      title: 'Sheep Seeker',
      dataIndex: 'leader_username',
      key: 'leader_username',
      render: (name: string) => name || <Tag color="orange">Not Assigned</Tag>,
    },
    {
      title: 'Members',
      dataIndex: 'member_count',
      key: 'member_count',
      align: 'center' as const,
      render: (count: number) => (
        <Tag color={count > 0 ? 'blue' : 'default'} icon={<TeamOutlined />}>
          {count}
        </Tag>
      ),
    },
    {
      title: 'Lifecycle',
      key: 'lifecycle',
      render: (_: any, record: Group) => {
        if (!record.start_date) return '-';
        const start = dayjs(record.start_date);
        const end = dayjs(record.end_date);
        const now = dayjs();
        const daysLeft = end.diff(now, 'day');
        
        return (
          <div>
            <div>{start.format('MMM DD, YYYY')} - {end.format('MMM DD, YYYY')}</div>
            {daysLeft > 0 && record.is_active && (
              <Tag color={daysLeft < 30 ? 'orange' : 'green'} style={{ marginTop: '4px' }}>
                {daysLeft} days left
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      align: 'center' as const,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'default'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
  ];

  if (loading && streams.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  const totalGroups = streams.reduce((sum, s) => sum + s.active_groups_count, 0);
  const totalMembers = streams.reduce((sum, s) => sum + s.members_count, 0);
  const activeGroups = groups.filter(g => g.is_active).length;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <EyeOutlined /> Lead Pastor Dashboard
        </h1>
        <p style={{ color: '#666', marginTop: '8px' }}>
          View-only access to all streams and groups
        </p>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Streams"
              value={streams.length}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Active Groups"
              value={totalGroups}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Members"
              value={totalMembers}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Avg Members/Group"
              value={totalGroups > 0 ? Math.round(totalMembers / totalGroups) : 0}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="streams"
        items={[
          {
            key: 'streams',
            label: 'Streams Overview',
            children: (
              <Card>
                <Table
                  columns={streamColumns}
                  dataSource={streams}
                  rowKey="id"
                  pagination={{
                    pageSize: 10,
                    showTotal: (total) => `Total ${total} streams`,
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'groups',
            label: 'Groups Overview',
            children: (
              <Card
                extra={
                  <Select
                    style={{ width: 200 }}
                    value={selectedStream}
                    onChange={handleStreamChange}
                    options={[
                      { value: 'all', label: 'All Streams' },
                      ...streams.map(s => ({ value: s.id, label: s.name })),
                    ]}
                  />
                }
              >
                <Table
                  columns={groupColumns}
                  dataSource={groups}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    pageSize: 10,
                    showTotal: (total) => `Total ${total} groups`,
                  }}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
