import { prisma } from './prisma';
import { logger } from './logger';
import dayjs from 'dayjs';

interface WeeklyPoint {
  weekStart: Date;
  attendanceCount: number;
  milestoneCompletions: number;
}

interface ForecastPoint {
  weekStart: Date;
  attendanceForecast: number;
  milestoneForecast: number;
}

export interface ForecastResult {
  groupId?: string;
  weeksAnalyzed: number;
  history: WeeklyPoint[];
  forecast: ForecastPoint[];
  trend: {
    attendanceSlope: number;
    milestoneSlope: number;
    attendanceDirection: 'up' | 'flat' | 'down';
    milestoneDirection: 'up' | 'flat' | 'down';
  };
}

export class GrowthForecastingService {
  /**
   * Build weekly time series for attendance and milestone completions
   */
  static async buildWeeklySeries(groupId?: string, weeks: number = 12): Promise<WeeklyPoint[]> {
    const startDate = dayjs().startOf('week').subtract(weeks - 1, 'week').toDate();

    // Attendance
    const attendance = await prisma.attendanceRecord.groupBy({
      by: ['attendanceDate'],
      where: {
        attendanceDate: { gte: startDate },
        ...(groupId ? { person: { groupId } } : {}),
      },
      _count: {
        id: true,
      },
    });

    // Milestone completions
    const completions = await prisma.progressRecord.groupBy({
      by: ['dateCompleted'],
      where: {
        dateCompleted: { not: null, gte: startDate },
        isCompleted: true,
        ...(groupId ? { person: { groupId } } : {}),
      },
      _count: {
        id: true,
      },
    });

    // Bucket by ISO week
    const bucketMap = new Map<string, WeeklyPoint>();
    const addToBucket = (
      date: Date,
      type: 'attendance' | 'milestone',
      count: number
    ) => {
      const weekStart = dayjs(date).startOf('week');
      const key = weekStart.format('YYYY-MM-DD');
      if (!bucketMap.has(key)) {
        bucketMap.set(key, {
          weekStart: weekStart.toDate(),
          attendanceCount: 0,
          milestoneCompletions: 0,
        });
      }
      const bucket = bucketMap.get(key)!;
      if (type === 'attendance') bucket.attendanceCount += count;
      if (type === 'milestone') bucket.milestoneCompletions += count;
    };

    attendance.forEach((a) => addToBucket(a.attendanceDate, 'attendance', a._count.id));
    completions.forEach((c) => addToBucket(c.dateCompleted as Date, 'milestone', c._count.id));

    const weeksList = Array.from(bucketMap.values()).sort(
      (a, b) => a.weekStart.getTime() - b.weekStart.getTime()
    );

    return weeksList;
  }

  /**
   * Simple linear regression forecast for next n weeks
   */
  static forecastNextWeeks(history: WeeklyPoint[], nextWeeks: number = 4): ForecastPoint[] {
    const makeForecast = (series: number[]) => {
      const n = series.length;
      if (n === 0) return { values: [], slope: 0 };
      const xMean = (n - 1) / 2;
      const yMean = series.reduce((a, b) => a + b, 0) / n;
      let num = 0;
      let den = 0;
      for (let i = 0; i < n; i++) {
        const x = i - xMean;
        num += x * (series[i] - yMean);
        den += x * x;
      }
      const slope = den === 0 ? 0 : num / den;
      const intercept = yMean - slope * xMean;
      const values: number[] = [];
      for (let i = 0; i < nextWeeks; i++) {
        const x = n + i;
        values.push(Math.max(Math.round(intercept + slope * x), 0));
      }
      return { values, slope };
    };

    const attendanceSeries = history.map((h) => h.attendanceCount);
    const milestoneSeries = history.map((h) => h.milestoneCompletions);

    const { values: attendanceForecast, slope: attendanceSlope } = makeForecast(attendanceSeries);
    const { values: milestoneForecast, slope: milestoneSlope } = makeForecast(milestoneSeries);

    const lastWeek = history[history.length - 1]?.weekStart || new Date();
    return attendanceForecast.map((a, idx) => ({
      weekStart: dayjs(lastWeek).add(idx + 1, 'week').toDate(),
      attendanceForecast: a,
      milestoneForecast: milestoneForecast[idx] || 0,
    }));
  }

  static directionFromSlope(slope: number): 'up' | 'flat' | 'down' {
    if (slope > 0.5) return 'up';
    if (slope < -0.5) return 'down';
    return 'flat';
  }

  /**
   * Compute forecast result
   */
  static async forecast(params: { groupId?: string; weeks?: number; horizon?: number }): Promise<ForecastResult> {
    const { groupId, weeks = 12, horizon = 4 } = params;
    const history = await this.buildWeeklySeries(groupId, weeks);
    const forecast = this.forecastNextWeeks(history, horizon);

    const attendanceSlope = this.directionFromSlopeTrend(history.map((h) => h.attendanceCount));
    const milestoneSlope = this.directionFromSlopeTrend(history.map((h) => h.milestoneCompletions));

    return {
      groupId,
      weeksAnalyzed: history.length,
      history,
      forecast,
      trend: {
        attendanceSlope: attendanceSlope.slope,
        milestoneSlope: milestoneSlope.slope,
        attendanceDirection: attendanceSlope.direction,
        milestoneDirection: milestoneSlope.direction,
      },
    };
  }

  private static directionFromSlopeTrend(series: number[]) {
    const n = series.length;
    if (n === 0) return { slope: 0, direction: 'flat' as const };
    const xMean = (n - 1) / 2;
    const yMean = series.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      const x = i - xMean;
      num += x * (series[i] - yMean);
      den += x * x;
    }
    const slope = den === 0 ? 0 : num / den;
    return { slope, direction: this.directionFromSlope(slope) };
  }
}
