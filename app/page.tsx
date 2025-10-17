'use client';

import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;

export default function Home() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [form] = Form.useForm();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'super_admin') {
        router.push('/super-admin');
      } else {
        router.push('/sheep-seeker');
      }
    }
  }, [user, loading, router]);

  const onFinish = async (values: { username: string; password: string }) => {
    try {
      await login(values.username, values.password);
      message.success('Login successful!');
    } catch (error: any) {
      message.error(error.message || 'Login failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <Card className="w-full max-w-md shadow-2xl" style={{ borderRadius: 12 }}>
        <div className="text-center mb-8">
          <Title level={2} style={{ color: '#003366', marginBottom: 8 }}>
            FLC Sheep Seeking
          </Title>
          <Text type="secondary">Church Progress Tracking System</Text>
        </div>

        <Form form={form} onFinish={onFinish} layout="vertical" size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Please enter your username' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Username"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Password"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              style={{ height: 48, fontSize: 16, fontWeight: 600 }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center mt-6">
          <Text type="secondary" style={{ fontSize: 12 }}>
            Only authorized Sheep Seekers and Super Admins can log in
          </Text>
        </div>
      </Card>
    </div>
  );
}
