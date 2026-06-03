'use client';

import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  LineChart as LineChartIcon,
  UsersRound,
  Heart,
  Trophy,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { WidgetErrorBoundary } from '@/components/ErrorBoundary';
import { api } from '@/lib/api';
import { personProgressCells } from '@/lib/progress-utils';
import type { MilestoneData, PersonApiData, GroupApiData } from '@/lib/types/api-responses';
import type { ProgressEntry } from '@/lib/types/api-responses';
import { StatCard } from '@/components/base/StatCard';
import { LoadingScreen } from '@/components/base/LoadingScreen';
import { EmptyState } from '@/components/base/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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

const DashboardCharts = dynamic(() => import('@/components/DashboardCharts'), { ssr: false });

const MilestoneBarChart = dynamic(
  () => import('./AnalyticsCharts').then((m) => m.MilestoneBarChart),
  { ssr: false }
);
const GenderPieChart = dynamic(
  () => import('./AnalyticsCharts').then((m) => m.GenderPieChart),
  { ssr: false }
);
const GroupBarChart = dynamic(
  () => import('./AnalyticsCharts').then((m) => m.GroupBarChart),
  { ssr: false }
);
const RegistrationsLineChart = dynamic(
  () => import('./AnalyticsCharts').then((m) => m.RegistrationsLineChart),
  { ssr: false }
);

interface MilestoneCompletion {
  milestone: string;
  fullName?: string;
  completed: number;
  total: number;
  percentage: number;
}

interface TopPerformer {
  name: string;
  completed: number;
  total: number;
}

interface AnalyticsData {
  totalConverts: number;
  convertsByMonth: { month: string; count: number }[];
  convertsByGroup: { group: string; count: number }[];
  milestoneCompletion: MilestoneCompletion[];
  attendanceByWeek: { week: string; count: number }[];
  topPerformers: TopPerformer[];
  genderDistribution: { gender: string; count: number }[];
  completionRate: number;
}

function sortByRegistrationMonth(
  entries: { month: string; count: number }[]
): { month: string; count: number }[] {
  return [...entries].sort((a, b) => {
    const da = new Date(a.month);
    const db = new Date(b.month);
    if (!Number.isNaN(da.getTime()) && !Number.isNaN(db.getTime())) {
      return da.getTime() - db.getTime();
    }
    return a.month.localeCompare(b.month);
  });
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [milestones, setMilestones] = useState<MilestoneData[]>([]);
  const [people, setPeople] = useState<PersonApiData[]>([]);
  const [groups, setGroups] = useState<GroupApiData[]>([]);

  useEffect(() => {
    if (user?.role === 'superadmin') {
      fetchAnalyticsData();
    }
  }, [user, year]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const groupsRes = await api.groups.list({ year });
      const yearGroups: GroupApiData[] = groupsRes.success
        ? ((groupsRes.data?.groups ?? groupsRes.data) as GroupApiData[]) || []
        : [];
      setGroups(yearGroups);

      const peopleRes = await api.people.list({ year, include: 'grid', limit: 500 });

      const filteredPeople: PersonApiData[] = peopleRes.success
        ? (peopleRes.data?.people ?? [])
        : [];
      const milestonesData: MilestoneData[] = peopleRes.success
        ? (peopleRes.data?.milestones ?? [])
        : [];
      const activeMilestones = milestonesData.filter((m) => m.is_active);
      const stageNumbers = activeMilestones.map((m) => m.stage_number);

      const peopleWithProgress: PersonApiData[] = filteredPeople.map((p) => ({
        ...p,
        progress: personProgressCells(p, stageNumbers) as ProgressEntry[],
      }));

      setPeople(peopleWithProgress);
      setMilestones(activeMilestones);

      processAnalytics(peopleWithProgress, milestonesData, yearGroups);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const processAnalytics = (
    people: PersonApiData[],
    milestones: MilestoneData[],
    _groups: GroupApiData[]
  ) => {
    const activeMilestones = milestones.filter((m) => m.is_active);
    const totalMilestones = activeMilestones.length;
    const stageNumbers = activeMilestones.map((m) => m.stage_number);

    const progressFor = (p: PersonApiData) =>
      p.progress?.length
        ? p.progress
        : personProgressCells(p, stageNumbers);

    const monthCounts: Record<string, number> = {};
    people.forEach((p) => {
      if (!p.created_at) return;
      const created = new Date(p.created_at);
      if (Number.isNaN(created.getTime())) return;
      const month = created.toLocaleString('default', {
        month: 'short',
        year: '2-digit',
      });
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    const convertsByMonth = sortByRegistrationMonth(
      Object.entries(monthCounts).map(([month, count]) => ({ month, count }))
    );

    const groupCounts: Record<string, number> = {};
    people.forEach((p) => {
      const group = p.group_name || 'Unknown';
      groupCounts[group] = (groupCounts[group] || 0) + 1;
    });
    const convertsByGroup = Object.entries(groupCounts)
      .map(([group, count]) => ({ group, count }))
      .sort((a, b) => b.count - a.count);

    const milestoneCompletion = activeMilestones.map((m) => {
      const completed = people.filter((p) =>
        progressFor(p).some((pr) => pr.stage_number === m.stage_number && pr.is_completed)
      ).length;
      return {
        milestone: `M${m.stage_number.toString().padStart(2, '0')}`,
        fullName: m.stage_name,
        completed,
        total: people.length,
        percentage: people.length > 0 ? Math.round((completed / people.length) * 100) : 0,
      };
    });

    const genderCounts: Record<string, number> = {};
    people.forEach((p) => {
      const gender = p.gender || 'Not specified';
      genderCounts[gender] = (genderCounts[gender] || 0) + 1;
    });
    const genderDistribution = Object.entries(genderCounts).map(([gender, count]) => ({
      gender,
      count,
    }));

    const topPerformers = people
      .map((p) => ({
        name: `${p.first_name} ${p.last_name}`,
        completed: progressFor(p).filter((pr) => pr.is_completed).length,
        total: totalMilestones,
      }))
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 10);

    const totalCompleted = people.reduce(
      (sum, p) => sum + progressFor(p).filter((pr) => pr.is_completed).length,
      0
    );
    const totalPossible = people.length * totalMilestones;
    const completionRate =
      totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

    setData({
      totalConverts: people.length,
      convertsByMonth,
      convertsByGroup,
      milestoneCompletion,
      attendanceByWeek: [],
      topPerformers,
      genderDistribution,
      completionRate,
    });
  };

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, []);

  if (loading) {
    return <LoadingScreen label="Loading analytics…" />;
  }

  if (!data) {
    return (
      <EmptyState
        title="No analytics data"
        description="Analytics data is not available for the selected year."
      />
    );
  }

  return (
    <div className="space-y-6 p-2 sm:p-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <LineChartIcon className="size-6 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">Analytics dashboard</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Comprehensive overview of convert progress and engagement
          </p>
        </div>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total converts"
          value={data.totalConverts}
          icon={Heart}
          accent="arrivals"
        />
        <StatCard
          title="Overall completion"
          value={`${data.completionRate}%`}
          icon={Trophy}
          accent="campaigns"
          deltaPositive={data.completionRate >= 50}
        />
        <StatCard
          title="Active groups"
          value={groups.filter((g) => g.year === year).length}
          icon={UsersRound}
          accent="churches"
        />
        <StatCard
          title="Milestones"
          value={milestones.length}
          icon={CheckCircle}
          accent="primary"
        />
      </div>

      <WidgetErrorBoundary>
        <DashboardCharts people={people} milestones={milestones} compact={false} />
      </WidgetErrorBoundary>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-medium">Milestone completion rates</CardTitle>
          </CardHeader>
          <CardContent>
            {data.milestoneCompletion.length > 0 ? (
              <MilestoneBarChart data={data.milestoneCompletion} />
            ) : (
              <EmptyState title="No milestone data" className="border-0 bg-transparent p-6" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Gender distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {data.genderDistribution.length > 0 ? (
              <GenderPieChart data={data.genderDistribution} />
            ) : (
              <EmptyState title="No gender data" className="border-0 bg-transparent p-6" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Converts by group</CardTitle>
          </CardHeader>
          <CardContent>
            {data.convertsByGroup.length > 0 ? (
              <GroupBarChart data={data.convertsByGroup.slice(0, 10)} />
            ) : (
              <EmptyState title="No group data" className="border-0 bg-transparent p-6" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Registrations over time</CardTitle>
          </CardHeader>
          <CardContent>
            {data.convertsByMonth.length > 0 ? (
              <RegistrationsLineChart data={data.convertsByMonth} />
            ) : (
              <EmptyState title="No registration data" className="border-0 bg-transparent p-6" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Top performers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topPerformers.map((record, index) => {
                  const pct =
                    record.total > 0
                      ? Math.round((record.completed / record.total) * 100)
                      : 0;
                  return (
                    <TableRow key={record.name}>
                      <TableCell>
                        <Badge variant={index < 3 ? 'default' : 'secondary'} className="tabular-nums">
                          {index + 1}
                        </Badge>
                      </TableCell>
                      <TableCell>{record.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-2 flex-1" />
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {record.completed}/{record.total}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Milestones needing attention</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Milestone</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Completion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...data.milestoneCompletion]
                  .sort((a, b) => a.percentage - b.percentage)
                  .slice(0, 5)
                  .map((record) => (
                    <TableRow key={record.milestone}>
                      <TableCell className="font-medium">{record.milestone}</TableCell>
                      <TableCell className="max-w-[140px] truncate">{record.fullName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={record.percentage}
                            className={`h-2 flex-1 ${
                              record.percentage < 30
                                ? '[&>div]:bg-destructive'
                                : record.percentage < 60
                                  ? '[&>div]:bg-amber-500'
                                  : ''
                            }`}
                          />
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {record.percentage}%
                          </span>
                        </div>
                      </TableCell>
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
