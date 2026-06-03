'use client';

import { useEffect, useState } from 'react';
import {
  Users,
  UsersRound,
  Heart,
  Calendar,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { api } from '@/lib/api';
import { message } from '@/lib/toast';
import { StatCard } from '@/components/base/StatCard';
import { LoadingScreen } from '@/components/base/LoadingScreen';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalGroups: number;
  totalConverts: number;
  convertsThisMonth: number;
  activeGroupLeaders: number;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  user: string;
}

const activityBadgeClass: Record<string, string> = {
  USER: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  GROUP: 'bg-green-500/15 text-green-700 dark:text-green-300',
  CONVERT: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  MILESTONE: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
};

export default function SuperAdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalGroups: 0,
    totalConverts: 0,
    convertsThisMonth: 0,
    activeGroupLeaders: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityPage, setActivityPage] = useState(1);
  const activityPageSize = 5;

  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  const fetchDashboardData = async () => {
    try {
      const statsResponse = await api.stats.getDashboard();

      if (statsResponse.success && statsResponse.data) {
        const { summary } = statsResponse.data;
        setStats({
          totalUsers: 0,
          activeUsers: 0,
          totalGroups: summary.totalGroups || 0,
          totalConverts: summary.totalPeople || 0,
          convertsThisMonth: 0,
          activeGroupLeaders: 0,
        });
      }

      const response = await fetch('/api/superadmin/dashboard', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.stats) {
        setStats((prev) => ({
          ...prev,
          totalUsers: data.stats.totalUsers || prev.totalUsers,
          activeUsers: data.stats.activeUsers || prev.activeUsers,
          activeGroupLeaders: data.stats.activeGroupLeaders || prev.activeGroupLeaders,
          convertsThisMonth: data.stats.convertsThisMonth || prev.convertsThisMonth,
        }));
      }
      setRecentActivity(data.recentActivity || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const paginatedActivity = recentActivity.slice(
    (activityPage - 1) * activityPageSize,
    activityPage * activityPageSize
  );
  const activityTotalPages = Math.ceil(recentActivity.length / activityPageSize);

  if (loading) {
    return <LoadingScreen label="Loading dashboard…" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your church management system
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/superadmin/users" className="transition-opacity hover:opacity-90">
          <StatCard
            title="Total users"
            value={stats.totalUsers}
            subtitle={`(${stats.activeUsers} active)`}
            icon={Users}
            accent="members"
          />
        </Link>
        <Link href="/superadmin/groups" className="transition-opacity hover:opacity-90">
          <StatCard
            title="Total groups"
            value={stats.totalGroups}
            subtitle={`(${stats.activeGroupLeaders} leaders)`}
            icon={UsersRound}
            accent="churches"
          />
        </Link>
        <Link href="/superadmin/converts" className="transition-opacity hover:opacity-90">
          <StatCard
            title="New converts"
            value={stats.totalConverts}
            icon={Heart}
            accent="arrivals"
            delta={`${stats.convertsThisMonth} this month`}
            deltaPositive
          />
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-medium">Recent activity</CardTitle>
          <Calendar className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedActivity.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No recent activity
                  </TableCell>
                </TableRow>
              ) : (
                paginatedActivity.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={activityBadgeClass[item.type] || ''}
                      >
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.user}</TableCell>
                    <TableCell className="tabular-nums">
                      {new Date(item.timestamp).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {activityTotalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground tabular-nums">
                Page {activityPage} of {activityTotalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={activityPage <= 1}
                  onClick={() => setActivityPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={activityPage >= activityTotalPages}
                  onClick={() => setActivityPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
