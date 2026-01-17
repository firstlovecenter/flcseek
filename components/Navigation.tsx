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
  DatabaseOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useTheme } from '@/components/AppConfigProvider';
import { api } from '@/lib/api';

const { Header, Content, Footer } = Layout;

interface NavigationProps {
  children: React.ReactNode;
}

export default function Navigation({ children }: NavigationProps) {
  const { user, logout, token } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
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
        const response = await api.groups.list();
        if (response.success && response.data) {
          // Find the user's group
          const userGroup = response.data?.find((g: any) => 
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
      // Check if we're on a specific month page
      const monthMatch = pathname.match(/\/leadpastor\/([^\/]+)/);
      if (monthMatch && monthMatch[1]) {
        const month = monthMatch[1];
        const monthName = month.charAt(0).toUpperCase() + month.slice(1);
        // Use current year as default (lead pastor can see all years)
        const currentYear = new Date().getFullYear();
        return `${monthName} ${currentYear} | Lead Pastor`;
      }
      return 'FLC Sheep Seeking | Lead Pastor';
    }

    if (!groupInfo) {
      return 'Loading...';
    }

    const isAdmin = user?.role === 'admin';
    const roleText = isAdmin ? 'Admin' : 'New Converts Tracker';
    return `${groupInfo.name} ${groupInfo.year} | ${roleText}`;
  };

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
      key: '/superadmin',
      icon: <HomeOutlined />,
      label: <Link href="/superadmin">Dashboard</Link>,
    },
    {
      key: 'users',
      icon: <TeamOutlined />,
      label: <Link href="/superadmin/users">Users</Link>,
    },
    {
      key: 'groups',
      icon: <UsergroupAddOutlined />,
      label: <Link href="/superadmin/groups">Groups</Link>,
    },
    {
      key: 'milestones',
      icon: <OrderedListOutlined />,
      label: <Link href="/superadmin/milestones">Milestones</Link>,
    },
    {
      key: 'converts',
      icon: <TeamOutlined />,
      label: <Link href="/superadmin/converts">New Converts</Link>,
    },
    {
      key: 'database',
      icon: <DatabaseOutlined />,
      label: <Link href="/superadmin/database">Database</Link>,
    },
  ];

  // Mobile Bottom Navigation items for Super Admin
  const superAdminBottomMenuItems = [
    {
      key: '/superadmin',
      icon: <HomeOutlined />,
      label: <Link href="/superadmin">Home</Link>,
    },
    {
      key: '/superadmin/users',
      icon: <TeamOutlined />,
      label: <Link href="/superadmin/users">Users</Link>,
    },
    {
      key: '/superadmin/converts',
      icon: <TeamOutlined />,
      label: <Link href="/superadmin/converts">Converts</Link>,
    },
    {
      key: '/superadmin/groups',
      icon: <UsergroupAddOutlined />,
      label: <Link href="/superadmin/groups">Groups</Link>,
    },
    {
      key: '/superadmin/database',
      icon: <DatabaseOutlined />,
      label: <Link href="/superadmin/database">Database</Link>,
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
              fontSize: 24,
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
            }}
          >
            {getHeaderTitle()}
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
          <Button
            type="primary"
            danger
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            style={{
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            Logout
          </Button>
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
