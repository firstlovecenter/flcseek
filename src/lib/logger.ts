/**
 * Production-aware logger utility
 * Logs are suppressed in production unless explicitly enabled
 */

const isProduction = process.env.NODE_ENV === 'production';
const enableProductionLogs = process.env.ENABLE_PRODUCTION_LOGS === 'true';

/**
 * Logger utility that respects environment
 * In production, logs are suppressed unless ENABLE_PRODUCTION_LOGS is set
 */
export const logger = {
  /**
   * Log info messages (suppressed in production)
   */
  info: (...args: any[]) => {
    if (!isProduction || enableProductionLogs) {
      console.log('[INFO]', ...args);
    }
  },

  /**
   * Log debug messages (always suppressed in production)
   */
  debug: (...args: any[]) => {
    if (!isProduction) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Log warning messages (always shown)
   */
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },

  /**
   * Log error messages (always shown)
   */
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  },

  /**
   * Log security-related messages (always shown but sanitized in production)
   */
  security: (message: string, data?: any) => {
    if (isProduction) {
      // In production, log minimal security info
      console.log('[SECURITY]', message);
    } else {
      // In development, log full details
      console.log('[SECURITY]', message, data || '');
    }
  },

  /**
   * Log audit trail (always logged)
   */
  audit: (action: string, userId?: string, details?: any) => {
    const timestamp = new Date().toISOString();
    console.log('[AUDIT]', { timestamp, action, userId, ...details });
  },
};

/**
 * Conditional console.log replacement
 * Only logs in development
 */
export function devLog(...args: any[]) {
  if (!isProduction) {
    console.log(...args);
  }
}

/**
 * Always log important information
 */
export function importantLog(...args: any[]) {
  console.log(...args);
}

export default logger;
