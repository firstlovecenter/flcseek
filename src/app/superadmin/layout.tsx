'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/base/LoadingScreen';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== 'superadmin')) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return <LoadingScreen fullScreen label="Loading…" />;
  }

  if (!user || user.role !== 'superadmin') {
    return null;
  }

  return <>{children}</>;
}
