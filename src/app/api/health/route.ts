import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 * Public liveness probe for load balancers and uptime checks.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[GET /api/health]', error);
    return NextResponse.json(
      {
        ok: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
