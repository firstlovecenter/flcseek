'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';
import { SynagoLoader } from '@/components/shell/SynagoLoader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/base/EmptyState';
import { useConfirm } from '@/hooks/use-confirm';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface ConvertAlert {
  id: string;
  convertId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  convert?: {
    id: string;
    firstName?: string;
    lastName?: string;
    riskScore?: number;
  };
  alertRule?: {
    id: string;
    name: string;
    type: string;
  };
}

interface AlertDashboardProps {
  groupId: string;
  onRefresh?: () => void;
}

const severityVariants: Record<string, 'secondary' | 'warning' | 'destructive'> = {
  low: 'secondary',
  medium: 'warning',
  high: 'destructive',
  critical: 'destructive',
};

const statusVariants: Record<string, 'destructive' | 'warning' | 'success'> = {
  active: 'destructive',
  acknowledged: 'warning',
  resolved: 'success',
};

export function AlertDashboard({ groupId, onRefresh }: AlertDashboardProps) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [alerts, setAlerts] = useState<ConvertAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeOnly, setActiveOnly] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/alerts?groupId=${groupId}&status=${activeOnly ? 'active' : ''}`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
        setPage(0);
      } else {
        toast.error('Failed to load alerts. Please try again.');
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
      toast.error('Network error loading alerts.');
    } finally {
      setLoading(false);
    }
  }, [groupId, activeOnly]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/acknowledge`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Acknowledged by leader' }),
      });

      if (response.ok) {
        loadAlerts();
        onRefresh?.();
      } else {
        toast.error('Failed to acknowledge alert.');
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      toast.error('Network error. Please try again.');
    }
  };

  const handleResolve = async (alertId: string) => {
    const ok = await confirm({
      title: 'Resolve Alert',
      description: 'Are you sure you want to mark this alert as resolved?',
      confirmLabel: 'Resolve',
      destructive: true,
    });
    if (!ok) return;

    try {
      const response = await fetch(`/api/alerts/${alertId}/resolve`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Resolved by leader' }),
      });

      if (response.ok) {
        loadAlerts();
        onRefresh?.();
      } else {
        toast.error('Failed to resolve alert.');
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error('Network error. Please try again.');
    }
  };

  const riskScoreColor = (score: number) => {
    if (score > 75) return 'bg-destructive';
    if (score > 50) return 'bg-warning';
    return 'bg-primary';
  };

  const totalPages = Math.max(1, Math.ceil(alerts.length / pageSize));
  const pageAlerts = alerts.slice(page * pageSize, (page + 1) * pageSize);
  const activeCount = alerts.filter((a) => a.status === 'active').length;

  return (
    <>
      {ConfirmDialog}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Alerts & Risk Management</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => loadAlerts()} disabled={loading}>
              {loading && <SynagoLoader size={16} inline />}
              Refresh
            </Button>
            <Button variant={activeOnly ? 'default' : 'outline'} onClick={() => setActiveOnly(!activeOnly)}>
              {activeOnly ? 'All' : 'Active Only'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && alerts.length === 0 ? (
            <div className="flex justify-center py-12">
              <SynagoLoader size={32} />
            </div>
          ) : alerts.length === 0 ? (
            <EmptyState
              title={activeOnly ? 'No active alerts' : 'No alerts'}
              className="py-12"
            />
          ) : (
            <div className="space-y-4">
              <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm">
                <AlertTriangle className="size-4 shrink-0 text-warning" />
                <div>
                  <p className="font-medium">{activeCount} Active Alerts</p>
                  <p className="text-muted-foreground">{alerts.length} total alerts for this group</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Convert</TableHead>
                    <TableHead>Alert Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageAlerts.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="font-semibold">
                          {record.convert?.firstName} {record.convert?.lastName}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          Risk Score:
                          <Badge className={cn('text-white', riskScoreColor(record.convert?.riskScore || 0))}>
                            {record.convert?.riskScore || 0}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{record.alertRule?.name}</div>
                        <div className="text-xs text-muted-foreground">{record.alertRule?.type}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={severityVariants[record.severity]} className="gap-1">
                          <AlertTriangle className="size-3" />
                          {record.severity.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariants[record.status]}>
                          {record.status.toUpperCase()}
                        </Badge>
                        {record.status === 'acknowledged' && record.acknowledgedAt && (
                          <div className="text-xs text-muted-foreground">
                            {dayjs(record.acknowledgedAt).fromNow()}
                          </div>
                        )}
                        {record.status === 'resolved' && record.resolvedAt && (
                          <div className="text-xs text-muted-foreground">
                            {dayjs(record.resolvedAt).fromNow()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{dayjs(record.createdAt).fromNow()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {record.status === 'active' && (
                            <Button size="sm" onClick={() => handleAcknowledge(record.id)}>
                              <Check className="size-3.5" />
                              Acknowledge
                            </Button>
                          )}
                          {record.status !== 'resolved' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleResolve(record.id)}
                            >
                              <X className="size-3.5" />
                              Resolve
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {alerts.length > pageSize && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Total {alerts.length} alerts</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
