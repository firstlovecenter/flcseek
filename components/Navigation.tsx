'use client';

import { Layout, Menu, Avatar, Dropdown, Button, Space, Drawer } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  DashboardOutlined,
  TeamOutlined,
  CalendarOutlined,
  FileTextOutlined,
  SettingOutlined,
  MenuOutlined,
  UsergroupAddOutlined,
  HomeOutlined,
  LineChartOutlined,
  ReloadOutlined,
  BulbOutlined,
  BulbFilled,
  OrderedListOutlined,
  AppstoreOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useTheme } from '@/components/AppConfigProvider';

const { Header, Content, Footer } = Layout;

interface NavigationProps {
  children: React.ReactNode;
}

export default function Navigation({ children }: NavigationProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleLogout = () => {
    logout();
    router.push('/');
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

  // Top Navigation items for Super Admin
  const superAdminTopMenuItems = [
    {
      key: '/super-admin',
      icon: <HomeOutlined />,
      label: <Link href="/super-admin">Dashboard</Link>,
    },
    {
      key: 'people',
      icon: <TeamOutlined />,
      label: 'People',
      children: [
        {
          key: '/super-admin/people',
          label: <Link href="/super-admin/people">All People</Link>,
        },
        {
          key: '/super-admin/people/register',
          label: <Link href="/super-admin/people/register">Register New</Link>,
        },
        {
          key: '/super-admin/people/bulk-register',
          label: <Link href="/super-admin/people/bulk-register">Bulk Register</Link>,
        },
      ],
    },
    {
      key: 'groups',
      icon: <UsergroupAddOutlined />,
      label: <Link href="/super-admin/groups">Groups</Link>,
    },
    {
      key: 'milestones',
      icon: <OrderedListOutlined />,
      label: <Link href="/super-admin/milestones">Milestones</Link>,
    },
    {
      key: 'reports',
      icon: <FileTextOutlined />,
      label: 'Reports',
      children: [
        {
          key: '/super-admin/reports/overview',
          label: <Link href="/super-admin/reports/overview">Overview</Link>,
        },
        {
          key: '/super-admin/reports/progress',
          label: <Link href="/super-admin/reports/progress">Progress Report</Link>,
        },
        {
          key: '/super-admin/reports/attendance',
          label: <Link href="/super-admin/reports/attendance">Attendance Report</Link>,
        },
      ],
    },
    {
      key: 'users',
      icon: <SettingOutlined />,
      label: 'Users',
      children: [
        {
          key: '/super-admin/users',
          label: <Link href="/super-admin/users">All Users</Link>,
        },
        {
          key: '/super-admin/users/create',
          label: <Link href="/super-admin/users/create">Create User</Link>,
        },
      ],
    },
  ];

  // Mobile Bottom Navigation items for Super Admin
  const superAdminBottomMenuItems = [
    {
      key: '/super-admin',
      icon: <HomeOutlined />,
      label: <Link href="/super-admin">Home</Link>,
    },
    {
      key: '/super-admin/people',
      icon: <TeamOutlined />,
      label: <Link href="/super-admin/people">People</Link>,
    },
    {
      key: '/super-admin/milestones',
      icon: <OrderedListOutlined />,
      label: <Link href="/super-admin/milestones">Milestones</Link>,
    },
    {
      key: '/super-admin/groups',
      icon: <UsergroupAddOutlined />,
      label: <Link href="/super-admin/groups">Groups</Link>,
    },
    {
      key: '/super-admin/reports/overview',
      icon: <LineChartOutlined />,
      label: <Link href="/super-admin/reports/overview">Reports</Link>,
    },
  ];

  // Top Navigation items for Sheep Seeker (Empty - navigation on pages)
  const sheepSeekerTopMenuItems: any[] = [];

  // Mobile Bottom Navigation for Sheep Seeker (Empty - navigation on pages)
  const sheepSeekerBottomMenuItems: any[] = [];

  // Top Navigation items for Lead Pastor (Empty - navigation on pages)
  const leadPastorTopMenuItems: any[] = [];

  // Mobile Bottom Navigation for Lead Pastor (Empty - navigation on pages)
  const leadPastorBottomMenuItems: any[] = [];

  // Top Navigation items for Leader (Empty - navigation on pages)
  const leaderTopMenuItems: any[] = [];

  // Mobile Bottom Navigation for Leader (Empty - navigation on pages)
  const leaderBottomMenuItems: any[] = [];

  const getMenuItemsByRole = () => {
    switch (user?.role) {
      case 'superadmin':
        return { top: superAdminTopMenuItems, bottom: superAdminBottomMenuItems };
      case 'admin':
        return { top: sheepSeekerTopMenuItems, bottom: sheepSeekerBottomMenuItems };
      case 'leadpastor':
        return { top: leadPastorTopMenuItems, bottom: leadPastorBottomMenuItems };
      case 'leader':
        return { top: leaderTopMenuItems, bottom: leaderBottomMenuItems };
      default:
        return { top: sheepSeekerTopMenuItems, bottom: sheepSeekerBottomMenuItems };
    }
  };

  const { top: topMenuItems, bottom: bottomMenuItems } = getMenuItemsByRole();

  // Don't show navigation on login page
  if (pathname === '/' || !user) {
    return <>{children}</>;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Top Navigation - Desktop */}
      <Header
        style={{
          position: 'fixed',
          zIndex: 1000,
          width: '100%',
          background: '#003366',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }}>
          <div
            style={{
              color: '#fff',
              fontSize: 20,
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
            }}
          >
            FLC Sheep Seeking
          </div>
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={[pathname]}
            items={topMenuItems}
            className="desktop-menu"
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              borderBottom: 'none',
            }}
          />
        </div>
        <Space className="desktop-user-section" size="middle">
          <Button
            type="text"
            icon={isDark ? <BulbOutlined /> : <BulbFilled />}
            onClick={toggleTheme}
            style={{ 
              color: '#fff',
              fontSize: '18px',
              height: '40px',
              padding: '0 12px',
            }}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          />
          <span style={{ color: '#fff', marginRight: 8 }}>
            <strong>{user?.email}</strong>
          </span>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Avatar
              style={{ backgroundColor: '#1890ff', cursor: 'pointer' }}
              icon={<UserOutlined />}
            />
          </Dropdown>
        </Space>
        
        {/* Mobile Action Buttons */}
        <Space className="mobile-action-buttons" size="small">
          <Button
            type="text"
            icon={isDark ? <BulbOutlined /> : <BulbFilled />}
            onClick={toggleTheme}
            style={{ color: '#fff' }}
            title="Toggle theme"
          />
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            style={{ color: '#fff' }}
            title="Refresh"
          />
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            style={{ color: '#fff' }}
            title="Logout"
          />
        </Space>
      </Header>

      {/* Main Content */}
      <Content
        style={{
          marginTop: 64,
          marginBottom: 0,
          padding: 24,
          minHeight: 'calc(100vh - 64px)',
        }}
        className="main-content"
      >
        {children}
      </Content>

      {/* Bottom Navigation - Mobile Only */}
      <Footer
        className="mobile-bottom-nav"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          padding: 0,
          background: '#003366',
          borderTop: 'none',
          boxShadow: '0 -2px 8px rgba(0,0,0,.3)',
        }}
      >
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[pathname]}
          items={bottomMenuItems}
          style={{
            borderBottom: 'none',
            display: 'flex',
            justifyContent: 'space-around',
            background: '#003366',
          }}
        />
      </Footer>

      {/* Mobile Drawer for More Options */}
      <Drawer
        title="Menu"
        placement="right"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      >
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          items={topMenuItems}
          onClick={() => setDrawerOpen(false)}
        />
      </Drawer>

      {/* CSS for Layout */}
      <style jsx global>{`
        /* Desktop: hide bottom nav, show top menu and user section */
        @media (min-width: 768px) {
          .mobile-bottom-nav {
            display: none !important;
          }
          .desktop-menu {
            display: flex !important;
          }
          .desktop-user-section {
            display: flex !important;
          }
          .mobile-action-buttons {
            display: none !important;
          }
          .main-content {
            margin-bottom: 0 !important;
            padding: 24px !important;
          }
        }

        /* Mobile: show bottom nav, hide top menu and user section */
        @media (max-width: 767px) {
          .mobile-bottom-nav {
            display: block !important;
          }
          .desktop-menu {
            display: none !important;
          }
          .desktop-user-section {
            display: none !important;
          }
          .mobile-action-buttons {
            display: flex !important;
          }
          .main-content {
            margin-bottom: 56px !important;
            padding: 16px !important;
          }
          .ant-layout-header {
            padding: 0 16px !important;
          }
        }
        
        .ant-layout-header {
          padding: 0 24px !important;
        }
        
        .ant-menu-horizontal {
          line-height: 56px !important;
        }
        
        /* Theme toggle button hover effect */
        .desktop-user-section .ant-btn-text:hover,
        .mobile-action-buttons .ant-btn-text:hover {
          background-color: rgba(255, 255, 255, 0.15) !important;
        }
        
        .desktop-user-section .ant-btn-text:active,
        .mobile-action-buttons .ant-btn-text:active {
          background-color: rgba(255, 255, 255, 0.25) !important;
        }
        
        /* Bottom navigation styling */
        .mobile-bottom-nav .ant-menu-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          flex: 0 0 auto;
          color: rgba(255, 255, 255, 0.85) !important;
          padding: 4px 8px !important;
          overflow: hidden;
        }
        
        .mobile-bottom-nav .ant-menu-item span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          display: block;
          text-align: center;
        }
        
        .mobile-bottom-nav .ant-menu-item:hover {
          color: #fff !important;
        }
        
        .mobile-bottom-nav .ant-menu-item-selected {
          color: #1890ff !important;
        }
        
        .mobile-bottom-nav .ant-menu-item .anticon {
          font-size: 20px !important;
          margin: 0 0 2px 0 !important;
        }
        
        .ant-layout-footer .ant-menu-horizontal {
          height: 56px;
        }
        
        /* Bottom nav layout - evenly distributed items */
        .mobile-bottom-nav .ant-menu {
          display: flex !important;
          gap: 0 !important;
          align-items: stretch !important;
        }
        
        .mobile-bottom-nav .ant-menu-item {
          flex: 1 1 0 !important;
          min-width: 0 !important;
        }
      `}</style>
    </Layout>
  );
}
