import type { Config } from '@netlify/functions';
import { clearOldNotifications } from '../../src/lib/leader-notifications';
import { logger } from '../../src/lib/logger';

/**
 * Netlify Scheduled Function: Weekly Notification Cleanup
 * Runs every Sunday at 3:00 AM UTC.
 */
export default async function handler() {
  logger.info('Netlify scheduled: Running notification cleanup...');
  try {
    await clearOldNotifications(30);
    logger.info('Notification cleanup complete');
    return { statusCode: 200 };
  } catch (error) {
    logger.error('Notification cleanup failed:', error);
    return { statusCode: 500 };
  }
}

export const config: Config = {
  schedule: '0 3 * * 0',
};
