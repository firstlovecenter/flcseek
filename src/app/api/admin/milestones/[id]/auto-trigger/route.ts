/**
 * API Route: Milestone Auto-Trigger Configuration
 * GET/PUT /api/admin/milestones/[id]/auto-trigger
 * 
 * Manage auto-trigger configurations for milestones
 * Requires admin privileges
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getMilestoneAutoTriggerConfig,
  updateMilestoneAutoTriggerConfig,
  MilestoneAutoTriggerConfig,
} from '@/lib/milestone-auto-calc'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api/middleware';

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

/**
 * GET /api/admin/milestones/[id]/auto-trigger
 * Get auto-trigger configuration for a milestone
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    if (!['superadmin', 'leadpastor', 'overseer', 'admin'].includes(user!.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get milestone
    const milestone = await prisma.milestone.findUnique({
      where: { id },
    })

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    const config = await getMilestoneAutoTriggerConfig(id)

    return NextResponse.json({
      success: true,
      milestone: {
        id: milestone.id,
        stageNumber: milestone.stageNumber,
        stageName: milestone.stageName,
        isAutoCalculated: milestone.isAutoCalculated,
      },
      autoTriggerConfig: config,
    })
  } catch (error) {
    logger.error(`Error fetching auto-trigger config for milestone ${id}:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/milestones/[id]/auto-trigger
 * Update auto-trigger configuration for a milestone
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    if (!['superadmin', 'leadpastor', 'overseer', 'admin'].includes(user!.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body: MilestoneAutoTriggerConfig = await request.json()

    // Validate configuration
    if (!body.enabled !== undefined) {
      return NextResponse.json({ error: 'Invalid configuration' }, { status: 400 })
    }

    if (!Array.isArray(body.conditions) || body.conditions.length === 0) {
      return NextResponse.json({ error: 'At least one condition is required' }, { status: 400 })
    }

    // Check if milestone exists
    const milestone = await prisma.milestone.findUnique({
      where: { id },
    })

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    // Update configuration
    const success = await updateMilestoneAutoTriggerConfig(id, body)

    if (!success) {
      return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 })
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        entityType: 'milestone',
        entityId: id,
        action: 'update_auto_trigger',
        newValues: {
          config: body,
        } as any,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Auto-trigger configuration updated',
      autoTriggerConfig: body,
    })
  } catch (error) {
    logger.error(`Error updating auto-trigger config for milestone ${id}:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
