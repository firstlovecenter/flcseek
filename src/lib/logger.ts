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
  info: (...args: unknown[]) => {
    if (!isProduction || enableProductionLogs) {
      console.log('[INFO]', ...args);
    }
  },

  /**
   * Log debug messages (always suppressed in production)
   */
  debug: (...args: unknown[]) => {
    if (!isProduction) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Log warning messages (always shown)
   */
  warn: (...args: unknown[]) => {
    console.warn('[WARN]', ...args);
  },

  /**
   * Log error messages (always shown)
   */
  error: (...args: unknown[]) => {
    console.error('[ERROR]', ...args);
  },

  /**
   * Log security-related messages (always shown but sanitized in production)
   */
  security: (message: string, data?: unknown) => {
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
  audit: (action: string, userId?: string, details?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    console.log('[AUDIT]', { timestamp, action, userId, ...details });
  },
};

/**
 * Conditional console.log replacement
 * Only logs in development
 */
export function devLog(...args: unknown[]) {
  if (!isProduction) {
    console.log(...args);
  }
}

/**
 * Always log important information
 */
export function importantLog(...args: unknown[]) {
  console.log(...args);
}

export default logger;
