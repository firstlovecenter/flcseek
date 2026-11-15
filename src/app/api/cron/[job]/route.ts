import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { runDailyMilestoneAutoCompletion, getSystemUserId } from '@/lib/milestone-auto-calc';
import { clearOldNotifications } from '@/lib/leader-notifications';
import { cloneGroupsToCurrentYear } from '@/lib/year-rollover';
import { logger } from '@/lib/logger';

/**
 * Scheduled jobs, invoked by the Cloudflare Worker's `scheduled` handler
 * (see worker.ts / wrangler.jsonc triggers). Guarded by CRON_SECRET.
 *   milestones — daily milestone auto-completion (02:00 UTC)
 *   cleanup    — weekly notification cleanup (Sun 03:00 UTC)
 *   rollover   — clone groups into the new year (Jan 1 00:15 UTC)
 */
export const dynamic = 'force-dynamic';

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  const given = request.headers.get('x-cron-secret');
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const JOBS: Record<string, () => Promise<unknown>> = {
  milestones: () => runDailyMilestoneAutoCompletion(),
  cleanup: () => clearOldNotifications(30),
  rollover: async () => cloneGroupsToCurrentYear(await getSystemUserId()),
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ job: string }> }
) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { job } = await params;
  const run = JOBS[job];
  if (!run) {
    return NextResponse.json({ error: 'Unknown job' }, { status: 404 });
  }
  try {
    const result = await run();
    logger.info(`Cron job "${job}" complete`, result ?? '');
    return NextResponse.json({ ok: true, result: result ?? null });
  } catch (error) {
    logger.error(`Cron job "${job}" failed:`, error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
