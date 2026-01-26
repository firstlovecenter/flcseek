import { prisma } from './prisma';
import { logger } from './logger';
import dayjs from 'dayjs';

/**
 * Predictive analytics engine for convert outcomes
 * Uses historical data to predict completion probability, dropout risk, and recommendations
 */

export interface PredictionFactors {
  attendanceRate: number;
  milestoneProgress: number;
  engagementTrend: number;
  recencyWeight: number;
  consistencyScore: number;
}

export interface Prediction {
  convertId: string;
  convertName: string; // Added: Display name of convert
  completionProbability: number; // 0-100
  dropoutRisk: number; // 0-100
  confidence: number; // 0-100
  factors: PredictionFactors;
  recommendation: string;
  estimatedCompletionDate?: Date;
  confidenceIntervals: {
    low: number;
    high: number;
  };
}

export class PredictiveAnalyticsService {
  /**
   * Calculate prediction factors for a convert
   */
  static async calculatePredictionFactors(convertId: string): Promise<PredictionFactors | null> {
    try {
      const convert = await prisma.newConvert.findUnique({
        where: { id: convertId },
        include: {
          attendanceRecords: {
            select: {
              attendanceDate: true,
              createdAt: true,
            },
            orderBy: {
              attendanceDate: 'desc',
            },
            take: 90,
          },
          progressRecords: {
            select: {
              stageNumber: true,
              stageName: true,
              isCompleted: true,
              dateCompleted: true,
            },
            orderBy: {
              dateCompleted: 'desc',
            },
            take: 20,
          },
        },
      });

      if (!convert) {
        return null;
      }

      // Calculate attendance rate (last 12 weeks)
      const twoWeeksAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const recentAttendance = convert.attendanceRecords.filter(
        (a) => new Date(a.attendanceDate) > twoWeeksAgo
      ).length;
      const maxPossibleAttendance = 13; // ~13 weeks
      const attendanceRate = Math.min((recentAttendance / maxPossibleAttendance) * 100, 100);

      // Calculate milestone progress
      const completedMilestones = convert.progressRecords.filter((p) => p.isCompleted || p.dateCompleted).length;
      const totalMilestones = 7; // FLC has 7 milestones
      const milestoneProgress = (completedMilestones / totalMilestones) * 100;

      // Calculate engagement trend
      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const previous30Days = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

      const recentEngagement = convert.attendanceRecords.filter(
        (a) => new Date(a.attendanceDate) > last30Days
      ).length;
      const previousEngagement = convert.attendanceRecords.filter(
        (a) =>
          new Date(a.attendanceDate) > previous30Days && new Date(a.attendanceDate) <= last30Days
      ).length;

      const engagementTrend =
        previousEngagement > 0
          ? ((recentEngagement - previousEngagement) / previousEngagement) * 100
          : recentEngagement > 0
            ? 50
            : -50;

      // Recency weight (how recent is the last activity)
      const lastActivity = Math.max(
        convert.attendanceRecords[0]
          ? new Date(convert.attendanceRecords[0].attendanceDate).getTime()
          : 0,
        convert.progressRecords[0]
          ? new Date(convert.progressRecords[0].dateCompleted || new Date(0)).getTime()
          : 0,
        convert.lastAttendanceDate?.getTime() || 0
      );

      const daysSinceLastActivity = (Date.now() - lastActivity) / (1000 * 60 * 60 * 24);
      const recencyWeight = Math.max(100 - daysSinceLastActivity * 2, 0);

      // Consistency score (how consistent is attendance)
      if (convert.attendanceRecords.length < 3) {
        // Not enough data
        return null;
      }

      const intervals: number[] = [];
      for (let i = 0; i < convert.attendanceRecords.length - 1; i++) {
        const current = new Date(convert.attendanceRecords[i].attendanceDate).getTime();
        const next = new Date(convert.attendanceRecords[i + 1].attendanceDate).getTime();
        intervals.push((current - next) / (1000 * 60 * 60 * 24)); // Days between attendance
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance =
        intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = stdDev / (avgInterval || 1);
      const consistencyScore = Math.max(100 - coefficientOfVariation * 15, 0); // Lower variance = higher consistency

      return {
        attendanceRate,
        milestoneProgress,
        engagementTrend,
        recencyWeight,
        consistencyScore,
      };
    } catch (error) {
      logger.error('PredictiveAnalytics: Error calculating factors', {
        convertId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Predict completion probability for a convert
   * Uses weighted factors to calculate likelihood of completing discipleship
   */
  static async predictCompletionProbability(convertId: string): Promise<Prediction | null> {
    try {
      const factors = await this.calculatePredictionFactors(convertId);
      if (!factors) {
        return null;
      }

      // Weighted calculation
      const weights = {
        attendanceRate: 0.35,
        milestoneProgress: 0.25,
        engagementTrend: 0.15,
        recencyWeight: 0.15,
        consistencyScore: 0.1,
      };

      const completionProbability =
        factors.attendanceRate * weights.attendanceRate +
        factors.milestoneProgress * weights.milestoneProgress +
        (Math.max(factors.engagementTrend, -50) + 50) * 0.5 * weights.engagementTrend +
        factors.recencyWeight * weights.recencyWeight +
        factors.consistencyScore * weights.consistencyScore;

      // Dropout risk (inverse of completion with adjustment)
      const dropoutRisk = Math.max(100 - completionProbability * 1.2, 0);

      // Confidence interval based on data availability
      const convert = await prisma.newConvert.findUnique({
        where: { id: convertId },
        include: {
          attendanceRecords: {
            select: { id: true },
          },
          progressRecords: {
            select: { id: true },
          },
        },
      });

      const dataPoints = (convert?.attendanceRecords.length || 0) + (convert?.progressRecords.length || 0);
      const confidencePercentage = Math.min((dataPoints / 50) * 100, 95); // Max 95% confidence
      const marginOfError = 15; // ±15%

      // Estimate completion date based on milestone progress
      let estimatedCompletionDate: Date | undefined;
      if (factors.milestoneProgress > 0 && factors.milestoneProgress < 100) {
        const daysPerMilestone = 30; // Average 30 days per milestone
        const remainingMilestones = 7 - (factors.milestoneProgress / 100) * 7;
        const daysToCompletion = remainingMilestones * daysPerMilestone;
        estimatedCompletionDate = new Date(Date.now() + daysToCompletion * 24 * 60 * 60 * 1000);
      }

      // Generate recommendation
      const recommendation = this.generateRecommendation(
        completionProbability,
        factors,
        dropoutRisk
      );

      return {
        convertId,
        convertName: `${convert?.firstName || ''} ${convert?.lastName || ''}`.trim(),
        completionProbability: Math.round(completionProbability * 10) / 10,
        dropoutRisk: Math.round(dropoutRisk * 10) / 10,
        confidence: Math.round(confidencePercentage),
        factors,
        recommendation,
        estimatedCompletionDate,
        confidenceIntervals: {
          low: Math.max(completionProbability - marginOfError, 0),
          high: Math.min(completionProbability + marginOfError, 100),
        },
      };
    } catch (error) {
      logger.error('PredictiveAnalytics: Error predicting completion', {
        convertId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Generate recommendation based on prediction
   */
  private static generateRecommendation(
    completionProbability: number,
    factors: PredictionFactors,
    dropoutRisk: number
  ): string {
    if (completionProbability > 75) {
      return 'On track for completion. Maintain current engagement level.';
    }

    if (dropoutRisk > 70) {
      if (factors.attendanceRate < 50) {
        return 'LOW ENGAGEMENT: Prioritize re-engagement strategy and follow-up.';
      }
      if (factors.engagementTrend < -30) {
        return 'DECLINING ENGAGEMENT: Schedule personal check-in to understand barriers.';
      }
      return 'AT RISK: Increase touchpoints and accountability check-ins.';
    }

    if (completionProbability > 50) {
      if (factors.consistencyScore < 40) {
        return 'INCONSISTENT: Encourage regular attendance patterns.';
      }
      return 'Moderate progress. Consider milestone-focused follow-up.';
    }

    if (factors.milestoneProgress > 50 && factors.attendanceRate < 60) {
      return 'Making milestone progress despite low attendance. Investigate barriers to attendance.';
    }

    return 'Early stage. Continue regular engagement and discipleship.';
  }

  /**
   * Predict outcomes for all converts in a group
   */
  static async predictGroupOutcomes(groupId: string) {
    try {
      const converts = await prisma.newConvert.findMany({
        where: {
          groupId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      const predictions = await Promise.all(
        converts.map((c) => this.predictCompletionProbability(c.id))
      );

      const validPredictions = predictions.filter((p): p is Prediction => p !== null);

      const summary = {
        totalConverts: converts.length,
        predictionsGenerated: validPredictions.length,
        averageCompletion: validPredictions.length
          ? validPredictions.reduce((sum, p) => sum + p.completionProbability, 0) /
            validPredictions.length
          : 0,
        averageDropoutRisk: validPredictions.length
          ? validPredictions.reduce((sum, p) => sum + p.dropoutRisk, 0) / validPredictions.length
          : 0,
        highRisk: validPredictions.filter((p) => p.dropoutRisk > 70).length,
        onTrack: validPredictions.filter((p) => p.completionProbability > 75).length,
        predictions: validPredictions,
      };

      logger.info('Group predictions generated', {
        groupId,
        totalConverts: converts.length,
        predictionsGenerated: validPredictions.length,
      });

      return summary;
    } catch (error) {
      logger.error('PredictiveAnalytics: Error predicting group outcomes', {
        groupId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get converts by prediction category
   */
  static async getConvertsByCategory(groupId: string) {
    try {
      const predictions = await this.predictGroupOutcomes(groupId);

      return {
        onTrack: predictions.predictions.filter((p) => p.completionProbability > 75),
        atRisk: predictions.predictions.filter(
          (p) => p.completionProbability > 50 && p.completionProbability <= 75
        ),
        highRisk: predictions.predictions.filter((p) => p.completionProbability <= 50),
      };
    } catch (error) {
      logger.error('PredictiveAnalytics: Error categorizing converts', {
        groupId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Calculate recommended actions based on predictions
   */
  static async getRecommendedActions(convertId: string) {
    try {
      const prediction = await this.predictCompletionProbability(convertId);
      if (!prediction) {
        return null;
      }

      const actions: string[] = [];

      if (prediction.dropoutRisk > 70) {
        actions.push('Schedule immediate 1-on-1 follow-up');
        actions.push('Identify and address barriers to participation');
      }

      if (prediction.factors.attendanceRate < 50) {
        actions.push('Increase engagement touchpoints');
        actions.push('Consider alternative meeting times or formats');
      }

      if (prediction.factors.engagementTrend < -20) {
        actions.push('Investigate recent life changes or challenges');
        actions.push('Provide additional support or mentoring');
      }

      if (prediction.factors.consistencyScore < 40) {
        actions.push('Help establish attendance accountability partner');
        actions.push('Provide calendar reminders and schedule support');
      }

      if (prediction.factors.milestoneProgress > 50 && prediction.factors.attendanceRate > 70) {
        actions.push('Celebrate progress and maintain momentum');
        actions.push('Prepare for next milestone challenges');
      }

      return {
        convertId,
        prediction,
        recommendations: actions,
      };
    } catch (error) {
      logger.error('PredictiveAnalytics: Error getting recommendations', {
        convertId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
