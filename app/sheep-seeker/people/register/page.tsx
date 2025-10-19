'use client';

import { useState } from 'react';
import { Form, Input, Select, Button, Card, Typography, message } from 'antd';
import { UserAddOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { DEPARTMENTS } from '@/lib/constants';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;

export default function RegisterPersonSheepSeekerPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

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
      router.push('/sheep-seeker/people');
    } catch (error: any) {
      message.error(error.message || 'Failed to register person');
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
              <UserAddOutlined /> Register New Person
            </Title>
            <Text type="secondary">
              Add a new member to track their progress
            </Text>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
          >
            <Form.Item
              name="full_name"
              label="Full Name"
              rules={[{ required: true, message: 'Please enter full name' }]}
            >
              <Input placeholder="John Doe" size="large" />
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
              name="gender"
              label="Gender"
            >
              <Select placeholder="Select gender" size="large" allowClear>
                <Select.Option value="Male">Male</Select.Option>
                <Select.Option value="Female">Female</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="home_location"
              label="Home Location"
            >
              <Input placeholder="e.g., Accra, Ghana" size="large" />
            </Form.Item>

            <Form.Item
              name="work_location"
              label="Work Location"
            >
              <Input placeholder="e.g., Airport City, Accra" size="large" />
            </Form.Item>

            <Form.Item
              name="department_name"
              label="Department (Month)"
              rules={[{ required: true, message: 'Please select department' }]}
            >
              <Select placeholder="Select department" size="large">
                {DEPARTMENTS.map((dept) => (
                  <Select.Option key={dept} value={dept}>
                    {dept}
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
                Register Person
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </>
  );
}
