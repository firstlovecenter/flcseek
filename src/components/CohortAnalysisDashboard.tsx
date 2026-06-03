'use client';

import React, { useEffect, useState } from 'react';
import { SynagoLoader } from '@/components/shell/SynagoLoader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
import { cn } from '@/lib/utils';

interface CohortRow {
  key: string;
  label: string;
  size: number;
  retention30: number;
  retention60: number;
  retention90: number;
  completionRate: number;
  avgMilestones: number;
}

interface CohortApiRow {
  cohortKey: string;
  label: string;
  size: number;
  retention30: number;
  retention60: number;
  retention90: number;
  completionRate: number;
  avgMilestones: number;
}

interface CohortAnalysisDashboardProps {
  groupId?: string;
  months?: number;
  userId: string;
  token?: string;
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { label: React.ReactNode; value: T }[];
}) {
  return (
    <div className="inline-flex rounded-lg border p-1">
      {options.map((opt) => (
        <Button
          key={opt.value}
          variant={value === opt.value ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

export function CohortAnalysisDashboard({
  groupId,
  months = 6,
  userId,
  token,
}: CohortAnalysisDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'compare'>('table');
  const [rows, setRows] = useState<CohortRow[]>([]);
  const [summary, setSummary] = useState<{
    bestRetention30?: { label: string; retention30: number };
    bestCompletion?: { label: string; completionRate: number };
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/cohorts/compare?months=${months}${groupId ? `&groupId=${groupId}` : ''}`,
          {
            credentials: 'include',
            headers: {
              'x-user-id': userId,
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setRows(
            ((data.cohorts as CohortApiRow[]) || []).map((c) => ({
              key: c.cohortKey,
              label: c.label,
              size: c.size,
              retention30: c.retention30,
              retention60: c.retention60,
              retention90: c.retention90,
              completionRate: c.completionRate,
              avgMilestones: c.avgMilestones,
            }))
          );
          setSummary(data.summary);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [groupId, months, userId, token]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-10">
          <SynagoLoader size={40} />
          <p className="mt-2 text-sm text-muted-foreground">Loading cohort analytics...</p>
        </CardContent>
      </Card>
    );
  }

  if (!rows.length) {
    return <EmptyState title="No cohort data available" />;
  }

  const completionVariant = (value: number) => {
    if (value > 50) return 'success' as const;
    if (value > 25) return 'warning' as const;
    return 'destructive' as const;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Cohort Analysis</h3>
        <SegmentedControl
          value={view}
          onChange={(v) => setView(v)}
          options={[
            { label: 'Table', value: 'table' },
            { label: 'Highlights', value: 'compare' },
          ]}
        />
      </div>

      {view === 'table' ? (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cohort</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Retention 30d</TableHead>
                  <TableHead>Retention 60d</TableHead>
                  <TableHead>Retention 90d</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead>Avg Milestones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell>{row.size}</TableCell>
                    <TableCell>
                      <Progress value={row.retention30} className="h-1.5 [&>div]:bg-success" />
                    </TableCell>
                    <TableCell>
                      <Progress value={row.retention60} className="h-1.5 [&>div]:bg-warning" />
                    </TableCell>
                    <TableCell>
                      <Progress value={row.retention90} className="h-1.5 [&>div]:bg-destructive" />
                    </TableCell>
                    <TableCell>
                      <Badge variant={completionVariant(row.completionRate)}>
                        {row.completionRate}%
                      </Badge>
                    </TableCell>
                    <TableCell>{row.avgMilestones}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Best 30-day Retention</CardTitle>
            </CardHeader>
            <CardContent>
              {summary?.bestRetention30 ? (
                <div>
                  <p className="text-sm text-muted-foreground">{summary.bestRetention30.label}</p>
                  <p className="text-3xl font-semibold tabular-nums">
                    {summary.bestRetention30.retention30}%
                    <span className="ml-2 text-base font-normal text-muted-foreground">Retention</span>
                  </p>
                </div>
              ) : (
                <EmptyState title="No data" className="border-0 bg-transparent py-6" />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Best Completion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              {summary?.bestCompletion ? (
                <div>
                  <p className="text-sm text-muted-foreground">{summary.bestCompletion.label}</p>
                  <p className="text-3xl font-semibold tabular-nums">
                    {summary.bestCompletion.completionRate}%
                    <span className="ml-2 text-base font-normal text-muted-foreground">Completion</span>
                  </p>
                </div>
              ) : (
                <EmptyState title="No data" className="border-0 bg-transparent py-6" />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
