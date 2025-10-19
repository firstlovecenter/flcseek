'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Typography, Spin, message, Tag, Modal, Space } from 'antd';
import { UserAddOutlined, DeleteOutlined, ExclamationCircleOutlined, EditOutlined } from '@ant-design/icons';
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
  group_name?: string;
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
        return (
          <Tag color={role === 'super_admin' ? 'red' : 'blue'}>
            {role === 'super_admin' ? 'Super Admin' : 'Sheep Seeker'}
          </Tag>
        );
      },
    },
    {
      title: 'Assigned Group',
      dataIndex: 'group_name',
      key: 'group_name',
      render: (group_name: string | null, record: User) => {
        if (record.role === 'super_admin') {
          return <Text type="secondary">N/A</Text>;
        }
        if (!group_name) {
          return <Tag color="warning">Not Assigned</Tag>;
        }
        return <Tag color="green">{group_name}</Tag>;
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

        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          style={{ background: 'white', borderRadius: 8 }}
        />
      </div>
    </>
  );
}
