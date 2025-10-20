'use client';

import { Breadcrumb } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function AppBreadcrumb() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Don't show breadcrumb on login page
  if (pathname === '/' || !user) {
    return null;
  }

  const pathSegments = pathname.split('/').filter(Boolean);
  
  const homeUrl = user?.role === 'superadmin' ? '/super-admin' : '/sheep-seeker';
  const homeName = user?.role === 'superadmin' ? 'Super Admin' : 'Sheep Seeker';

  const breadcrumbItems = [
    {
      title: (
        <Link href={homeUrl}>
          <HomeOutlined style={{ marginRight: 4 }} />
          {homeName}
        </Link>
      ),
    },
    ...pathSegments.slice(1).map((segment, index) => {
      const url = '/' + pathSegments.slice(0, index + 2).join('/');
      const title = segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const isLast = index === pathSegments.length - 2;

      return {
        title: isLast ? title : <Link href={url}>{title}</Link>,
      };
    }),
  ];

  return (
    <Breadcrumb
      style={{ margin: '0 0 16px 0' }}
      items={breadcrumbItems}
    />
  );
}
