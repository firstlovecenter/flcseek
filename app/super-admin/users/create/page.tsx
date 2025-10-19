'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Card, Typography, message } from 'antd';
import { UserAddOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import AppBreadcrumb from '@/components/AppBreadcrumb';
import { GROUPS } from '@/lib/constants';

const { Title, Text } = Typography;
const { Option } = Select;

interface Group {
  id: string;
  name: string;
}

export default function CreateUserPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    fetchGroups();
  }, []);

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

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }

      message.success('User created successfully!');
      form.resetFields();
      router.push('/super-admin/users');
    } catch (error: any) {
      message.error(error.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AppBreadcrumb />
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <Card>
          <div style={{ marginBottom: 24 }}>
            <Title level={2}>
              <UserAddOutlined /> Create New User
            </Title>
            <Text type="secondary">
              Add a new user to the system. Assign a role and group for sheep seekers.
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
              extra="Users will login with this email"
            >
              <Input 
                placeholder="user@example.com" 
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="Password"
              rules={[
                { required: true, message: 'Please enter password' },
                { min: 6, message: 'Password must be at least 6 characters' },
              ]}
            >
              <Input.Password placeholder="Enter password" size="large" />
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
              name="role"
              label="Role"
              rules={[{ required: true, message: 'Please select a role' }]}
              initialValue="sheep_seeker"
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
                icon={<UserAddOutlined />}
              >
                Create User
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </>
  );
}
