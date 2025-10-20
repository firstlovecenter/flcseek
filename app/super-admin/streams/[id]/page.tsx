'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Button,
  message,
  Spin,
  Tag,
  Space,
  Descriptions,
  Tabs,
} from 'antd';
import {
  TeamOutlined,
  AppstoreOutlined,
  ArrowLeftOutlined,
  EditOutlined,
  UserOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import dayjs from 'dayjs';

interface Stream {
  id: string;
  name: string;
  description: string;
  stream_leader_id: string;
  stream_leader_name: string;
  active_groups_count: number;
  members_count: number;
  created_at: string;
  updated_at: string;
}

interface Group {
  id: string;
  name: string;
  description: string;
  leader_username: string;
  member_count: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  group_name_ref: string;
}

export default function StreamDetailPage({ params }: { params: { id: string } }) {
  const { token } = useAuth();
  const router = useRouter();
  const [stream, setStream] = useState<Stream | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStreamData();
    fetchGroups();
    fetchUsers();
  }, [params.id, token]);

  const fetchStreamData = async () => {
    try {
      const response = await fetch(`/api/streams/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStream(data);
      } else if (response.status === 401) {
        message.error('Session expired. Please login again.');
        router.push('/');
      } else if (response.status === 404) {
        message.error('Stream not found');
        router.push('/super-admin/streams');
      }
    } catch (error) {
      console.error('Error fetching stream:', error);
      message.error('Failed to load stream information');
    }
  };

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/groups?stream_id=${params.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      message.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Filter users that belong to this stream
        const streamUsers = data.filter((u: User) => {
          // Find if user belongs to a group in this stream
          const userGroup = groups.find(g => g.leader_username === u.username);
          return userGroup !== undefined;
        });
        setUsers(streamUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const groupColumns = [
    {
      title: 'Group Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <strong>{name}</strong>,
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
            <div style={{ fontSize: '12px' }}>
              {start.format('MMM DD, YYYY')} - {end.format('MMM DD, YYYY')}
            </div>
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

  const userColumns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={role === 'stream_leader' ? 'purple' : 'blue'}>
          {role.replace('_', ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Group',
      dataIndex: 'group_name_ref',
      key: 'group_name_ref',
      render: (name: string) => name || '-',
    },
  ];

  if (loading && !stream) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!stream) {
    return null;
  }

  const activeGroups = groups.filter(g => g.is_active).length;
  const totalMembers = groups.reduce((sum, g) => sum + (g.member_count || 0), 0);

  return (
    <div style={{ padding: '24px' }}>
      <Space style={{ marginBottom: '24px' }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => router.push('/super-admin/streams')}
        >
          Back to Streams
        </Button>
      </Space>

      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, marginBottom: '16px' }}>{stream.name}</h1>
            <Descriptions column={2}>
              <Descriptions.Item label="Description">
                {stream.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Stream Leader">
                {stream.stream_leader_name ? (
                  <Tag icon={<UserOutlined />} color="purple">
                    {stream.stream_leader_name}
                  </Tag>
                ) : (
                  <Tag color="orange">Not Assigned</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                <CalendarOutlined /> {dayjs(stream.created_at).format('MMM DD, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Last Updated">
                <CalendarOutlined /> {dayjs(stream.updated_at).format('MMM DD, YYYY')}
              </Descriptions.Item>
            </Descriptions>
          </div>
          <Button 
            type="primary" 
            icon={<EditOutlined />}
            onClick={() => router.push('/super-admin/streams')}
          >
            Edit Stream
          </Button>
        </div>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Active Groups"
              value={activeGroups}
              suffix={`/ ${groups.length}`}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Members"
              value={totalMembers}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Avg Members/Group"
              value={groups.length > 0 ? Math.round(totalMembers / groups.length) : 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="groups"
        items={[
          {
            key: 'groups',
            label: `Groups (${groups.length})`,
            children: (
              <Card>
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
          {
            key: 'users',
            label: `Users (${users.length})`,
            children: (
              <Card>
                <Table
                  columns={userColumns}
                  dataSource={users}
                  rowKey="id"
                  pagination={{
                    pageSize: 10,
                    showTotal: (total) => `Total ${total} users`,
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
