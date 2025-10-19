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
      key: 'register',
      icon: <UserAddOutlined />,
      label: 'Register New Person',
      onClick: () => router.push('/super-admin/people/register'),
    },
    {
      key: 'send-sms',
      icon: <MessageOutlined />,
      label: 'Send SMS',
      onClick: () => router.push('/super-admin/sms/send'),
    },
    {
      key: 'create-user',
      icon: <TeamOutlined />,
      label: 'Create User',
      onClick: () => router.push('/super-admin/users/create'),
    },
    {
      key: 'view-reports',
      icon: <FileAddOutlined />,
      label: 'View Reports',
      onClick: () => router.push('/super-admin/reports/overview'),
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
      label: 'View All People',
      onClick: () => router.push('/sheep-seeker/people'),
    },
  ];

  const actions = user?.role === 'super_admin' ? superAdminActions : sheepSeekerActions;

  return (
    <Dropdown menu={{ items: actions }} placement="bottomRight">
      <Button type="primary" icon={<MoreOutlined />}>
        Quick Actions
      </Button>
    </Dropdown>
  );
}
