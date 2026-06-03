'use client';

import { useState, useEffect } from 'react';
import {
  Bell,
  Gift,
  AlertTriangle,
  CheckCircle2,
  BellRing,
} from 'lucide-react';
import { SynagoLoader } from '@/components/shell/SynagoLoader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EmptyState } from '@/components/base/EmptyState';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  checkAndNotify,
} from '@/lib/push-notifications';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface Notification {
  id: string;
  type: 'birthday' | 'inactive' | 'info';
  title: string;
  message: string;
  person_id?: string;
  person_name?: string;
  created_at: string;
  read?: boolean;
}

export default function NotificationBell() {
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [open, setOpen] = useState(false);
  const [pushPermission, setPushPermission] = useState<string>('default');

  useEffect(() => {
    if (isPushSupported()) {
      setPushPermission(getNotificationPermission());
    }
  }, []);

  useEffect(() => {
    if (open && token) {
      fetchNotifications();
    }
  }, [open, token]);

  useEffect(() => {
    if (token) {
      fetchNotifications();
    }
  }, [token]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);

        if (pushPermission === 'granted') {
          checkAndNotify(data.notifications || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (!token || notifications.length === 0) return;

    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) {
      toast.info('All notifications are already read');
      return;
    }

    try {
      setMarkingAll(true);
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationIds: unreadIds }),
      });

      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        toast.success(`Marked ${unreadIds.length} notifications as read`);
      } else {
        toast.error('Failed to mark notifications as read');
      }
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
      toast.error('Failed to mark notifications as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleEnablePush = async () => {
    const result = await requestNotificationPermission();
    setPushPermission(result);

    if (result === 'granted') {
      toast.success('Push notifications enabled!');
    } else if (result === 'denied') {
      toast.warning('Push notifications were denied. You can enable them in browser settings.');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'birthday':
        return <Gift className="size-4 text-pink-500" />;
      case 'inactive':
        return <AlertTriangle className="size-4 text-warning" />;
      default:
        return <Bell className="size-4 text-primary" />;
    }
  };

  const getAvatarBg = (type: string) => {
    switch (type) {
      case 'birthday':
        return 'bg-pink-50';
      case 'inactive':
        return 'bg-warning/10';
      default:
        return 'bg-primary/10';
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!user || !['admin', 'superadmin', 'leadpastor'].includes(user.role)) {
    return null;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-10">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <Badge
              variant="default"
              className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center p-0 text-[10px]"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && <Badge variant="secondary">{unreadCount} new</Badge>}
        </div>

        <ScrollArea className="max-h-[350px]">
          {loading ? (
            <div className="flex justify-center py-10">
              <SynagoLoader size={24} />
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications" className="border-0 bg-transparent py-10" />
          ) : (
            <div>
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex gap-3 border-b px-4 py-3 transition-colors last:border-0',
                    item.read ? 'bg-card' : 'bg-success/5'
                  )}
                >
                  <Avatar className={cn('size-9', getAvatarBg(item.type))}>
                    <AvatarFallback className="bg-transparent">
                      {getNotificationIcon(item.type)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.message}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {dayjs(item.created_at).fromNow()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between gap-2 border-t px-4 py-2">
          {isPushSupported() && pushPermission !== 'granted' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="link" size="sm" className="h-auto px-0" onClick={handleEnablePush}>
                  <BellRing className="size-3.5" />
                  Enable Push
                </Button>
              </TooltipTrigger>
              <TooltipContent>Enable browser notifications</TooltipContent>
            </Tooltip>
          )}
          {isPushSupported() && pushPermission === 'granted' && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <BellRing className="size-3" /> Push enabled
            </span>
          )}

          {notifications.length > 0 && unreadCount > 0 && (
            <Button
              variant="link"
              size="sm"
              className="ml-auto h-auto px-0"
              onClick={handleMarkAllRead}
              disabled={markingAll}
            >
              {markingAll ? (
                <SynagoLoader size={14} inline />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              Mark all read
            </Button>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
