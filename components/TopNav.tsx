'use client';

import { Layout, Space, Avatar, Dropdown, Button, Typography } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const { Header } = Layout;
const { Text } = Typography;

interface TopNavProps {
  title?: string;
  showBack?: boolean;
  backUrl?: string;
}

export default function TopNav({ title, showBack = false, backUrl }: TopNavProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleBack = () => {
    if (backUrl) {
      router.push(backUrl);
    } else {
      router.back();
    }
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Header
      style={{
        padding: '0 24px',
        background: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
      }}
    >
      <Space size="large">
        {showBack && (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
            style={{ fontSize: 16 }}
          >
            Back
          </Button>
        )}
        {title && (
          <Text strong style={{ fontSize: 18 }}>
            {title}
          </Text>
        )}
      </Space>
      
      <Space>
        <Link href={user?.role === 'superadmin' ? '/superadmin' : '/leader'}>
          <Text style={{ marginRight: 16, cursor: 'pointer' }} strong>
            FLC Sheep Seeking
          </Text>
        </Link>
        <span style={{ marginRight: 16 }}>
          Welcome, <strong>{user?.email}</strong>
        </span>
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Avatar
            style={{ backgroundColor: '#1890ff', cursor: 'pointer' }}
            icon={<UserOutlined />}
          />
        </Dropdown>
      </Space>
    </Header>
  );
}
