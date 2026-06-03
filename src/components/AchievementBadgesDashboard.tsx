'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Flame, Star, Crown, X } from 'lucide-react';
import { SynagoLoader } from '@/components/shell/SynagoLoader';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EmptyState } from '@/components/base/EmptyState';
import { cn } from '@/lib/utils';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

interface BadgeItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria: {
    type: 'milestone' | 'attendance' | 'consistency' | 'custom';
    value: number;
    description: string;
  };
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  points: number;
  createdAt: Date;
}

interface BadgeProgress {
  badge: BadgeItem;
  progress: number;
  earned: boolean;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  badgesEarned: number;
  lastBadgeEarned?: Date;
}

interface AchievementBadgesDashboardProps {
  groupId?: string;
  userId?: string;
  token?: string;
}

function getRarityColor(rarity: string) {
  switch (rarity) {
    case 'legendary':
      return '#FFD700';
    case 'rare':
      return '#9370DB';
    case 'uncommon':
      return '#4169E1';
    default:
      return '#A9A9A9';
  }
}

function ProgressRing({ value, color }: { value: number; color: string }) {
  const data = [
    { name: 'value', value: Math.round(value) },
    { name: 'rest', value: 100 - Math.round(value) },
  ];
  return (
    <ResponsiveContainer width={40} height={40}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          cx="50%"
          cy="50%"
          innerRadius={12}
          outerRadius={18}
          startAngle={90}
          endAngle={-270}
          stroke="none"
        >
          <Cell fill={color} />
          <Cell fill="hsl(var(--muted))" />
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

export function AchievementBadgesDashboard({
  groupId,
  userId,
}: AchievementBadgesDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [badgeProgress, setBadgeProgress] = useState<BadgeProgress[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    loadData();
  }, [userId, groupId]);

  const loadData = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const badgesRes = await fetch('/api/badges', {
        headers: { 'X-User-ID': userId },
      });

      if (!badgesRes.ok) throw new Error('Failed to load badges');
      const badgesData = await badgesRes.json();
      setBadges(badgesData.badges || []);

      const progressRes = await fetch(`/api/badges/${userId}?action=progress`, {
        headers: { 'X-User-ID': userId },
      });

      if (progressRes.ok) {
        const progressData = await progressRes.json();
        setBadgeProgress(progressData.progress || []);
      }

      const leaderboardRes = await fetch(
        `/api/badges/leaderboard?${groupId ? `groupId=${groupId}&` : ''}limit=20`,
        { headers: { 'X-User-ID': userId } }
      );

      if (leaderboardRes.ok) {
        const leaderboardData = await leaderboardRes.json();
        setLeaderboard(leaderboardData.leaderboard || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const earnedCount = badgeProgress.filter((b) => b.earned).length;

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <SynagoLoader size={32} />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 flex items-start justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <div>
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="progress">Badge Progress</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Trophy className="size-4 text-primary" />
                  <span className="text-sm">Badges Earned</span>
                </div>
                <p className="text-3xl font-semibold text-primary tabular-nums">{earnedCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Star className="size-4 text-warning" />
                  <span className="text-sm">Available Badges</span>
                </div>
                <p className="text-3xl font-semibold text-warning tabular-nums">{badges.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Flame className="size-4 text-destructive" />
                  <span className="text-sm">Completion</span>
                </div>
                <p className="text-3xl font-semibold text-destructive tabular-nums">
                  {badges.length ? ((earnedCount / badges.length) * 100).toFixed(0) : 0}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <span className="text-sm text-muted-foreground">Total Points</span>
                <p className="text-3xl font-semibold text-success tabular-nums">
                  {badgeProgress.filter((b) => b.earned).reduce((sum, b) => sum + b.badge.points, 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Badges</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {badgeProgress
                  .filter((b) => b.earned)
                  .map((b) => (
                    <Tooltip key={b.badge.id}>
                      <TooltipTrigger asChild>
                        <span className="cursor-pointer text-3xl transition-transform hover:scale-110">
                          {b.badge.icon}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {b.badge.name} — {b.badge.description} (+{b.badge.points} points)
                      </TooltipContent>
                    </Tooltip>
                  ))}
              </div>
              {earnedCount === 0 && (
                <EmptyState title="No badges earned yet" className="mt-4 border-0 bg-transparent py-6" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Badge</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Rarity</TableHead>
                <TableHead>Criteria</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {badgeProgress.map((record) => (
                <TableRow key={record.badge.id}>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center gap-2">
                          <span className="text-2xl">{record.badge.icon}</span>
                          {record.badge.name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{record.badge.description}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ProgressRing
                        value={record.progress}
                        color={
                          record.earned ? 'hsl(var(--success))' : getRarityColor(record.badge.rarity)
                        }
                      />
                      <span>{Math.round(record.progress)}%</span>
                      {record.earned && <Badge variant="success">Earned</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: getRarityColor(record.badge.rarity) }}
                      />
                      {record.badge.rarity.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell>{record.badge.criteria.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4">
          {leaderboard.length === 0 ? (
            <EmptyState title="No leaderboard data" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Badges Earned</TableHead>
                  <TableHead>Last Achievement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry) => {
                  const crownColor =
                    entry.rank === 1 ? '#FFD700' : entry.rank === 2 ? '#C0C0C0' : entry.rank === 3 ? '#CD7F32' : undefined;
                  return (
                    <TableRow key={entry.userId}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          {crownColor && <Crown className="size-4" style={{ color: crownColor }} />}
                          <strong>#{entry.rank}</strong>
                        </span>
                      </TableCell>
                      <TableCell>{entry.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          <Trophy className="size-3" /> {entry.badgesEarned} badges
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {entry.lastBadgeEarned
                          ? new Date(entry.lastBadgeEarned).toLocaleDateString()
                          : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
