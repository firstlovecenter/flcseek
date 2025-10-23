'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Layout, Menu, Spin, Avatar, Dropdown, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  TrophyOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  HeartOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';

const { Sider, Content, Header } = Layout;
const { Text } = Typography;

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'superadmin')) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user || user.role !== 'superadmin') {
    return null;
  }

  // Get current selected key from pathname
  const getSelectedKey = () => {
    if (pathname === '/superadmin') return 'dashboard';
    const segments = pathname.split('/');
    return segments[2] || 'dashboard';
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: <Link href="/superadmin">Dashboard</Link>,
    },
    {
      key: 'users',
      icon: <UserOutlined />,
      label: <Link href="/superadmin/users">Users</Link>,
    },
    {
      key: 'groups',
      icon: <TeamOutlined />,
      label: <Link href="/superadmin/groups">Groups</Link>,
    },
    {
      key: 'milestones',
      icon: <TrophyOutlined />,
      label: <Link href="/superadmin/milestones">Milestones</Link>,
    },
    {
      key: 'converts',
      icon: <HeartOutlined />,
      label: <Link href="/superadmin/converts">New Converts</Link>,
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: <Link href="/superadmin/settings">Settings</Link>,
    },
  ];

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'username',
      label: (
        <div>
          <div style={{ fontWeight: 'bold' }}>
            {user.first_name && user.last_name 
              ? `${user.first_name} ${user.last_name}` 
              : user.email || 'Admin'}
          </div>
          <div style={{ fontSize: 12, color: '#888' }}>Super Administrator</div>
        </div>
      ),
      disabled: true,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: logout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={250}
        theme="light"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          borderRight: '1px solid #f0f0f0',
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #f0f0f0',
            fontWeight: 'bold',
            fontSize: collapsed ? 14 : 18,
            padding: '0 16px',
          }}
        >
          {collapsed ? 'SA' : 'SuperAdmin Panel'}
        </div>
        <Menu 
          mode="inline" 
          selectedKeys={[getSelectedKey()]} 
          items={menuItems} 
          style={{ border: 'none' }} 
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 250, transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            position: 'sticky',
            top: 0,
            zIndex: 1,
          }}
        >
          <Space>
            <Text strong style={{ fontSize: 16 }}>
              FLC Sheep Seeking
            </Text>
          </Space>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <Text>
                {user.first_name && user.last_name 
                  ? `${user.first_name} ${user.last_name}` 
                  : user.email || 'Admin'}
              </Text>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: '24px 16px', overflow: 'initial' }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
