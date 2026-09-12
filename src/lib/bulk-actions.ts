import { prisma } from './prisma';
import { logger } from './logger';
import { SearchFilter } from './types/advanced-features';

export interface BulkActionResult {
  action: 'update' | 'delete' | 'milestone' | 'status';
  targetCount: number;
  successCount: number;
  failureCount: number;
  errors: string[];
  duration: number; // ms
}

export class BulkActionsService {
  /**
   * Reassign converts matching filters (or optional IDs) to a target group.
   */
  static async bulkReassignGroup(
    filters: SearchFilter[],
    targetGroupId: string,
    sourceGroupId?: string,
    convertIds?: string[]
  ): Promise<BulkActionResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      const target = await prisma.group.findFirst({
        where: { id: targetGroupId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!target) {
        throw new Error('Target group not found');
      }

      const where: Record<string, unknown> = { deletedAt: null };
      if (sourceGroupId) where.groupId = sourceGroupId;
      if (convertIds?.length) where.id = { in: convertIds };

      filters.forEach((f) => {
        const field = f.field.split('.')[0];
        if (f.operator === 'equals') {
          where[field] = f.value;
        } else if (f.operator === 'contains') {
          where[field] = { contains: f.value, mode: 'insensitive' };
        }
      });

      const targetCount = await prisma.newConvert.count({ where });

      const result = await prisma.newConvert.updateMany({
        where,
        data: {
          groupId: target.id,
          groupName: target.name,
          updatedAt: new Date(),
        },
      });

      logger.info('Bulk group reassignment executed', {
        targetCount,
        updatedCount: result.count,
        targetGroupId: target.id,
      });

      return {
        action: 'status',
        targetCount,
        successCount: result.count,
        failureCount: targetCount - result.count,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(msg);
      logger.error('Bulk group reassignment failed', { error: msg });
      throw error;
    }
  }

  /**
   * @deprecated Prefer bulkReassignGroup. Kept for callers that only need a timestamp touch.
   */
  static async bulkUpdateStatus(
    filters: SearchFilter[],
    newStatus: string,
    groupId?: string
  ): Promise<BulkActionResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      const where: Record<string, unknown> = {};
      if (groupId) where.groupId = groupId;
      where.deletedAt = null;

      filters.forEach((f) => {
        const field = f.field.split('.')[0];
        if (f.operator === 'equals') {
          where[field] = f.value;
        } else if (f.operator === 'contains') {
          where[field] = { contains: f.value, mode: 'insensitive' };
        }
      });

      const targetCount = await prisma.newConvert.count({ where });

      const result = await prisma.newConvert.updateMany({
        where,
        data: {
          updatedAt: new Date(),
        },
      });

      logger.info('Bulk status update executed', {
        targetCount,
        updatedCount: result.count,
        newStatus,
      });

      return {
        action: 'status',
        targetCount,
        successCount: result.count,
        failureCount: targetCount - result.count,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(msg);
      logger.error('Bulk status update failed', { error: msg });
      throw error;
    }
  }

  /**
   * Bulk milestone assignment
   */
  static async bulkAssignMilestone(
    filters: SearchFilter[],
    milestoneId: string,
    groupId?: string
  ): Promise<BulkActionResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let successCount = 0;

    try {
      const where: Record<string, unknown> = { deletedAt: null };
      if (groupId) where.groupId = groupId;

      filters.forEach((f) => {
        const field = f.field.split('.')[0];
        if (f.operator === 'equals') {
          where[field] = f.value;
        }
      });

      const converts = await prisma.newConvert.findMany({ where, select: { id: true } });
      const targetCount = converts.length;

      for (const convert of converts) {
        try {
          await prisma.progressRecord.create({
            data: {
              personId: convert.id,
              stageNumber: parseInt(milestoneId),
              stageName: `Stage ${milestoneId}`,
              isCompleted: false,
              updatedById: 'system',
            },
          });
          successCount++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          errors.push(`Convert ${convert.id}: ${msg}`);
        }
      }

      logger.info('Bulk milestone assignment completed', {
        targetCount,
        successCount,
        milestoneId,
      });

      return {
        action: 'milestone',
        targetCount,
        successCount,
        failureCount: targetCount - successCount,
        errors: errors.slice(0, 10), // Limit error messages
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(msg);
      throw error;
    }
  }

  /**
   * Bulk delete converts (soft delete)
   */
  static async bulkDelete(
    convertIds: string[],
    groupId?: string
  ): Promise<BulkActionResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      const where: Record<string, unknown> = {
        id: { in: convertIds },
      };
      if (groupId) where.groupId = groupId;

      const targetCount = await prisma.newConvert.count({ where });

      const result = await prisma.newConvert.updateMany({
        where,
        data: {
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      logger.info('Bulk delete executed', {
        targetCount,
        deletedCount: result.count,
      });

      return {
        action: 'delete',
        targetCount,
        successCount: result.count,
        failureCount: targetCount - result.count,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(msg);
      throw error;
    }
  }

  /**
   * Get bulk action history for a group
   */
  static async getBulkActionHistory(groupId: string, limit: number = 50) {
    try {
      // Log bulk actions in NotificationLog or create dedicated table
      // For now, return empty array
      return [];
    } catch (error) {
      logger.error('Failed to get bulk action history', {
        groupId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Undo last bulk action (if supported by your audit log)
   */
  static async undoBulkAction(actionId: string): Promise<boolean> {
    try {
      logger.info('Undo requested for action', { actionId });
      // Implement using your audit log system
      return false;
    } catch (error) {
      logger.error('Failed to undo action', { actionId });
      return false;
    }
  }
}
