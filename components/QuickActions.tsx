'use client';

import { Button, Space, Dropdown } from 'antd';
import {
  UserAddOutlined,
  MessageOutlined,
  FileAddOutlined,
  TeamOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import type { MenuProps } from 'antd';

export default function QuickActions() {
  const { user } = useAuth();
  const router = useRouter();

  const superAdminActions: MenuProps['items'] = [
    {
      key: 'users',
      icon: <TeamOutlined />,
      label: 'Manage Users',
      onClick: () => router.push('/superadmin/users'),
    },
    {
      key: 'groups',
      icon: <TeamOutlined />,
      label: 'Manage Groups',
      onClick: () => router.push('/superadmin/groups'),
    },
    {
      key: 'converts',
      icon: <UserAddOutlined />,
      label: 'View New Converts',
      onClick: () => router.push('/superadmin/converts'),
    },
    {
      key: 'analytics',
      icon: <FileAddOutlined />,
      label: 'View Analytics',
      onClick: () => router.push('/superadmin/analytics'),
    },
  ];

  const sheepSeekerActions: MenuProps['items'] = [
    {
      key: 'register',
      icon: <UserAddOutlined />,
      label: 'Register New Person',
      onClick: () => router.push('/sheep-seeker/people/register'),
    },
    {
      key: 'view-people',
      icon: <TeamOutlined />,
      label: 'View New Converts',
      onClick: () => router.push('/sheep-seeker/people'),
    },
  ];

  const actions = user?.role === 'superadmin' ? superAdminActions : sheepSeekerActions;

  return (
    <Dropdown menu={{ items: actions }} placement="bottomRight">
      <Button type="primary" icon={<MoreOutlined />}>
        Quick Actions
      </Button>
    </Dropdown>
  );
}
