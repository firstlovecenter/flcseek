'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Bot,
  AlertCircle,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/base/EmptyState';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface Milestone {
  id: string;
  stageNumber: number;
  stageName?: string;
  shortName?: string;
  description?: string;
  isAutoCalculated?: boolean;
}

interface ProgressRecord {
  id: string;
  stageNumber: number;
  stageName: string;
  isCompleted: boolean;
  dateCompleted?: string;
}

interface MilestoneProgressProps {
  convertId: string;
  progressRecords: ProgressRecord[];
  milestones: Milestone[];
  onMilestoneUpdate?: () => void;
}

export function MilestoneProgress({
  convertId,
  progressRecords,
  milestones,
  onMilestoneUpdate,
}: MilestoneProgressProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const completedCount = progressRecords.filter((p) => p.isCompleted).length;
  const totalMilestones = milestones.length;
  const progressPercent = Math.round((completedCount / totalMilestones) * 100);

  const handleAutoUpdate = async () => {
    setIsUpdating(true);
    setUpdateError(null);

    try {
      const response = await fetch('/api/milestones/auto-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'current-user-id',
        },
        body: JSON.stringify({ convertId }),
      });

      if (!response.ok) {
        const error = await response.json();
        setUpdateError(error.error || 'Failed to update milestones');
      } else {
        const data = await response.json();
        if (data.totalNewMilestones > 0) {
          onMilestoneUpdate?.();
        }
      }
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Milestone Progress</h3>
            <span className="text-2xl font-bold text-primary">
              {completedCount}/{totalMilestones}
            </span>
          </div>

          <Progress value={progressPercent} className="h-2" />

          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{completedCount} completed</span>
            <span>{totalMilestones - completedCount} remaining</span>
          </div>

          {updateError && (
            <div className="flex items-start justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {updateError}
              </div>
              <button type="button" onClick={() => setUpdateError(null)} aria-label="Dismiss">
                <X className="size-4" />
              </button>
            </div>
          )}

          <Button size="sm" onClick={handleAutoUpdate} disabled={isUpdating}>
            <Bot className="size-4" />
            {isUpdating ? 'Checking…' : 'Check Auto-Milestones'}
          </Button>
        </CardContent>
      </Card>

      {totalMilestones > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detailed Milestones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {milestones.map((milestone) => {
              const progress = progressRecords.find((p) => p.stageNumber === milestone.stageNumber);
              const isCompleted = progress?.isCompleted || false;
              const completionDate = progress?.dateCompleted;

              return (
                <div
                  key={milestone.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3',
                    isCompleted
                      ? 'border-success/30 bg-success/5'
                      : 'border-border bg-muted/30'
                  )}
                >
                  <div className="shrink-0">
                    {isCompleted ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <CheckCircle2 className="size-5 text-success" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Completed {dayjs(completionDate).format('MMM DD, YYYY')}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Clock className="size-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {milestone.stageNumber}.{' '}
                        {milestone.stageName || `Milestone ${milestone.stageNumber}`}
                      </span>

                      {milestone.isAutoCalculated && (
                        <Badge variant="secondary" className="text-[0.75rem]">
                          <Bot className="size-3" /> Auto
                        </Badge>
                      )}

                      {isCompleted && (
                        <Badge variant="success" className="text-[0.75rem]">
                          Complete
                        </Badge>
                      )}
                    </div>

                    {milestone.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{milestone.description}</p>
                    )}

                    {completionDate && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Completed {dayjs(completionDate).fromNow()}
                      </p>
                    )}
                  </div>

                  <div
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      isCompleted
                        ? 'bg-success text-success-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {milestone.stageNumber}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <EmptyState title="No milestones found" />
      )}

      {milestones.some((m) => m.isAutoCalculated) && (
        <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <Bot className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="font-medium">Auto-Milestone Feature Enabled</p>
            <p className="mt-1 text-muted-foreground">
              Some milestones have automatic completion enabled based on attendance and time
              criteria. Use the &apos;Check Auto-Milestones&apos; button to evaluate eligibility.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
