'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Users, ArrowUp, AlertCircle, CheckCircle2 } from 'lucide-react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EmptyState } from '@/components/base/EmptyState';
import { cn } from '@/lib/utils';
import type { Prediction } from '@/lib/predictive-analytics';
import dayjs from 'dayjs';

interface PredictiveAnalyticsDashboardProps {
  groupId: string;
  userId: string;
  token?: string;
}

interface GroupOutcomes {
  totalConverts: number;
  predictionsGenerated: number;
  averageCompletion: number;
  averageDropoutRisk: number;
  highRisk: number;
  onTrack: number;
  predictions: Prediction[];
}

// Lightweight CSS ring (conic-gradient) instead of a per-row Recharts PieChart.
// Rendering one SVG chart per table row was a significant DOM/render cost; this
// is a single styled div with no chart runtime.
function CircleGauge({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className="relative size-10 rounded-full"
      role="img"
      aria-label={`${pct}%`}
      style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, hsl(var(--muted)) 0deg)` }}
    >
      <div className="absolute inset-[3px] rounded-full bg-background" />
    </div>
  );
}

function getPredictionColor(probability: number) {
  if (probability > 75) return 'hsl(var(--success))';
  if (probability > 50) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
}

function getRiskColor(risk: number) {
  if (risk < 30) return 'hsl(var(--success))';
  if (risk < 60) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  block,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { label: React.ReactNode; value: T }[];
  block?: boolean;
}) {
  return (
    <div className={cn('inline-flex rounded-lg border p-1', block && 'flex w-full')}>
      {options.map((opt) => (
        <Button
          key={opt.value}
          variant={value === opt.value ? 'default' : 'ghost'}
          size="sm"
          className={block ? 'flex-1' : undefined}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

function PaginatedTable({
  data,
  pageSize = 10,
  children,
}: {
  data: Prediction[];
  pageSize?: number;
  children: (pageData: Prediction[]) => React.ReactNode;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const pageData = useMemo(
    () => data.slice(page * pageSize, (page + 1) * pageSize),
    [data, page, pageSize]
  );

  return (
    <div>
      {children(pageData)}
      {data.length > pageSize && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page + 1} of {totalPages} ({data.length} total)
          </span>
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
  );
}

function PredictionsTable({
  data,
  onViewDetails,
}: {
  data: Prediction[];
  onViewDetails: (id: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Convert</TableHead>
          <TableHead>Completion</TableHead>
          <TableHead>Dropout Risk</TableHead>
          <TableHead>Confidence</TableHead>
          <TableHead>Est. Completion</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((record) => (
          <TableRow key={record.convertId}>
            <TableCell>
              <div className="font-medium">{record.convertName || record.convertId}</div>
              <div className="max-w-[140px] truncate text-xs text-muted-foreground">
                {record.recommendation.substring(0, 30)}...
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <CircleGauge value={record.completionProbability} color={getPredictionColor(record.completionProbability)} />
                <span>{Math.round(record.completionProbability)}%</span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <CircleGauge value={record.dropoutRisk} color={getRiskColor(100 - record.dropoutRisk)} />
                <span>{Math.round(record.dropoutRisk)}%</span>
              </div>
            </TableCell>
            <TableCell>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant={
                      record.confidence > 80
                        ? 'success'
                        : record.confidence > 60
                          ? 'warning'
                          : 'destructive'
                    }
                  >
                    {record.confidence}% confident
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Confidence based on available data points</TooltipContent>
              </Tooltip>
            </TableCell>
            <TableCell>
              {record.estimatedCompletionDate ? (
                dayjs(record.estimatedCompletionDate).format('MMM D, YYYY')
              ) : (
                <span className="text-muted-foreground">N/A</span>
              )}
            </TableCell>
            <TableCell>
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onViewDetails(record.convertId)}>
                View Details
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function PredictiveAnalyticsDashboard({ groupId, userId, token }: PredictiveAnalyticsDashboardProps) {
  const router = useRouter();
  const [outcomes, setOutcomes] = useState<GroupOutcomes | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'overview' | 'byCategory'>('overview');
  const [category, setCategory] = useState<'onTrack' | 'atRisk' | 'highRisk'>('onTrack');

  useEffect(() => {
    const fetchOutcomes = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/predictions?groupId=${groupId}`, {
          credentials: 'include',
          headers: {
            'x-user-id': userId,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (response.ok) {
          const data = await response.json();
          setOutcomes(data.outcomes);
        }
      } catch (error) {
        console.error('Failed to fetch predictions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOutcomes();
  }, [groupId, userId, token]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-10">
          <SynagoLoader size={48} label="Generating predictions…" />
        </CardContent>
      </Card>
    );
  }

  if (!outcomes) {
    return <EmptyState title="Unable to load predictions" />;
  }

  const handleViewDetails = (convertId: string) => {
    router.push(`/${groupId}/person/${convertId}`);
  };

  const filteredPredictions =
    category === 'onTrack'
      ? outcomes.predictions.filter((p) => p.completionProbability > 75)
      : category === 'atRisk'
        ? outcomes.predictions.filter(
            (p) => p.completionProbability > 50 && p.completionProbability <= 75
          )
        : outcomes.predictions.filter((p) => p.completionProbability <= 50);

  const overallStats = [
    { title: 'Total Converts', value: outcomes.totalConverts, icon: Users },
    {
      title: 'With Predictions',
      value: outcomes.predictionsGenerated,
      subtitle: `${((outcomes.predictionsGenerated / outcomes.totalConverts) * 100).toFixed(1)}%`,
    },
    {
      title: 'Avg. Completion',
      value: `${Math.round(outcomes.averageCompletion)}%`,
      colorClass: outcomes.averageCompletion > 75 ? 'text-success' : outcomes.averageCompletion > 50 ? 'text-warning' : 'text-destructive',
    },
    {
      title: 'Avg. Dropout Risk',
      value: `${Math.round(outcomes.averageDropoutRisk)}%`,
      colorClass: outcomes.averageDropoutRisk < 30 ? 'text-success' : outcomes.averageDropoutRisk < 60 ? 'text-warning' : 'text-destructive',
    },
    {
      title: 'On Track',
      value: outcomes.onTrack,
      colorClass: 'text-success',
      suffix: outcomes.onTrack > 0 ? ArrowUp : undefined,
    },
    {
      title: 'High Risk',
      value: outcomes.highRisk,
      colorClass: 'text-destructive',
      suffix: outcomes.highRisk > 0 ? AlertCircle : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-4 text-lg font-semibold">Prediction Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {overallStats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="pt-6 text-center">
                {stat.icon && <stat.icon className="mx-auto mb-2 size-6 text-muted-foreground" />}
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className={cn('flex items-center justify-center gap-1 text-2xl font-semibold tabular-nums', stat.colorClass)}>
                  {stat.value}
                  {stat.suffix && <stat.suffix className="size-4" />}
                </p>
                {stat.subtitle && <p className="text-sm text-muted-foreground">{stat.subtitle}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Detailed Predictions</CardTitle>
          <SegmentedControl
            value={view}
            onChange={(v) => setView(v)}
            options={[
              { label: 'Overview', value: 'overview' },
              { label: 'By Category', value: 'byCategory' },
            ]}
          />
        </CardHeader>
        <CardContent>
          {view === 'overview' ? (
            <PaginatedTable data={outcomes.predictions}>
              {(pageData) => (
                <PredictionsTable data={pageData} onViewDetails={handleViewDetails} />
              )}
            </PaginatedTable>
          ) : (
            <div className="space-y-4">
              <SegmentedControl
                block
                value={category}
                onChange={(v) => setCategory(v)}
                options={[
                  {
                    label: (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" />
                        On Track ({outcomes.onTrack})
                      </span>
                    ),
                    value: 'onTrack',
                  },
                  {
                    label: (
                      <span className="flex items-center gap-1">
                        <AlertCircle className="size-3.5" />
                        At Risk ({outcomes.predictions.length - outcomes.onTrack - outcomes.highRisk})
                      </span>
                    ),
                    value: 'atRisk',
                  },
                  {
                    label: (
                      <span className="flex items-center gap-1">
                        <AlertCircle className="size-3.5" />
                        High Risk ({outcomes.highRisk})
                      </span>
                    ),
                    value: 'highRisk',
                  },
                ]}
              />
              <PaginatedTable data={filteredPredictions}>
                {(pageData) => (
                  <PredictionsTable data={pageData} onViewDetails={handleViewDetails} />
                )}
              </PaginatedTable>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Key Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Average Completion Probability:</strong> {Math.round(outcomes.averageCompletion)}%
            {outcomes.averageCompletion > 70
              ? ' - Group is on track overall'
              : outcomes.averageCompletion > 50
                ? ' - Group needs attention'
                : ' - Group requires intervention'}
          </p>
          <p>
            <strong>High Risk Converts:</strong> {outcomes.highRisk} out of {outcomes.predictionsGenerated} (
            {((outcomes.highRisk / outcomes.predictionsGenerated) * 100).toFixed(1)}%) require immediate
            follow-up
          </p>
          <p>
            <strong>Strong Performers:</strong> {outcomes.onTrack} converts (
            {((outcomes.onTrack / outcomes.predictionsGenerated) * 100).toFixed(1)}%) are progressing well
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
