import { prisma } from './prisma';
import { logger } from './logger';
import dayjs from 'dayjs';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji or icon name
  criteria: {
    type: 'milestone' | 'attendance' | 'consistency' | 'custom';
    value: number; // e.g., milestone stage or attendance count
    description: string;
  };
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  points: number; // reward points
  createdAt: Date;
}

export interface UserBadgeData {
  userId: string;
  badgeId: string;
  earnedAt: Date;
  unlockedAt?: Date;
  progress?: number; // percentage toward earning badge
}

export class AchievementBadgesService {
  /**
   * Get all available badges
   */
  static async getAllBadges(): Promise<Badge[]> {
    try {
      const badges = await prisma.achievementBadge.findMany({
        orderBy: { createdAt: 'desc' },
      });

      return badges.map((b) => this.mapBadge(b));
    } catch (error) {
      logger.error('Failed to get badges', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get user's earned badges
   */
  static async getUserBadges(userId: string): Promise<UserBadgeData[]> {
    try {
      const userBadges = await prisma.userBadge.findMany({
        where: { convertId: userId },
        orderBy: { earnedAt: 'desc' },
      });

      return userBadges.map((ub) => ({
        userId: ub.convertId || '',
        badgeId: ub.badgeId,
        earnedAt: ub.earnedAt || new Date(),
        unlockedAt: ub.earnedAt ?? undefined,
      }));
    } catch (error) {
      logger.error('Failed to get user badges', { userId });
      return [];
    }
  }

  /**
   * Evaluate and award badges for a convert based on achievements
   */
  static async evaluateAndAwardBadges(convertId: string): Promise<string[]> {
    const awardedBadgeIds: string[] = [];

    try {
      const convert = await prisma.newConvert.findUnique({
        where: { id: convertId },
        include: {
          progressRecords: true,
          userBadges: true,
        },
      });

      if (!convert) return [];

      const badges = await this.getAllBadges();

      for (const badge of badges) {
        // Check if already earned
        const alreadyEarned = convert.userBadges.some((ub) => ub.badgeId === badge.id);
        if (alreadyEarned) continue;

        let shouldAward = false;

        switch (badge.criteria.type) {
          case 'milestone':
            // Award when reaching a specific milestone stage
            const latestMilestone = convert.progressRecords
              .filter((p) => p.isCompleted)
              .sort((a, b) => (b.stageNumber || 0) - (a.stageNumber || 0))[0];

            shouldAward = (latestMilestone?.stageNumber || 0) >= badge.criteria.value;
            break;

          case 'attendance':
            // Award when attendance reaches a threshold
            const attendanceCount = await prisma.attendanceRecord.count({
              where: { personId: convertId, attendanceDate: { gte: dayjs().subtract(1, 'year').toDate() } },
            });
            shouldAward = attendanceCount >= badge.criteria.value;
            break;

          case 'consistency':
            // Award when convert shows consistent attendance over weeks
            const consistentWeeks = await this.calculateConsistentWeeks(convertId);
            shouldAward = consistentWeeks >= badge.criteria.value;
            break;

          case 'custom':
            // Custom logic per badge
            shouldAward = await this.evaluateCustomBadgeCriteria(convertId, badge.id);
            break;
        }

        if (shouldAward) {
          await this.awardBadge(convertId, badge.id);
          awardedBadgeIds.push(badge.id);
        }
      }

      return awardedBadgeIds;
    } catch (error) {
      logger.error('Failed to evaluate badges for convert', {
        convertId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Award a specific badge to a user
   */
  static async awardBadge(convertId: string, badgeId: string): Promise<boolean> {
    try {
      // Check if already awarded
      const existing = await prisma.userBadge.findFirst({
        where: {
          convertId,
          badgeId,
        },
      });

      if (existing) {
        return false; // Already awarded
      }

      await prisma.userBadge.create({
        data: {
          convertId,
          badgeId,
          earnedAt: new Date(),
        },
      });

      logger.info('Badge awarded', { convertId, badgeId });
      return true;
    } catch (error) {
      logger.error('Failed to award badge', { convertId, badgeId });
      return false;
    }
  }

  /**
   * Get badge earning progress for a convert
   */
  static async getBadgeProgress(convertId: string): Promise<
    Array<{
      badge: Badge;
      progress: number; // 0-100
      earned: boolean;
    }>
  > {
    try {
      const convert = await prisma.newConvert.findUnique({
        where: { id: convertId },
        include: {
          progressRecords: true,
          userBadges: true,
        },
      });

      if (!convert) return [];

      const badges = await this.getAllBadges();
      const results = [];

      for (const badge of badges) {
        const earned = convert.userBadges.some((ub) => ub.badgeId === badge.id);

        let progress = 0;

        if (!earned) {
          switch (badge.criteria.type) {
            case 'milestone': {
              const latestMilestone = convert.progressRecords
                .filter((p) => p.isCompleted)
                .sort((a, b) => (b.stageNumber || 0) - (a.stageNumber || 0))[0];

              progress = Math.min(100, ((latestMilestone?.stageNumber || 0) / badge.criteria.value) * 100);
              break;
            }

            case 'attendance': {
              const attendanceCount = await prisma.attendanceRecord.count({
                where: { personId: convertId },
              });
              progress = Math.min(100, (attendanceCount / badge.criteria.value) * 100);
              break;
            }

            case 'consistency': {
              const consistentWeeks = await this.calculateConsistentWeeks(convertId);
              progress = Math.min(100, (consistentWeeks / badge.criteria.value) * 100);
              break;
            }
          }
        } else {
          progress = 100;
        }

        results.push({
          badge,
          progress,
          earned,
        });
      }

      return results.sort((a, b) => b.progress - a.progress);
    } catch (error) {
      logger.error('Failed to get badge progress', { convertId });
      return [];
    }
  }

  /**
   * Get leaderboard of users by badges earned
   */
  static async getLeaderboard(groupId?: string, limit: number = 20) {
    try {
      const query =
        groupId === undefined
          ? `
            SELECT 
              nc.id,
              nc.first_name,
              nc.last_name,
              COUNT(ub.badge_id) as badge_count,
              MAX(ub.earned_at) as last_badge_earned
            FROM new_converts nc
            LEFT JOIN user_badges ub ON nc.id = ub.person_id
            WHERE nc.deleted_at IS NULL
            GROUP BY nc.id, nc.first_name, nc.last_name
            ORDER BY badge_count DESC, last_badge_earned DESC
            LIMIT $1
          `
          : `
            SELECT 
              nc.id,
              nc.first_name,
              nc.last_name,
              COUNT(ub.badge_id) as badge_count,
              MAX(ub.earned_at) as last_badge_earned
            FROM new_converts nc
            LEFT JOIN user_badges ub ON nc.id = ub.person_id
            WHERE nc.deleted_at IS NULL AND nc.group_id = $1
            GROUP BY nc.id, nc.first_name, nc.last_name
            ORDER BY badge_count DESC, last_badge_earned DESC
            LIMIT $2
          `;

      const params = groupId === undefined ? [limit] : [groupId, limit];

      const results = await prisma.$queryRawUnsafe(query, ...params);

      return (results as any[]).map((row, index) => ({
        rank: index + 1,
        userId: row.id,
        name: `${row.first_name} ${row.last_name}`,
        badgesEarned: Number(row.badge_count),
        lastBadgeEarned: row.last_badge_earned,
      }));
    } catch (error) {
      logger.error('Failed to get leaderboard', { groupId });
      return [];
    }
  }

  /**
   * Helper: Calculate consecutive weeks with attendance
   */
  private static async calculateConsistentWeeks(convertId: string): Promise<number> {
    try {
      const attendanceRecords = await prisma.attendanceRecord.findMany({
        where: { personId: convertId },
        orderBy: { attendanceDate: 'desc' },
        select: { attendanceDate: true },
      });

      if (attendanceRecords.length === 0) return 0;

      let consistentWeeks = 0;
      let lastDate: Date | null = null;

      for (const record of attendanceRecords) {
        if (!lastDate) {
          consistentWeeks = 1;
          lastDate = record.attendanceDate;
          continue;
        }

        // Check if within the same week (7 days)
        const daysDiff = Math.floor(
          (lastDate.getTime() - record.attendanceDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff <= 7 && daysDiff > 0) {
          consistentWeeks++;
          lastDate = record.attendanceDate;
        } else {
          break; // Break on first non-consecutive week
        }
      }

      return consistentWeeks;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Helper: Evaluate custom badge criteria
   */
  private static async evaluateCustomBadgeCriteria(convertId: string, badgeId: string): Promise<boolean> {
    // Implement custom criteria based on badge type
    // For now, always return false
    return false;
  }

  /**
   * Helper: Map database badge to Badge interface
   */
  private static mapBadge(badge: Record<string, unknown>): Badge {
    const criteria = typeof badge.criteria === 'string' ? JSON.parse(badge.criteria) : badge.criteria;

    return {
      id: badge.id as string,
      name: badge.name as string,
      description: badge.description as string,
      icon: badge.icon as string,
      criteria: {
        type: criteria.type as Badge['criteria']['type'],
        value: criteria.value as number,
        description: criteria.description as string,
      },
      rarity: badge.rarity as Badge['rarity'],
      points: (badge.points as number) || 0,
      createdAt: badge.createdAt as Date,
    };
  }
}
