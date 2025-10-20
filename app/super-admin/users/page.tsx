'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Typography, Spin, message, Tag, Modal, Space, Card, Statistic, Row, Col } from 'antd';
import { UserAddOutlined, DeleteOutlined, ExclamationCircleOutlined, EditOutlined, TeamOutlined, CrownOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;
const { confirm } = Modal;

interface User {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  role: string | null;
  group_name?: string; // deprecated column
  group_name_ref?: string; // from JOIN with groups table
  stream_name?: string; // from JOIN with streams table
  stream_id?: string;
  group_id?: string;
  created_at: string;
}

export default function UsersPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'super_admin')) {
      router.push('/');
      return;
    }

    if (user && token) {
      fetchUsers();
    }
  }, [user, token, authLoading, router]);

  const fetchUsers = async () => {
    try {
      // Note: You'll need to create this API endpoint
      const response = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch users');

      const data = await response.json();
      setUsers(data.users || []);
    } catch (error: any) {
      message.error(error.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (userId: string, username: string, role: string | null) => {
    // Prevent deletion of super_admin users
    if (role === 'super_admin') {
      message.error('Cannot delete super admin users');
      return;
    }

    confirm({
      title: 'Delete User',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to delete user "${username}"?`,
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete user');
          }

          message.success('User deleted successfully');
          fetchUsers();
        } catch (error: any) {
          message.error(error.message || 'Failed to delete user');
        }
      },
    });
  };

  const columns = [
    {
      title: 'Name',
      key: 'name',
      render: (_: any, record: User) => {
        const fullName = `${record.first_name || ''} ${record.last_name || ''}`.trim();
        return fullName || <Text type="secondary">N/A</Text>;
      },
    },
    {
      title: 'Email (Login)',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => email || <Text type="secondary">N/A</Text>,
    },
    {
      title: 'Phone',
      dataIndex: 'phone_number',
      key: 'phone_number',
      render: (phone: string) => phone ? (
        <a href={`tel:${phone}`} style={{ color: '#1890ff' }}>
          {phone}
        </a>
      ) : <Text type="secondary">N/A</Text>,
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string | null) => {
        if (!role) {
          return <Tag color="default">Not Assigned</Tag>;
        }
        const roleColors: Record<string, string> = {
          'super_admin': 'red',
          'lead_pastor': 'purple',
          'stream_leader': 'blue',
          'sheep_seeker': 'green'
        };
        const roleLabels: Record<string, string> = {
          'super_admin': 'Super Admin',
          'lead_pastor': 'Lead Pastor',
          'stream_leader': 'Stream Leader',
          'sheep_seeker': 'Sheep Seeker'
        };
        return (
          <Tag color={roleColors[role] || 'default'}>
            {roleLabels[role] || role}
          </Tag>
        );
      },
    },
    {
      title: 'Stream',
      dataIndex: 'stream_name',
      key: 'stream_name',
      render: (stream_name: string | null, record: User) => {
        if (record.role === 'super_admin' || record.role === 'lead_pastor') {
          return <Text type="secondary">All Streams</Text>;
        }
        if (!stream_name) {
          return <Tag color="warning">Not Assigned</Tag>;
        }
        return <Tag color="blue">{stream_name}</Tag>;
      },
    },
    {
      title: 'Group',
      dataIndex: 'group_name_ref',
      key: 'group_name_ref',
      render: (group_name_ref: string | null, record: User) => {
        if (record.role === 'super_admin' || record.role === 'lead_pastor') {
          return <Text type="secondary">N/A</Text>;
        }
        if (!group_name_ref) {
          return <Tag color="warning">Not Assigned</Tag>;
        }
        return <Tag color="green">{group_name_ref}</Tag>;
      },
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: User) => (
        <Space>
          <Button
            type="default"
            size="small"
            icon={<EditOutlined />}
            onClick={() => router.push(`/super-admin/users/edit/${record.id}`)}
          >
            Edit
          </Button>
          {record.role !== 'super_admin' && (
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id, record.username, record.role)}
            >
              Delete
            </Button>
          )}
        </Space>
      ),
    },
  ];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  const usersByRole = users.reduce((acc, user) => {
    const role = user.role || 'unassigned';
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const usersByStream = users.reduce((acc, user) => {
    if (user.role === 'super_admin' || user.role === 'lead_pastor') return acc;
    const stream = user.stream_name || 'Unassigned';
    acc[stream] = (acc[stream] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      <AppBreadcrumb />
      <div>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>User Management</Title>
            <Text type="secondary">
              Manage system users and their access levels
            </Text>
          </div>
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={() => router.push('/super-admin/users/create')}
            size="large"
          >
            Create New User
          </Button>
        </div>

        {/* Statistics Cards */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title="Total Users"
                value={users.length}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title="Super Admins"
                value={usersByRole['super_admin'] || 0}
                prefix={<CrownOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
                Stream Leaders: {usersByRole['stream_leader'] || 0} | Sheep Seekers: {usersByRole['sheep_seeker'] || 0}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title="Active Streams"
                value={Object.keys(usersByStream).filter(s => s !== 'Unassigned').length}
                prefix={<UsergroupAddOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
                Unassigned: {usersByStream['Unassigned'] || 0}
              </div>
            </Card>
          </Col>
        </Row>

        <Card>
          <Table
            columns={columns}
            dataSource={users}
            rowKey="id"
            pagination={{ pageSize: 20 }}
          />
        </Card>
      </div>
    </>
  );
}
