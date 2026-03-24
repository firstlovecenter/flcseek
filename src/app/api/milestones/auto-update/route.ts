/**
 * API Route: Milestone Auto-Update
 * POST /api/milestones/auto-update
 * 
 * Manually trigger milestone auto-completion for a convert or all converts
 * Requires authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { evaluateMilestoneCompletion } from '@/lib/milestone-auto-calc'
import { notifyMilestoneCompletion } from '@/lib/leader-notifications'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api/middleware';

interface AutoUpdateRequest {
  convertId?: string
  groupId?: string
  forceAll?: boolean
}

export async function POST(request: NextRequest) {
  try {
    // Get user from session/token
    const { user, error: authError } = requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    const body: AutoUpdateRequest = await request.json()
    const { convertId, groupId, forceAll } = body

    // Validate that user is admin/leader
    if (!['superadmin', 'leadpastor', 'overseer', 'admin', 'leader'].includes(user!.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    let results: Array<{
      convertId: string
      newMilestones: number
      success: boolean
    }> = []

    // Single convert update
    if (convertId) {
      const convert = await prisma.newConvert.findUnique({
        where: { id: convertId },
      })

      if (!convert) {
        return NextResponse.json({ error: 'Convert not found' }, { status: 404 })
      }

      const result = await evaluateMilestoneCompletion(convertId, userId)
      if (result.wasSuccessful && result.newlyCompletedCount > 0) {
        if (convert.groupId) {
          await notifyMilestoneCompletion(
            convertId,
            `${result.completedMilestones.length} milestones`,
            convert.groupId
          )
        }
      }

      results.push({
        convertId,
        newMilestones: result.newlyCompletedCount,
        success: result.wasSuccessful,
      })
    }

    // Group update
    else if (groupId) {
      const converts = await prisma.newConvert.findMany({
        where: {
          groupId: groupId,
          deletedAt: null,
        },
        select: { id: true },
      })

      for (const convert of converts) {
        const result = await evaluateMilestoneCompletion(convert.id, userId)
        results.push({
          convertId: convert.id,
          newMilestones: result.newlyCompletedCount,
          success: result.wasSuccessful,
        })
      }

      // Notify leaders once
      const group = await prisma.group.findUnique({
        where: { id: groupId },
      })
      if (group && results.some((r) => r.newMilestones > 0)) {
        const totalNewMilestones = results.reduce((sum, r) => sum + r.newMilestones, 0)
        logger.info(
          `Auto-update complete for group ${groupId}: ${totalNewMilestones} new milestones`
        )
      }
    }

    // All converts (superadmin only)
    else if (forceAll) {
      if (user!.role !== 'superadmin') {
        return NextResponse.json({ error: 'Only superadmin can force all updates' }, { status: 403 })
      }

      const converts = await prisma.newConvert.findMany({
        where: { deletedAt: null },
        select: { id: true },
      })

      for (const convert of converts) {
        const result = await evaluateMilestoneCompletion(convert.id, userId)
        results.push({
          convertId: convert.id,
          newMilestones: result.newlyCompletedCount,
          success: result.wasSuccessful,
        })
      }
    } else {
      return NextResponse.json(
        { error: 'Please provide convertId, groupId, or forceAll' },
        { status: 400 }
      )
    }

    const successCount = results.filter((r) => r.success).length
    const totalNewMilestones = results.reduce((sum, r) => sum + r.newMilestones, 0)

    return NextResponse.json({
      success: true,
      processed: results.length,
      successful: successCount,
      totalNewMilestones,
      results: results.slice(0, 100), // Return first 100 for size limit
    })
  } catch (error) {
    logger.error('Error in auto-update milestones:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/milestones/auto-update
 * Get auto-update status and configuration
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    // Get count of milestones with auto-trigger enabled
    const autoTriggeredCount = await prisma.milestone.count({
      where: {
        isAutoCalculated: true,
        isActive: true,
      },
    })

    // Get recent auto-completions (from last 24 hours)
    const recentCompletions = await prisma.progressRecord.findMany({
      where: {
        dateCompleted: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      select: { stageNumber: true, dateCompleted: true },
    })

    return NextResponse.json({
      success: true,
      config: {
        autoTriggeredMilestonesEnabled: autoTriggeredCount,
        lastRecentCompletions: recentCompletions.length,
        completionsByStage: recentCompletions.reduce(
          (acc, r) => {
            acc[r.stageNumber] = (acc[r.stageNumber] || 0) + 1
            return acc
          },
          {} as Record<number, number>
        ),
      },
    })
  } catch (error) {
    logger.error('Error fetching auto-update status:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
