import type { Config } from '@netlify/functions';
import { cloneGroupsToCurrentYear } from '../../src/lib/year-rollover';
import { getSystemUserId } from '../../src/lib/milestone-auto-calc';
import { logger } from '../../src/lib/logger';

/**
 * Netlify Scheduled Function: Yearly Group Rollover
 * Runs January 1st at 00:15 UTC.
 *
 * Replaces the previously documented (but never committed) GitHub Actions
 * workflow that called the clone endpoint with a long-lived superadmin token.
 * Running in-platform needs no static credential at all.
 *
 * Idempotent: groups already present in the current year are skipped, so a
 * retry or a manual UI-triggered clone alongside this job is harmless.
 */
export default async function handler() {
  logger.info('Netlify scheduled: Running yearly group rollover...');
  try {
    const systemUserId = await getSystemUserId();
    const result = await cloneGroupsToCurrentYear(systemUserId);
    logger.info(
      `Yearly rollover complete: ${result.clonedCount} cloned, ${result.skippedCount} skipped`
    );
    return { statusCode: 200 };
  } catch (error) {
    logger.error('Yearly rollover failed:', error);
    return { statusCode: 500 };
  }
}

export const config: Config = {
  schedule: '15 0 1 1 *',
};
