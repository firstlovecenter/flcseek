'use client';

import { useMemo } from 'react';
import { CheckCircle2, XCircle, Users } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { PersonApiData, MilestoneData } from '@/lib/types/api-responses';

interface DashboardChartsProps {
  people: PersonApiData[];
  milestones: MilestoneData[];
  compact?: boolean;
}

function progressColor(percent: number) {
  if (percent >= 70) return 'text-success';
  if (percent >= 40) return 'text-warning';
  return 'text-destructive';
}

function progressIndicatorClass(percent: number) {
  if (percent >= 70) return '[&>div]:bg-success';
  if (percent >= 40) return '[&>div]:bg-warning';
  return '[&>div]:bg-destructive';
}

function MilestoneRing({ percent, size = 50 }: { percent: number; size?: number }) {
  const data = [
    { name: 'done', value: percent },
    { name: 'remaining', value: 100 - percent },
  ];
  const fill =
    percent >= 70 ? 'hsl(var(--success))' : percent >= 40 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))';

  return (
    <ResponsiveContainer width={size} height={size}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          cx="50%"
          cy="50%"
          innerRadius={size * 0.32}
          outerRadius={size * 0.45}
          startAngle={90}
          endAngle={-270}
          stroke="none"
        >
          <Cell fill={fill} />
          <Cell fill="hsl(var(--muted))" />
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

export default function DashboardCharts({ people, milestones, compact = true }: DashboardChartsProps) {
  const milestoneStats = useMemo(() => {
    if (!milestones.length || !people.length) return [];

    return milestones.map((milestone) => {
      const completedCount = people.filter((person) =>
        (person.progress ?? []).some(
          (p) => p.stage_number === milestone.stage_number && p.is_completed
        )
      ).length;

      return {
        milestone: milestone.stage_number,
        name: milestone.short_name || milestone.stage_name,
        fullName: milestone.stage_name,
        completed: completedCount,
        incomplete: people.length - completedCount,
        percentage: Math.round((completedCount / people.length) * 100),
      };
    });
  }, [people, milestones]);

  const milestonesNeedingAttention = useMemo(() => {
    return [...milestoneStats].sort((a, b) => a.percentage - b.percentage).slice(0, 5);
  }, [milestoneStats]);

  const personCompletionStats = useMemo(() => {
    if (!people.length || !milestones.length) return { full: 0, partial: 0, none: 0 };

    const totalMilestones = milestones.length;
    let fullCompletion = 0;
    let partialCompletion = 0;
    let noCompletion = 0;

    people.forEach((person) => {
      const completedCount = (person.progress ?? []).filter((p) => p.is_completed).length;
      if (completedCount === totalMilestones) {
        fullCompletion++;
      } else if (completedCount > 0) {
        partialCompletion++;
      } else {
        noCompletion++;
      }
    });

    return { full: fullCompletion, partial: partialCompletion, none: noCompletion };
  }, [people, milestones]);

  if (!milestones.length || !people.length) {
    return null;
  }

  if (compact) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" />
            Milestone Progress Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="py-2 text-center">
              <div className="text-2xl font-bold text-success">{personCompletionStats.full}</div>
              <span className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                <CheckCircle2 className="size-3" /> Complete
              </span>
            </div>
            <div className="py-2 text-center">
              <div className="text-2xl font-bold text-warning">{personCompletionStats.partial}</div>
              <span className="text-[11px] text-muted-foreground">In Progress</span>
            </div>
            <div className="py-2 text-center">
              <div className="text-2xl font-bold text-destructive">{personCompletionStats.none}</div>
              <span className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                <XCircle className="size-3" /> Not Started
              </span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold">Milestones Needing Attention:</p>
            {milestonesNeedingAttention.map((stat) => (
              <div key={stat.milestone} className="mb-1.5" title={stat.fullName}>
                <div className="mb-0.5 flex justify-between text-[11px]">
                  <span className="max-w-[70%] truncate">
                    M{stat.milestone.toString().padStart(2, '0')}: {stat.name.split('\n')[0]}
                  </span>
                  <span className="text-muted-foreground">
                    {stat.completed}/{people.length}
                  </span>
                </div>
                <Progress
                  value={stat.percentage}
                  className={cn('h-1.5', progressIndicatorClass(stat.percentage))}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mb-6 space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Users className="size-5" />
        Progress Analytics
      </h2>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Fully Completed', count: personCompletionStats.full, color: 'text-success', indicator: '[&>div]:bg-success' },
          { label: 'In Progress', count: personCompletionStats.partial, color: 'text-warning', indicator: '[&>div]:bg-warning' },
          { label: 'Not Started', count: personCompletionStats.none, color: 'text-destructive', indicator: '[&>div]:bg-destructive' },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-6 text-center">
              <div className={cn('text-5xl font-bold', item.color)}>{item.count}</div>
              <p className="mt-1">{item.label}</p>
              <Progress
                value={Math.round((item.count / people.length) * 100)}
                className={cn('mt-3', item.indicator)}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Milestone Completion Rates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {milestoneStats.map((stat) => (
              <div
                key={stat.milestone}
                className="rounded-md border border-border p-2 text-center"
                title={stat.fullName}
              >
                <span className="block text-[11px] font-semibold">
                  M{stat.milestone.toString().padStart(2, '0')}
                </span>
                <div className="relative mx-auto my-1 flex size-[50px] items-center justify-center">
                  <MilestoneRing percent={stat.percentage} size={50} />
                  <span className={cn('absolute text-[10px] font-medium', progressColor(stat.percentage))}>
                    {stat.percentage}%
                  </span>
                </div>
                <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                  {stat.name.split('\n')[0]}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
