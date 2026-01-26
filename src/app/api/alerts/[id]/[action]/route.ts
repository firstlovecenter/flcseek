/**
 * API Route: Alert Actions
 * PUT /api/alerts/[id]/acknowledge
 * PUT /api/alerts/[id]/resolve
 */

import { NextRequest, NextResponse } from 'next/server'
import { acknowledgeAlert, resolveAlert } from '@/lib/alert-management'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

interface RouteContext {
  params: Promise<{
    id: string
    action: string
  }>
}

/**
 * PUT /api/alerts/[id]/acknowledge
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const params = await context.params
  const { id, action } = params

  try {
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { reason?: string }

    if (action === 'acknowledge') {
      const success = await acknowledgeAlert(id, userId, body.reason)

      if (!success) {
        return NextResponse.json({ error: 'Failed to acknowledge alert' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Alert acknowledged',
      })
    } else if (action === 'resolve') {
      const success = await resolveAlert(id, userId, body.reason)

      if (!success) {
        return NextResponse.json({ error: 'Failed to resolve alert' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Alert resolved',
      })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    logger.error(`Error processing alert action ${action} for ${id}:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
