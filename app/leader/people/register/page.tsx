'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Card, Typography, message, Space } from 'antd';
import { UserAddOutlined, HomeOutlined, BarChartOutlined, TeamOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;

export default function RegisterPersonPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);

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
        setGroups(data.groups?.map((g: any) => g.name) || []);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const response = await fetch('/api/people', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to register person');
      }

      message.success('Person registered successfully!');
      form.resetFields();
      router.push('/leader/people');
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
            onClick={() => router.push('/leader')}
          >
            Milestones
          </Button>
          <Button
            icon={<TeamOutlined />}
            onClick={() => router.push('/sheep-seeker/attendance')}
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
            onClick={() => router.push('/leader/people/bulk-register')}
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
              label="Occupation Type"
              rules={[{ required: true, message: 'Please select occupation type' }]}
            >
              <Select placeholder="Select occupation type" size="large">
                <Select.Option value="Worker">Worker</Select.Option>
                <Select.Option value="Student">Student</Select.Option>
                <Select.Option value="Unemployed">Unemployed</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues.occupation_type !== currentValues.occupation_type}
            >
              {({ getFieldValue }) =>
                getFieldValue('occupation_type') === 'Worker' ? (
                  <Form.Item
                    name="work_location"
                    label="Work Location"
                    rules={[{ required: true, message: 'Please enter work location' }]}
                  >
                    <Input placeholder="e.g., ABC Company, Accra" size="large" />
                  </Form.Item>
                ) : null
              }
            </Form.Item>

            <Form.Item
              name="department_name"
              label="Group"
              rules={[{ required: true, message: 'Please select group' }]}
            >
              <Select placeholder="Select group" size="large">
                {groups.map((group) => (
                  <Select.Option key={group} value={group}>
                    {group}
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
