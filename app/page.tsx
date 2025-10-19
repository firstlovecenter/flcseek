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

  const onFinish = async (values: { email: string; password: string }) => {
    try {
      await login(values.email, values.password);
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 px-4 py-8 sm:px-6 lg:px-8">
      <Card 
        className="w-full max-w-md shadow-2xl" 
        style={{ borderRadius: 12 }}
        styles={{ body: { padding: '24px 20px' } }}
      >
        <div className="text-center mb-6 sm:mb-8">
          <Title 
            level={2} 
            style={{ 
              color: '#003366', 
              marginBottom: 8,
              fontSize: 'clamp(1.5rem, 5vw, 2rem)'
            }}
          >
            FLC Sheep Seeking
          </Title>
          <Text type="secondary" style={{ fontSize: 'clamp(0.875rem, 3vw, 1rem)' }}>
            Church Progress Tracking System
          </Text>
        </div>

        <Form form={form} onFinish={onFinish} layout="vertical" size="large">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email address' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Email"
              autoComplete="email"
              style={{ height: 44 }}
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
              style={{ height: 44 }}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              style={{ 
                height: 48, 
                fontSize: 16, 
                fontWeight: 600,
                minHeight: 44,
                touchAction: 'manipulation'
              }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center mt-4 sm:mt-6">
          <Text type="secondary" style={{ fontSize: 'clamp(0.75rem, 2.5vw, 0.875rem)' }}>
            Only authorized Sheep Seekers and Super Admins can log in
          </Text>
        </div>
      </Card>
    </div>
  );
}
