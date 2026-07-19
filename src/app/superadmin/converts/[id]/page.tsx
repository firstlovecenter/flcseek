'use client';

import { useEffect, useState, use } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { message } from '@/lib/toast';
import { LoadingScreen } from '@/components/base/LoadingScreen';
import { ConvertProfile } from '@/components/convert/ConvertProfile';

/**
 * Legacy superadmin convert URL.
 * Redirects to the canonical group person profile when a group_id exists;
 * otherwise renders the same ConvertProfile (orphan convert edge case).
 */
export default function EditConvertPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orphan, setOrphan] = useState(false);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'superadmin') {
      router.push('/auth');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await api.people.get(id);
        if (cancelled) return;

        if (!res.success) {
          message.error(res.error?.message || 'Failed to load convert');
          router.replace('/superadmin/converts');
          return;
        }

        const person = (res.data?.person ?? res.data) as {
          group_id?: string | null;
        };
        const groupId = person?.group_id;
        if (groupId) {
          router.replace(`/${groupId}/person/${id}`);
          return;
        }

        setOrphan(true);
        setResolving(false);
      } catch {
        if (!cancelled) {
          message.error('Failed to load convert');
          router.replace('/superadmin/converts');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, id, router]);

  if (authLoading || resolving || !orphan) {
    return <LoadingScreen label="Loading convert…" />;
  }

  return (
    <ConvertProfile
      personId={id}
      onDeleted={() => router.push('/superadmin/converts')}
    />
  );
}
