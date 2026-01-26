import { prisma } from './prisma';
import { logger } from './logger';
import dayjs from 'dayjs';

export interface CohortMetrics {
  cohortKey: string; // e.g., 2025-01
  label: string;
  startDate: Date;
  endDate: Date;
  size: number;
  retention30: number;
  retention60: number;
  retention90: number;
  completionRate: number;
  avgMilestones: number;
}

export class CohortAnalysisService {
  /**
   * Build cohorts by convert creation month and compute retention/metrics
   */
  static async buildCohortsByMonth(params: { months?: number; groupId?: string }) {
    const { months = 6, groupId } = params;
    const startWindow = dayjs().subtract(months, 'month').startOf('month').toDate();

    const converts = await prisma.newConvert.findMany({
      where: {
        createdAt: { gte: startWindow },
        deletedAt: null,
        ...(groupId ? { groupId } : {}),
      },
      select: {
        id: true,
        createdAt: true,
        attendanceRecords: {
          select: {
            attendanceDate: true,
          },
          orderBy: { attendanceDate: 'asc' },
        },
        progressRecords: {
          select: {
            isCompleted: true,
            dateCompleted: true,
            stageNumber: true,
          },
        },
      },
    });

    const cohortsMap = new Map<string, CohortMetrics>();

    for (const convert of converts) {
      const createdAt = convert.createdAt || new Date();
      const cohortKey = dayjs(createdAt).format('YYYY-MM');
      const monthStart = dayjs(createdAt).startOf('month').toDate();
      const monthEnd = dayjs(createdAt).endOf('month').toDate();

      if (!cohortsMap.has(cohortKey)) {
        cohortsMap.set(cohortKey, {
          cohortKey,
          label: dayjs(createdAt).format('MMMM YYYY'),
          startDate: monthStart,
          endDate: monthEnd,
          size: 0,
          retention30: 0,
          retention60: 0,
          retention90: 0,
          completionRate: 0,
          avgMilestones: 0,
        });
      }

      const cohort = cohortsMap.get(cohortKey)!;
      cohort.size += 1;

      // Retention windows
      const d30 = dayjs(createdAt).add(30, 'day').toDate();
      const d60 = dayjs(createdAt).add(60, 'day').toDate();
      const d90 = dayjs(createdAt).add(90, 'day').toDate();

      const attended30 = convert.attendanceRecords.some((a) => a.attendanceDate >= d30);
      const attended60 = convert.attendanceRecords.some((a) => a.attendanceDate >= d60);
      const attended90 = convert.attendanceRecords.some((a) => a.attendanceDate >= d90);

      if (attended30) cohort.retention30 += 1;
      if (attended60) cohort.retention60 += 1;
      if (attended90) cohort.retention90 += 1;

      const completedCount = convert.progressRecords.filter((p) => p.isCompleted || p.dateCompleted).length;
      cohort.avgMilestones += completedCount;

      // completion if completed 7 milestones
      if (completedCount >= 7) {
        cohort.completionRate += 1;
      }
    }

    // finalize percentages
    const cohorts: CohortMetrics[] = [];
    cohortsMap.forEach((c) => {
      const size = c.size || 1;
      cohorts.push({
        ...c,
        retention30: Math.round((c.retention30 / size) * 1000) / 10,
        retention60: Math.round((c.retention60 / size) * 1000) / 10,
        retention90: Math.round((c.retention90 / size) * 1000) / 10,
        completionRate: Math.round((c.completionRate / size) * 1000) / 10,
        avgMilestones: Math.round((c.avgMilestones / size) * 10) / 10,
      });
    });

    // sort by date ascending
    cohorts.sort((a, b) => (a.startDate.getTime() - b.startDate.getTime()));
    return cohorts;
  }

  /**
   * Compare cohorts by metrics and return summary
   */
  static async compareCohorts(params: { months?: number; groupId?: string }) {
    const cohorts = await this.buildCohortsByMonth(params);
    if (cohorts.length === 0) return { cohorts, summary: null };

    const summary = {
      bestRetention30: cohorts.reduce((best, c) => (c.retention30 > best.retention30 ? c : best), cohorts[0]),
      bestCompletion: cohorts.reduce((best, c) => (c.completionRate > best.completionRate ? c : best), cohorts[0]),
      trendRetention30: cohorts.map((c) => ({ key: c.cohortKey, value: c.retention30 })),
      trendCompletion: cohorts.map((c) => ({ key: c.cohortKey, value: c.completionRate })),
    };

    return { cohorts, summary };
  }
}
