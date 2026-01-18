'use client';

import { useState, useEffect, Suspense } from 'react';
import { Form, Input, Select, Button, Card, Typography, message, Space, Spin } from 'antd';
import { UserAddOutlined, HomeOutlined, BarChartOutlined, TeamOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import AppBreadcrumb from '@/components/AppBreadcrumb';
import { api } from '@/lib/api';

const { Title, Text } = Typography;

function RegisterPersonContent() {
  const { token, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(groupId);

  useEffect(() => {
    // Check group access: superadmin/leadpastor can view any; admin/leader limited to their group
    if (user && user.role !== 'superadmin' && user.role !== 'leadpastor' && user.role !== 'overseer' && user.group_id !== groupId) {
      router.push('/');
      return;
    }

    fetchGroups();
  }, [user, groupId, router]);

  useEffect(() => {
    // Pre-select group if it's valid
    if (groupId && groups.length > 0) {
      const group = groups.find(g => g.id === groupId);
      if (group) {
        form.setFieldsValue({ group_id: groupId });
        setSelectedGroupId(groupId);
      }
    }
  }, [groupId, groups, form]);

  const fetchGroups = async () => {
    try {
      const response = await api.groups.list();
      if (response.success) {
        setGroups(response.data?.groups || []);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const response = await api.people.create(values);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to register person');
      }

      message.success('Person registered successfully!');
      form.resetFields();
      // Navigate back with groupId in path
      router.push(`/${groupId}`);
    } catch (error: any) {
      message.error(error.message || 'Failed to register person');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AppBreadcrumb />
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Space>
          <Button
            icon={<BarChartOutlined />}
            onClick={() => {
              router.push(`/${groupId}`);
            }}
          >
            Milestones
          </Button>
          <Button
            icon={<TeamOutlined />}
            onClick={() => {
              router.push(`/${groupId}/attendance`);
            }}
          >
            Attendance
          </Button>
          <Button
            icon={<UserAddOutlined />}
            type="primary"
          >
            Register
          </Button>
          <Button
            icon={<FileExcelOutlined />}
            onClick={() => {
              router.push(`/${groupId}/people/bulk-register`);
            }}
          >
            Bulk Register
          </Button>
        </Space>
      </div>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <Card>
          <div style={{ marginBottom: 24 }}>
            <Title level={2}>
              <UserAddOutlined /> Register New Convert
            </Title>
            <Text type="secondary">
              Add a new convert to track their spiritual progress
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
              rules={[{ required: true, message: 'Please enter first name' }]}
            >
              <Input placeholder="John" size="large" />
            </Form.Item>

            <Form.Item
              name="last_name"
              label="Last Name"
              rules={[{ required: true, message: 'Please enter last name' }]}
            >
              <Input placeholder="Doe" size="large" />
            </Form.Item>

            <Form.Item
              name="phone_number"
              label="Phone Number"
              rules={[
                { required: true, message: 'Please enter phone number' },
                { pattern: /^[0-9+\-\s()]+$/, message: 'Invalid phone number' },
              ]}
            >
              <Input placeholder="+233 123 456 789" size="large" />
            </Form.Item>

            <Form.Item
              name="date_of_birth"
              label="Date of Birth (without year)"
              rules={[
                { required: true, message: 'Please enter date of birth' },
                { pattern: /^\d{2}-\d{2}$/, message: 'Format must be DD-MM (e.g., 15-03)' },
              ]}
              extra="Format: DD-MM (e.g., 15-03 for March 15)"
            >
              <Input placeholder="15-03" size="large" maxLength={5} />
            </Form.Item>

            <Form.Item
              name="gender"
              label="Gender"
              rules={[{ required: true, message: 'Please select gender' }]}
            >
              <Select placeholder="Select gender" size="large">
                <Select.Option value="Male">Male</Select.Option>
                <Select.Option value="Female">Female</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="residential_location"
              label="Residential Location"
              rules={[{ required: true, message: 'Please enter residential location' }]}
            >
              <Input placeholder="e.g., Accra, Ghana" size="large" />
            </Form.Item>

            <Form.Item
              name="school_residential_location"
              label="School Residential Location (if applicable)"
            >
              <Input placeholder="e.g., KNUST Campus" size="large" />
            </Form.Item>

            <Form.Item
              name="occupation_type"
              label="Worker or Student"
              rules={[{ required: true, message: 'Please select worker or student' }]}
            >
              <Select placeholder="Select worker or student" size="large">
                <Select.Option value="Worker">Worker</Select.Option>
                <Select.Option value="Student">Student</Select.Option>
                <Select.Option value="Unemployed">Unemployed</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="group_id"
              label="Group"
              rules={[{ required: true, message: 'Please select group' }]}
            >
              <Select 
                placeholder="Select group" 
                size="large"
                onChange={(value) => setSelectedGroupId(value)}
                disabled={true}
              >
                {groups.map((group) => (
                  <Select.Option key={group.id} value={group.id}>
                    {group.name} ({group.year})
                  </Select.Option>
                ))}
              </Select>
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
                Register Convert
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </>
  );
}

export default function RegisterPersonPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>}>
      <RegisterPersonContent />
    </Suspense>
  );
}
