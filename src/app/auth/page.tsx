'use client';

import { Form, Input, Button, Card, Typography, message, theme } from 'antd';
import { UserOutlined, LockOutlined, BulbOutlined, BulbFilled } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/AppConfigProvider';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;
const { useToken } = theme;

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const [form] = Form.useForm();
  const { token: antdToken } = useToken();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'superadmin') {
        router.push('/superadmin');
      } else if (user.role === 'leadpastor') {
        router.push('/leadpastor');
      } else if (user.role === 'admin' || user.role === 'leader') {
        // Redirect to their group or group selector
        if (user.group_id) {
          router.push(`/${user.group_id}`);
        } else {
          router.push('/groups');
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
    } catch (error: any) {
      message.error(error.message || 'Login failed');
    }
  };

  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          background: isDark 
            ? 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)'
            : 'linear-gradient(135deg, #e6f0ff 0%, #ffffff 50%, #e6f0ff 100%)',
        }}
      >
        <div 
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{ borderColor: isDark ? antdToken.colorPrimary : '#003366' }}
        ></div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 25%, #262626 50%, #1a1a1a 75%, #0a0a0a 100%)'
          : 'linear-gradient(135deg, #e6f0ff 0%, #f0f5ff 25%, #ffffff 50%, #f0f5ff 75%, #e6f0ff 100%)',
        backgroundAttachment: 'fixed',
        position: 'relative',
      }}
    >
      {/* Theme Toggle Button */}
      <Button
        type="text"
        icon={isDark ? <BulbOutlined /> : <BulbFilled />}
        onClick={toggleTheme}
        style={{ 
          position: 'absolute',
          top: 20,
          right: 20,
          color: isDark ? '#fff' : '#003366',
          fontSize: '20px',
          height: '44px',
          width: '44px',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 51, 102, 0.1)',
          borderRadius: '50%',
          backdropFilter: 'blur(10px)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 51, 102, 0.2)',
        }}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      />
      
      <Card 
        className="w-full max-w-md shadow-2xl" 
        style={{ 
          borderRadius: 12,
          background: isDark 
            ? 'rgba(26, 26, 26, 0.95)'
            : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          border: isDark 
            ? '1px solid rgba(255, 255, 255, 0.1)'
            : '1px solid rgba(0, 51, 102, 0.2)',
          boxShadow: isDark
            ? '0 8px 32px rgba(0, 0, 0, 0.4)'
            : '0 8px 32px rgba(0, 51, 102, 0.15)',
        }}
        styles={{ body: { padding: '24px 20px' } }}
      >
        <div className="text-center mb-6 sm:mb-8">
          <Title 
            level={2} 
            style={{ 
              color: isDark ? '#4096ff' : '#003366',
              marginBottom: 8,
              fontSize: 'clamp(1.5rem, 5vw, 2rem)',
              textShadow: isDark 
                ? '0 2px 8px rgba(64, 150, 255, 0.3)'
                : '0 2px 8px rgba(0, 51, 102, 0.15)',
              fontWeight: 700,
            }}
          >
            FLC Sheep Seeking
          </Title>
          <Text 
            style={{ 
              fontSize: 'clamp(0.875rem, 3vw, 1rem)',
              color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.65)',
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
          >
            <Input
              prefix={<UserOutlined style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} />}
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
              prefix={<LockOutlined style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} />}
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
                background: isDark
                  ? 'linear-gradient(135deg, #4096ff 0%, #1677ff 100%)'
                  : 'linear-gradient(135deg, #003366 0%, #004080 100%)',
                border: 'none',
                boxShadow: isDark
                  ? '0 4px 12px rgba(64, 150, 255, 0.3)'
                  : '0 4px 12px rgba(0, 51, 102, 0.25)',
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
              color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.45)',
            }}
          >
            Only authorized users can log in
          </Text>
        </div>
      </Card>
    </div>
  );
}
