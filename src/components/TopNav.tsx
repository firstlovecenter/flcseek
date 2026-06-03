'use client';

import { ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import NotificationBell from './NotificationBell';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

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

      if (user.role === 'superadmin') return;

      if (user.role === 'leadpastor' || user.role === 'overseer') {
        return;
      }

      if (user.group_name && user.group_year) {
        setGroupInfo({ name: user.group_name, year: user.group_year });
        return;
      }

      try {
        const response = await api.groups.list();
        if (response.success && response.data) {
          const userGroup = (response.data as { name: string; year: number }[] | undefined)?.find(
            (g) => g.name === user.group_name
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
      if (groupInfo) {
        return `${groupInfo.name} ${groupInfo.year} | Lead Pastor`;
      }
      return 'FLC Sheep Seeking | Lead Pastor';
    }

    if (user?.role === 'overseer') {
      if (groupInfo) {
        return `${groupInfo.name} ${groupInfo.year} | Overseer`;
      }
      return 'FLC Sheep Seeking | Overseer';
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

  return (
    <header
      className={cn(
        'sticky top-0 z-[1000] flex items-center justify-between',
        'border-b border-border bg-card px-6 shadow-sm'
      )}
    >
      <div className="flex items-center gap-4">
        {showBack && (
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
        )}
        {title && <span className="text-lg font-semibold">{title}</span>}
      </div>

      <div className="flex items-center gap-4">
        <Link href={user?.role === 'superadmin' ? '/superadmin' : '/'}>
          <span className="cursor-pointer font-semibold">{getHeaderTitle()}</span>
        </Link>
        <NotificationBell />
        <Button variant="destructive" onClick={handleLogout}>
          <LogOut className="size-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}
