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
import { useState, useEffect } from 'react';

const { Header } = Layout;
const { Text } = Typography;

interface TopNavProps {
  title?: string;
  showBack?: boolean;
  backUrl?: string;
}

export default function TopNav({ title, showBack = false, backUrl }: TopNavProps) {
  const { user, logout, token } = useAuth();
  const router = useRouter();
  const [groupInfo, setGroupInfo] = useState<{ name: string; year: number } | null>(null);

  useEffect(() => {
    const fetchGroupInfo = async () => {
      if (!user || !token) return;
      
      // Only fetch for admin and leader users
      if (user.role === 'superadmin' || user.role === 'leadpastor') return;

      // Use user's stored group info if available
      if (user.group_name && user.group_year) {
        setGroupInfo({ name: user.group_name, year: user.group_year });
        return;
      }

      // Otherwise fetch from API
      try {
        const response = await fetch('/api/groups', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          // Find the user's group
          const userGroup = data.groups?.find((g: any) => 
            g.name === user.group_name
          );
          if (userGroup) {
            setGroupInfo({ name: userGroup.name, year: userGroup.year });
          }
        }
      } catch (error) {
        console.error('Failed to fetch group info:', error);
      }
    };

    fetchGroupInfo();
  }, [user, token]);

  const getHeaderTitle = () => {
    if (user?.role === 'superadmin') {
      return 'FLC Sheep Seeking';
    }

    if (user?.role === 'leadpastor') {
      return 'FLC Sheep Seeking | Lead Pastor';
    }

    if (!groupInfo) {
      return 'Loading...';
    }

    const isAdmin = user?.role === 'admin';
    const roleText = isAdmin ? 'Admin' : 'New Converts Tracker';
    return `${groupInfo.name} ${groupInfo.year} | ${roleText}`;
  };

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
        <Link href={user?.role === 'superadmin' ? '/superadmin' : '/sheep-seeker'}>
          <Text style={{ marginRight: 16, cursor: 'pointer' }} strong>
            {getHeaderTitle()}
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
