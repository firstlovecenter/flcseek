'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Card, Typography, message, Spin } from 'antd';
import { EditOutlined, SaveOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;
const { Option } = Select;

interface Group {
  id: string;
  name: string;
}

export default function EditUserPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetchingUser, setFetchingUser] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    fetchGroups();
    fetchUser();
  }, [userId]);

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const fetchUser = async () => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }

      const data = await response.json();
      form.setFieldsValue({
        first_name: data.user.first_name,
        last_name: data.user.last_name,
        username: data.user.username,
        email: data.user.email,
        phone_number: data.user.phone_number,
        role: data.user.role || 'sheep_seeker',
        group_name: data.user.group_name,
      });
    } catch (error: any) {
      message.error(error.message || 'Failed to load user');
      router.push('/super-admin/users');
    } finally {
      setFetchingUser(false);
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // Don't include password if it's empty
      const updateData = { ...values };
      if (!updateData.password) {
        delete updateData.password;
      }

      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user');
      }

      message.success('User updated successfully!');
      router.push('/super-admin/users');
    } catch (error: any) {
      message.error(error.message || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
              <EditOutlined /> Edit User
            </Title>
            <Text type="secondary">
              Update user information, role, and group assignment.
            </Text>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
          >
            <Form.Item
              name="first_name"
              label="First Name"
              rules={[
                { required: true, message: 'Please enter first name' },
                { min: 2, message: 'First name must be at least 2 characters' },
              ]}
            >
              <Input placeholder="John" size="large" />
            </Form.Item>

            <Form.Item
              name="last_name"
              label="Last Name"
              rules={[
                { required: true, message: 'Please enter last name' },
                { min: 2, message: 'Last name must be at least 2 characters' },
              ]}
            >
              <Input placeholder="Doe" size="large" />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email (Login Identifier)"
              rules={[
                { required: true, message: 'Please enter email' },
                { type: 'email', message: 'Please enter a valid email address' },
              ]}
              extra="Users login with this email. Changes will apply on next login."
            >
              <Input placeholder="user@example.com" size="large" />
            </Form.Item>

            <Form.Item
              name="phone_number"
              label="Phone Number"
              rules={[
                { required: true, message: 'Please enter phone number' },
                { pattern: /^[0-9+\-\s()]+$/, message: 'Invalid phone number format' },
              ]}
            >
              <Input placeholder="+233 123 456 789" size="large" />
            </Form.Item>

            <Form.Item
              name="password"
              label="New Password (leave blank to keep current)"
              rules={[
                { min: 6, message: 'Password must be at least 6 characters' },
              ]}
            >
              <Input.Password placeholder="Enter new password (optional)" size="large" />
            </Form.Item>

            <Form.Item
              name="role"
              label="Role"
              rules={[{ required: true, message: 'Please select a role' }]}
            >
              <Select size="large" placeholder="Select role">
                <Option value="sheep_seeker">Sheep Seeker (Group Leader)</Option>
                <Option value="super_admin">Super Admin</Option>
              </Select>
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues.role !== currentValues.role}
            >
              {({ getFieldValue }) =>
                getFieldValue('role') === 'sheep_seeker' ? (
                  <Form.Item
                    name="group_name"
                    label="Assign to Group"
                    rules={[{ required: true, message: 'Please select a group' }]}
                  >
                    <Select size="large" placeholder="Select a group">
                      {groups.map((group) => (
                        <Option key={group.id} value={group.name}>
                          {group.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                ) : null
              }
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                size="large"
                block
                icon={<SaveOutlined />}
              >
                Update User
              </Button>
            </Form.Item>

            <Form.Item>
              <Button
                size="large"
                block
                onClick={() => router.push('/super-admin/users')}
              >
                Cancel
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </>
  );
}
