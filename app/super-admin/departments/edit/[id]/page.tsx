'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Card, Typography, message, Spin, Space } from 'antd';
import { EditOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface User {
  id: string;
  username: string;
  phone_number: string;
  department_id: string | null;
  department_name: string | null;
}

interface Department {
  id: string;
  name: string;
  description: string;
  leader_id: string | null;
}

export default function EditDepartmentPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingDepartment, setLoadingDepartment] = useState(true);
  const [department, setDepartment] = useState<Department | null>(null);

  useEffect(() => {
    if (token && params.id) {
      fetchDepartment();
      fetchSheepSeekers();
    }
  }, [token, params.id]);

  const fetchDepartment = async () => {
    try {
      const response = await fetch(`/api/departments/${params.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch department');

      const data = await response.json();
      setDepartment(data.department);
      
      // Set form values
      form.setFieldsValue({
        name: data.department.name,
        description: data.department.description,
        leader_id: data.department.leader_id,
      });
    } catch (error: any) {
      message.error(error.message || 'Failed to load department');
      router.push('/super-admin/departments');
    } finally {
      setLoadingDepartment(false);
    }
  };

  const fetchSheepSeekers = async () => {
    try {
      const response = await fetch('/api/users/sheep-seekers', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch users');

      const data = await response.json();
      setUsers(data.users);
    } catch (error: any) {
      message.error(error.message || 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/departments/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update department');
      }

      message.success('Department updated successfully!');
      router.push('/super-admin/departments');
    } catch (error: any) {
      message.error(error.message || 'Failed to update department');
    } finally {
      setLoading(false);
    }
  };

  // Filter out users who are already assigned as leaders (except current leader)
  const availableUsers = users.filter(
    user => !user.department_id || user.id === department?.leader_id
  );

  if (loadingDepartment) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <AppBreadcrumb />
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <Card>
          <div style={{ marginBottom: 24 }}>
            <Title level={2}>
              <EditOutlined /> Edit Department
            </Title>
            <Text type="secondary">
              Update department details and reassign leader
            </Text>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
          >
            <Form.Item
              name="name"
              label="Department Name"
              rules={[
                { required: true, message: 'Please enter department name' },
                { min: 2, message: 'Name must be at least 2 characters' },
              ]}
            >
              <Input placeholder="e.g., January, February, Youth Ministry" size="large" />
            </Form.Item>

            <Form.Item
              name="description"
              label="Description"
            >
              <TextArea
                placeholder="Brief description of the department (optional)"
                rows={4}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="leader_id"
              label="Department Leader"
              help="Select a Sheep Seeker to lead this department (optional)"
            >
              <Select
                placeholder="Search and select a user"
                size="large"
                allowClear
                showSearch
                loading={loadingUsers}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={availableUsers.map(user => ({
                  value: user.id,
                  label: `${user.username} (${user.phone_number})`,
                }))}
                suffixIcon={<SearchOutlined />}
                notFoundContent={
                  loadingUsers ? <Spin size="small" /> : 'No available users'
                }
              />
            </Form.Item>

            <Form.Item>
              <Space style={{ width: '100%' }} direction="vertical">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  size="large"
                  block
                  icon={<EditOutlined />}
                >
                  Update Department
                </Button>
                <Button
                  size="large"
                  block
                  onClick={() => router.push('/super-admin/departments')}
                >
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </>
  );
}
