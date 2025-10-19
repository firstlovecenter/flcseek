'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Card, Typography, message, Spin } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
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

export default function CreateDepartmentPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    fetchSheepSeekers();
  }, [token]);

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
      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create department');
      }

      message.success('Department created successfully!');
      form.resetFields();
      router.push('/super-admin/departments');
    } catch (error: any) {
      message.error(error.message || 'Failed to create department');
    } finally {
      setLoading(false);
    }
  };

  // Filter out users who are already assigned as leaders
  const availableUsers = users.filter(user => !user.department_id);

  return (
    <>
      <AppBreadcrumb />
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <Card>
          <div style={{ marginBottom: 24 }}>
            <Title level={2}>
              <PlusOutlined /> Create New Department
            </Title>
            <Text type="secondary">
              Add a new department and assign a leader (Sheep Seeker)
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

            {availableUsers.length === 0 && !loadingUsers && (
              <div style={{ marginBottom: 16 }}>
                <Text type="warning">
                  ⚠️ All Sheep Seekers are already assigned as department leaders. 
                  Create more users or leave this department without a leader for now.
                </Text>
              </div>
            )}

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                size="large"
                block
                icon={<PlusOutlined />}
              >
                Create Department
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </>
  );
}
