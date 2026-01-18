'use client';

import { useEffect } from 'react';
import { Spin } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        // Not logged in - redirect to login
        router.push('/auth');
      } else if (user.role === 'superadmin') {
        // Superadmin goes to superadmin dashboard
        router.push('/superadmin');
      } else if (user.role === 'leadpastor') {
        // Leadpastor goes to group selector
        router.push('/leadpastor');
      } else if (user.group_id) {
        // Admin/leader with group_id goes directly to their group
        router.push(`/${user.group_id}`);
      } else {
        // Admin/leader without group_id goes to group selector
        router.push('/groups');
      }
    }
  }, [user, authLoading, router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin size="large" tip="Redirecting..." />
    </div>
  );
}
