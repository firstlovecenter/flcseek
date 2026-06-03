'use client';

import { useEffect, useState } from 'react';
import {
  History,
  User,
  FileText,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { StatCard } from '@/components/base/StatCard';
import { EmptyState } from '@/components/base/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface ActivityLog {
  id: string;
  user_id: string;
  username?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: unknown;
  created_at: string;
  ip_address?: string;
}

interface ActivitySummary {
  totalActions: number;
  uniqueUsers: number;
  byAction: Record<string, number>;
  byEntityType: Record<string, number>;
}

const actionBadgeClass: Record<string, string> = {
  CREATE: 'bg-green-500/15 text-green-700 dark:text-green-300',
  UPDATE: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  DELETE: 'bg-red-500/15 text-red-700 dark:text-red-300',
  LOGIN: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  LOGOUT: 'bg-muted text-muted-foreground',
  EXPORT: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  VIEW: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
};

const entityTypeLabels: Record<string, string> = {
  convert: 'Convert',
  progress: 'Progress',
  attendance: 'Attendance',
  user: 'User',
  group: 'Group',
  milestone: 'Milestone',
  system: 'System',
};

export default function ActivityLogsPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('__all__');
  const [actionFilter, setActionFilter] = useState<string>('__all__');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (token) {
      fetchLogs();
      fetchSummary();
    }
  }, [token, entityTypeFilter, actionFilter, limit, offset]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('type', 'logs');
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
      if (entityTypeFilter !== '__all__') params.append('entity_type', entityTypeFilter);
      if (actionFilter !== '__all__') params.append('action', actionFilter);

      const response = await fetch(`/api/superadmin/activity-logs?${params}`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setHasMore(data.pagination?.hasMore || false);
      }
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      setSummaryLoading(true);
      const response = await fetch('/api/superadmin/activity-logs?type=summary&days=7', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleRefresh = () => {
    setOffset(0);
    fetchLogs();
    fetchSummary();
  };

  const handleLoadMore = () => {
    setOffset((prev) => prev + limit);
  };

  return (
    <div className="space-y-6 p-2 sm:p-0">
      <div>
        <div className="flex items-center gap-2">
          <History className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Activity logs</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          View all system activity and user actions
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total actions (7 days)"
          value={summary?.totalActions || 0}
          icon={History}
          accent="primary"
          loading={summaryLoading}
        />
        <StatCard
          title="Active users"
          value={summary?.uniqueUsers || 0}
          icon={User}
          accent="members"
          loading={summaryLoading}
        />
        <StatCard
          title="Create actions"
          value={summary?.byAction?.CREATE || 0}
          accent="campaigns"
          loading={summaryLoading}
          deltaPositive
        />
        <StatCard
          title="Update actions"
          value={summary?.byAction?.UPDATE || 0}
          accent="maps"
          loading={summaryLoading}
        />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <Filter className="size-4 text-muted-foreground" />
          <Select
            value={entityTypeFilter}
            onValueChange={(v) => {
              setEntityTypeFilter(v);
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Entity type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All entities</SelectItem>
              <SelectItem value="convert">Converts</SelectItem>
              <SelectItem value="progress">Progress</SelectItem>
              <SelectItem value="attendance">Attendance</SelectItem>
              <SelectItem value="user">Users</SelectItem>
              <SelectItem value="group">Groups</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={actionFilter}
            onValueChange={(v) => {
              setActionFilter(v);
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All actions</SelectItem>
              <SelectItem value="CREATE">Create</SelectItem>
              <SelectItem value="UPDATE">Update</SelectItem>
              <SelectItem value="DELETE">Delete</SelectItem>
              <SelectItem value="LOGIN">Login</SelectItem>
              <SelectItem value="EXPORT">Export</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 rows</SelectItem>
              <SelectItem value="50">50 rows</SelectItem>
              <SelectItem value="100">100 rows</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Time</TableHead>
                  <TableHead className="w-28">User</TableHead>
                  <TableHead className="w-24">Action</TableHead>
                  <TableHead className="w-32">Entity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="w-24">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && logs.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <EmptyState
                        title="No activity logs found"
                        className="border-0 bg-transparent py-8"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((record) => {
                    const detailStr =
                      typeof record.details === 'string'
                        ? record.details
                        : record.details
                          ? JSON.stringify(record.details)
                          : '';
                    return (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="text-xs tabular-nums">
                            {dayjs(record.created_at).format('MMM D, HH:mm')}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {dayjs(record.created_at).fromNow()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-sm">
                            <User className="size-3.5 text-muted-foreground" />
                            {record.username || record.user_id?.substring(0, 8) || 'System'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={actionBadgeClass[record.action] || ''}
                          >
                            {record.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            <FileText className="mr-1 size-3" />
                            {entityTypeLabels[record.entity_type] || record.entity_type}
                          </Badge>
                          {record.entity_id && (
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {record.entity_id.substring(0, 8)}…
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs">
                          {detailStr ? (
                            <span title={detailStr}>
                              {detailStr.substring(0, 50)}
                              {detailStr.length > 50 ? '…' : ''}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {record.ip_address || '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {hasMore && (
            <div className="mt-4 text-center">
              <Button variant="outline" onClick={handleLoadMore} disabled={loading}>
                Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
