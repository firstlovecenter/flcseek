import type { Config } from '@netlify/functions';
import { runDailyMilestoneAutoCompletion } from '../../src/lib/milestone-auto-calc';
import { logger } from '../../src/lib/logger';

/**
 * Netlify Scheduled Function: Daily Milestone Auto-Completion
 * Runs daily at 2:00 AM UTC.
 *
 * The job is set-based (a fixed number of queries regardless of convert
 * count) so it stays well inside the free-tier 10s function execution limit.
 * The acting user id is resolved internally (SYSTEM_USER_ID env var if it
 * points at a real user, otherwise the dedicated "system" user).
 */
export default async function handler() {
  logger.info('Netlify scheduled: Running daily milestone auto-completion...');
  try {
    await runDailyMilestoneAutoCompletion();
    logger.info('Daily milestone auto-completion complete');
    return { statusCode: 200 };
  } catch (error) {
    logger.error('Scheduled milestone auto-completion failed:', error);
    return { statusCode: 500 };
  }
}

export const config: Config = {
  schedule: '0 2 * * *',
};
