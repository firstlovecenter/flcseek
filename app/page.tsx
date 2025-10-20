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
      switch (user.role) {
        case 'superadmin':
          router.push('/super-admin');
          break;
        case 'admin':
          router.push('/stream-leader');
          break;
        case 'leadpastor':
          router.push('/lead-pastor');
          break;
        case 'leader':
          router.push('/sheep-seeker');
          break;
        default:
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
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #1a0000 0%, #330000 25%, #4d0000 50%, #330000 75%, #1a0000 100%)',
        }}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-400"></div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8"
      style={{
        background: 'linear-gradient(135deg, #1a0000 0%, #330000 25%, #4d0000 50%, #330000 75%, #1a0000 100%)',
        backgroundAttachment: 'fixed',
      }}
    >
      <Card 
        className="w-full max-w-md shadow-2xl" 
        style={{ 
          borderRadius: 12,
          background: 'rgba(26, 26, 26, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        styles={{ body: { padding: '24px 20px' } }}
      >
        <div className="text-center mb-6 sm:mb-8">
          <Title 
            level={2} 
            style={{ 
              color: '#ff6b6b', 
              marginBottom: 8,
              fontSize: 'clamp(1.5rem, 5vw, 2rem)',
              textShadow: '0 2px 8px rgba(255, 107, 107, 0.3)',
            }}
          >
            FLC Sheep Seeking
          </Title>
          <Text 
            style={{ 
              fontSize: 'clamp(0.875rem, 3vw, 1rem)',
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            Church Progress Tracking System
          </Text>
        </div>

        <Form form={form} onFinish={onFinish} layout="vertical" size="large">
          <Form.Item
            name="username"
            rules={[
              { required: true, message: 'Please enter your username' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Username"
              autoComplete="username"
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
                touchAction: 'manipulation',
                background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
              }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center mt-4 sm:mt-6">
          <Text 
            style={{ 
              fontSize: 'clamp(0.75rem, 2.5vw, 0.875rem)',
              color: 'rgba(255, 255, 255, 0.6)',
            }}
          >
            Only authorized Sheep Seekers and Super Admins can log in
          </Text>
        </div>
      </Card>
    </div>
  );
}
