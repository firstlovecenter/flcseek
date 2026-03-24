/**
 * API Route: Alert Management
 * GET /api/alerts
 * POST /api/alerts/[id]/acknowledge
 * PUT /api/alerts/[id]/resolve
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getGroupAlerts,
  getConvertAlerts,
  acknowledgeAlert,
  resolveAlert,
  evaluateAlertsForConvert,
} from '@/lib/alert-management'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api/middleware';

/**
 * GET /api/alerts
 * Get alerts for a group or convert
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    const searchParams = request.nextUrl.searchParams
    const groupId = searchParams.get('groupId')
    const convertId = searchParams.get('convertId')
    const status = searchParams.get('status') as 'active' | 'acknowledged' | 'resolved' | null

    if (!groupId && !convertId) {
      return NextResponse.json(
        { error: 'Please provide groupId or convertId' },
        { status: 400 }
      )
    }

    let alerts

    if (convertId) {
      alerts = await getConvertAlerts(convertId, status || undefined)
    } else if (groupId) {
      alerts = await getGroupAlerts(groupId, status || undefined)
    }

    return NextResponse.json({
      success: true,
      count: alerts?.length || 0,
      alerts: alerts || [],
    })
  } catch (error) {
    logger.error('Error fetching alerts:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
