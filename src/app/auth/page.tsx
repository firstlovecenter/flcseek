'use client';

import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [form] = Form.useForm();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'superadmin') {
        router.push('/superadmin');
      } else if (user.role === 'leadpastor' || user.role === 'overseer') {
        router.push('/leadpastor');
      } else if (user.role === 'admin' || user.role === 'leader') {
        // Redirect to their group or group selector
        if (user.group_id) {
          router.push(`/${user.group_id}`);
        } else {
          router.push('/');
        }
      } else {
        router.push('/');
      }
    }
  }, [user, loading, router]);

  const onFinish = async (values: { username: string; password: string }) => {
    try {
      await login(values.username, values.password);
      message.success('Login successful!');
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : 'Login failed');
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #e6f0ff 0%, #ffffff 50%, #e6f0ff 100%)',
        }}
      >
        <div
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{ borderColor: '#003366' }}
        ></div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        background: 'linear-gradient(135deg, #e6f0ff 0%, #f0f5ff 25%, #ffffff 50%, #f0f5ff 75%, #e6f0ff 100%)',
        backgroundAttachment: 'fixed',
        position: 'relative',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: '500px',
          borderRadius: 12,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 51, 102, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 51, 102, 0.15)',
        }}
        styles={{ body: { padding: '40px 32px' } }}
      >
        <div className="text-center mb-6 sm:mb-8" style={{ textAlign: 'center' }}>
          <Title
            level={2}
            style={{
              color: '#003366',
              marginBottom: 16,
              fontSize: 'clamp(1.5rem, 5vw, 2rem)',
              textShadow: '0 2px 8px rgba(0, 51, 102, 0.15)',
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            FLC Sheep Seeking
          </Title>
          <Text
            style={{
              fontSize: 'clamp(0.875rem, 3vw, 1rem)',
              color: 'rgba(0, 0, 0, 0.65)',
              textAlign: 'center',
              display: 'block',
            }}
          >
            Church Milestone Tracking System
          </Text>
        </div>

        <Form form={form} onFinish={onFinish} layout="vertical" size="large">
          <Form.Item
            name="username"
            rules={[
              { required: true, message: 'Please enter your username' }
            ]}
            style={{ textAlign: 'center' }}
          >
            <Input
              prefix={<UserOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />}
              placeholder="Username"
              autoComplete="username"
              style={{ height: 44, textAlign: 'left' }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please enter your password' }]}
            style={{ textAlign: 'center' }}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />}
              placeholder="Password"
              autoComplete="current-password"
              style={{ height: 44, textAlign: 'left' }}
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
                background: 'linear-gradient(135deg, #003366 0%, #004080 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0, 51, 102, 0.25)',
              }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center mt-4 sm:mt-6" style={{ textAlign: 'center' }}>
          <Text
            style={{
              fontSize: 'clamp(0.75rem, 2.5vw, 0.875rem)',
              color: 'rgba(0, 0, 0, 0.45)',
              textAlign: 'center',
              display: 'block',
            }}
          >
            Only authorized users can log in
          </Text>
        </div>
      </Card>
    </div>
  );
}
