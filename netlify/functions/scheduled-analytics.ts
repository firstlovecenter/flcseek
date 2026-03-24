import type { Config } from '@netlify/functions';
import { runDailyMilestoneAutoCompletion } from '../../src/lib/milestone-auto-calc';
import { logger } from '../../src/lib/logger';

/**
 * Netlify Scheduled Function: Daily Milestone Auto-Completion
 * Runs daily at 2:00 AM UTC.
 * Replaces the node-cron job in src/lib/cron-jobs.ts which does not work in serverless.
 */
export default async function handler() {
  logger.info('Netlify scheduled: Running daily milestone auto-completion...');
  try {
    const systemUserId = process.env.SYSTEM_USER_ID || 'system';
    await runDailyMilestoneAutoCompletion(systemUserId);
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
