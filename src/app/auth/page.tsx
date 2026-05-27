'use client';

import { Form, Input, Button, Typography, App } from 'antd';
import { UserOutlined, LockOutlined, HomeOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [form] = Form.useForm();
  const { message } = App.useApp();

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
          background: 'linear-gradient(160deg, #eef3fb 0%, #ffffff 60%)',
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
        background: 'linear-gradient(160deg, #eef3fb 0%, #ffffff 55%, #eef3fb 100%)',
        backgroundAttachment: 'fixed',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #eef0f2',
          boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 12px 32px rgba(0,51,102,0.10)',
          padding: '40px 32px',
        }}
      >
        {/* Brand mark + heading */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #003366 0%, #004a93 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18,
              boxShadow: '0 6px 16px rgba(0,51,102,0.25)',
            }}
          >
            <HomeOutlined style={{ color: '#fff', fontSize: 26 }} />
          </div>
          <Title
            level={2}
            style={{
              color: '#003366',
              margin: 0,
              marginBottom: 6,
              fontSize: 'clamp(1.5rem, 5vw, 1.9rem)',
              fontWeight: 700,
              letterSpacing: '-0.01em',
            }}
          >
            FLC Sheep Seeking
          </Title>
          <Text style={{ fontSize: 14, color: 'rgba(0,0,0,0.5)' }}>
            Sign in to your dashboard
          </Text>
        </div>

        <Form form={form} onFinish={onFinish} layout="vertical" size="large" requiredMark={false}>
          <Form.Item
            name="username"
            label={<span style={{ fontSize: 13, color: 'rgba(0,0,0,0.65)' }}>Username</span>}
            rules={[{ required: true, message: 'Please enter your username' }]}
            style={{ marginBottom: 18 }}
          >
            <Input
              prefix={<UserOutlined style={{ color: 'rgba(0,0,0,0.35)' }} />}
              placeholder="Enter your username"
              autoComplete="username"
              style={{ height: 46 }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span style={{ fontSize: 13, color: 'rgba(0,0,0,0.65)' }}>Password</span>}
            rules={[{ required: true, message: 'Please enter your password' }]}
            style={{ marginBottom: 26 }}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'rgba(0,0,0,0.35)' }} />}
              placeholder="Enter your password"
              autoComplete="current-password"
              style={{ height: 46 }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
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
                background: 'linear-gradient(135deg, #003366 0%, #004a93 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,51,102,0.22)',
              }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Text style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.4)' }}>
            Only authorized users can log in
          </Text>
        </div>
      </div>
    </div>
  );
}
