'use client';

import React, { useEffect, useState } from 'react';
import { LineChart, TrendingUp, TrendingDown } from 'lucide-react';
import { SynagoLoader } from '@/components/shell/SynagoLoader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/base/EmptyState';
import { LineChart as ReLineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';

interface GrowthForecastDashboardProps {
  groupId?: string;
  userId: string;
  token?: string;
}

interface ForecastApiResponse {
  success: boolean;
  forecast: {
    groupId?: string;
    weeksAnalyzed: number;
    history: { weekStart: string; attendanceCount: number; milestoneCompletions: number }[];
    forecast: { weekStart: string; attendanceForecast: number; milestoneForecast: number }[];
    trend: {
      attendanceSlope: number;
      milestoneSlope: number;
      attendanceDirection: 'up' | 'flat' | 'down';
      milestoneDirection: 'up' | 'flat' | 'down';
    };
  };
}

function DirectionTag({ dir }: { dir: 'up' | 'flat' | 'down' }) {
  const Icon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : LineChart;
  const variant = dir === 'up' ? 'success' : dir === 'down' ? 'destructive' : 'secondary';
  return (
    <Badge variant={variant as 'success' | 'destructive' | 'secondary'} className="gap-1">
      <Icon className="size-3" />
      {dir.toUpperCase()}
    </Badge>
  );
}

export function GrowthForecastDashboard({ groupId, userId, token }: GrowthForecastDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ForecastApiResponse['forecast'] | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/forecast${groupId ? `?groupId=${groupId}` : ''}`, {
          credentials: 'include',
          headers: {
            'x-user-id': userId,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const json = await res.json();
        if (json.success) {
          setData(json.forecast);
        }
      } catch (error) {
        console.error('Failed to load forecast', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [groupId, userId, token]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-10">
          <SynagoLoader size={40} />
          <p className="mt-2 text-sm text-muted-foreground">Generating forecasts...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return <EmptyState title="No forecast data available" />;
  }

  const historyRows = data.history.map((h) => ({
    key: h.weekStart,
    week: dayjs(h.weekStart).format('MMM D'),
    attendance: h.attendanceCount,
    milestones: h.milestoneCompletions,
  }));

  const forecastRows = data.forecast.map((f) => ({
    key: f.weekStart,
    week: dayjs(f.weekStart).format('MMM D'),
    attendance: f.attendanceForecast,
    milestones: f.milestoneForecast,
  }));

  const chartData = [
    ...data.history.map((h) => ({
      week: dayjs(h.weekStart).format('MMM D'),
      attendance: h.attendanceCount,
      type: 'history' as const,
    })),
    ...data.forecast.map((f) => ({
      week: dayjs(f.weekStart).format('MMM D'),
      attendance: f.attendanceForecast,
      type: 'forecast' as const,
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Attendance Trend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <DirectionTag dir={data.trend.attendanceDirection} />
              <span className="text-sm text-muted-foreground">Slope</span>
              <span className="font-semibold tabular-nums">{data.trend.attendanceSlope.toFixed(2)}</span>
            </div>
            <Progress
              value={Math.min(Math.max(data.trend.attendanceSlope * 10 + 50, 0), 100)}
              className="h-1.5"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Milestone Trend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <DirectionTag dir={data.trend.milestoneDirection} />
              <span className="text-sm text-muted-foreground">Slope</span>
              <span className="font-semibold tabular-nums">{data.trend.milestoneSlope.toFixed(2)}</span>
            </div>
            <Progress
              value={Math.min(Math.max(data.trend.milestoneSlope * 10 + 50, 0), 100)}
              className="h-1.5 [&>div]:bg-success"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Attendance Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <ReLineChart data={chartData}>
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="attendance" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </ReLineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">History (last weeks)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Milestones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>{row.week}</TableCell>
                    <TableCell>{row.attendance}</TableCell>
                    <TableCell>{row.milestones}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Forecast (next weeks)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead>Attendance (forecast)</TableHead>
                  <TableHead>Milestones (forecast)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecastRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>{row.week}</TableCell>
                    <TableCell>{row.attendance}</TableCell>
                    <TableCell>{row.milestones}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
