'use client';

import { UserPlus, Users, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function QuickActions() {
  const { user } = useAuth();
  const router = useRouter();

  const superAdminActions = [
    {
      key: 'users',
      icon: Users,
      label: 'Manage Users',
      onClick: () => router.push('/superadmin/users'),
    },
    {
      key: 'groups',
      icon: Users,
      label: 'Manage Groups',
      onClick: () => router.push('/superadmin/groups'),
    },
    {
      key: 'converts',
      icon: UserPlus,
      label: 'View New Converts',
      onClick: () => router.push('/superadmin/converts'),
    },
  ];

  const sheepSeekerActions = [
    {
      key: 'register',
      icon: UserPlus,
      label: 'Register New Person',
      onClick: () => router.push('/people/register'),
    },
  ];

  const actions = user?.role === 'superadmin' ? superAdminActions : sheepSeekerActions;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <MoreHorizontal className="size-4" />
          Quick Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <DropdownMenuItem key={action.key} onClick={action.onClick}>
            <action.icon className="size-4" />
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
