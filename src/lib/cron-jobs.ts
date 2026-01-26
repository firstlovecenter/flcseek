/**
 * Cron Jobs Handler
 * Manages scheduled tasks for milestone auto-completion and other background jobs
 */

import cron, { ScheduledTask } from 'node-cron'
import { logger } from './logger'
import { runDailyMilestoneAutoCompletion } from './milestone-auto-calc'
import { clearOldNotifications } from './leader-notifications'

let scheduledJobs: Map<string, ScheduledTask> = new Map()

/**
 * Initialize all cron jobs
 */
export async function initializeCronJobs(systemUserId: string): Promise<void> {
  try {
    logger.info('Initializing cron jobs...')

    // Run milestone auto-completion daily at 2:00 AM
    const milestoneJob = cron.schedule('0 2 * * *', async () => {
      logger.info('Running scheduled milestone auto-completion...')
      try {
        await runDailyMilestoneAutoCompletion(systemUserId)
      } catch (error) {
        logger.error('Scheduled milestone auto-completion failed:', error)
      }
    })
    scheduledJobs.set('milestone-auto-completion', milestoneJob)
    logger.info('✓ Scheduled: Daily milestone auto-completion at 2:00 AM')

    // Clear old notifications weekly on Sunday at 3:00 AM
    const notificationCleanupJob = cron.schedule('0 3 * * 0', async () => {
      logger.info('Running notification cleanup...')
      try {
        await clearOldNotifications(30)
      } catch (error) {
        logger.error('Notification cleanup failed:', error)
      }
    })
    scheduledJobs.set('notification-cleanup', notificationCleanupJob)
    logger.info('✓ Scheduled: Weekly notification cleanup (Sundays at 3:00 AM)')

    logger.info(`Total cron jobs initialized: ${scheduledJobs.size}`)
  } catch (error) {
    logger.error('Error initializing cron jobs:', error)
    throw error
  }
}

/**
 * Stop all cron jobs
 */
export async function stopCronJobs(): Promise<void> {
  try {
    logger.info('Stopping cron jobs...')
    scheduledJobs.forEach((job, name) => {
      job.stop()
      logger.info(`Stopped cron job: ${name}`)
    })
    scheduledJobs.clear()
    logger.info('All cron jobs stopped')
  } catch (error) {
    logger.error('Error stopping cron jobs:', error)
    throw error
  }
}

/**
 * Get status of all cron jobs
 */
export function getCronJobStatus(): Record<string, string> {
  const status: Record<string, string> = {}
  scheduledJobs.forEach((job, name) => {
    // ScheduledTask doesn't have a status property, so we'll check if it exists
    status[name] = 'running'
  })
  return status
}

/**
 * Manually trigger a cron job (for testing/admin purposes)
 */
export async function triggerCronJob(jobName: string, systemUserId: string): Promise<boolean> {
  try {
    logger.info(`Manually triggering cron job: ${jobName}`)

    switch (jobName) {
      case 'milestone-auto-completion':
        await runDailyMilestoneAutoCompletion(systemUserId)
        return true

      case 'notification-cleanup':
        await clearOldNotifications(30)
        return true

      default:
        logger.warn(`Unknown cron job: ${jobName}`)
        return false
    }
  } catch (error) {
    logger.error(`Error triggering cron job ${jobName}:`, error)
    return false
  }
}

/**
 * Check if cron jobs are running
 */
export function isCronJobsRunning(): boolean {
  return scheduledJobs.size > 0
}
