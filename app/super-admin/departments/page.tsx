'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Typography, message, Card, Tag, Space, Popconfirm } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;

interface Department {
  id: string;
  name: string;
  description: string;
  leader_id: string | null;
  leader_username: string | null;
  leader_phone: string | null;
  created_at: string;
  updated_at: string;
}

export default function DepartmentsPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchDepartments();
    }
  }, [token]);

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch departments');

      const data = await response.json();
      setDepartments(data.departments);
    } catch (error: any) {
      message.error(error.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const response = await fetch(`/api/departments/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete department');
      }

      message.success('Department deleted successfully');
      fetchDepartments();
    } catch (error: any) {
      message.error(error.message || 'Failed to delete department');
    } finally {
      setDeleting(null);
    }
  };

  const columns = [
    {
      title: 'Department Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong style={{ fontSize: 16 }}>{name}</Text>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => desc || <Text type="secondary">-</Text>,
    },
    {
      title: 'Department Leader',
      key: 'leader',
      render: (_: any, record: Department) => {
        if (!record.leader_id) {
          return <Tag color="default">No Leader Assigned</Tag>;
        }
        return (
          <Space direction="vertical" size={0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <UserOutlined style={{ color: '#1890ff' }} />
              <Text strong>{record.leader_username}</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <PhoneOutlined style={{ color: '#52c41a' }} />
              <a href={`tel:${record.leader_phone}`} style={{ color: '#52c41a' }}>
                {record.leader_phone}
              </a>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: Department) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => router.push(`/super-admin/departments/edit/${record.id}`)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete Department"
            description="Are you sure you want to delete this department?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              loading={deleting === record.id}
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <AppBreadcrumb />
      <div>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Departments</Title>
            <Text type="secondary">
              Manage church departments and assign leaders
            </Text>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => router.push('/super-admin/departments/create')}
          >
            Add New Department
          </Button>
        </div>

        <Card>
          <Table
            columns={columns}
            dataSource={departments}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showTotal: (total) => `Total ${total} departments`,
            }}
          />
        </Card>
      </div>
    </>
  );
}
