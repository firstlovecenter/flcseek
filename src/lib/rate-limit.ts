/**
 * Rate Limiting Middleware for FLCSeek
 * Prevents brute force attacks and API abuse
 *
 * Two tiers:
 *  - In-memory (per serverless instance): cheap first line for the default
 *    API limit. Resets on cold start and is NOT shared across instances, so
 *    it is only ever a best-effort backstop.
 *  - Database-backed (shared): authoritative enforcement for security-critical
 *    endpoints (login brute force, data export, bulk delete). Uses an atomic
 *    upsert-increment on rate_limit_records so all instances share one count.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  message?: string;      // Custom error message
  /**
   * Enforce via the shared database counter. Required for anything
   * security-critical — the in-memory counter resets on every cold start
   * and is per-instance, so it cannot stop a distributed or sustained attack.
   */
  persist?: boolean;
}

// Rate limit configurations for different endpoints
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Login: 5 attempts per 15 minutes — DB-enforced (brute force protection)
  '/api/auth/login': {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    message: 'Too many login attempts. Please try again in 15 minutes.',
    persist: true,
  },
  // Data exports: 10 per hour per IP (prevents bulk data exfiltration)
  '/api/export': {
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    message: 'Export rate limit exceeded. Please wait before exporting again.',
    persist: true,
  },
  // Bulk destructive operations: 5 per hour per IP
  '/api/superadmin/converts/bulk-delete': {
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
    message: 'Bulk delete rate limit exceeded. Please wait before retrying.',
    persist: true,
  },
  // API default: 100 requests per minute (in-memory best effort only)
  'default': {
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: 'Too many requests. Please slow down.',
  },
};

// In-memory cache for rate limiting (faster than DB for high-frequency checks)
const rateLimitCache = new Map<string, { count: number; windowStart: number }>();

/**
 * Clean up expired entries from the cache
 */
function cleanupCache() {
  const now = Date.now();
  const entries = Array.from(rateLimitCache.entries());
  for (const [key, value] of entries) {
    // Find the config for this key to get windowMs
    const config = Object.entries(RATE_LIMITS).find(([path]) => key.includes(path))?.[1] || RATE_LIMITS.default;
    if (now - value.windowStart > config.windowMs) {
      rateLimitCache.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupCache, 5 * 60 * 1000);
}

/**
 * Get client identifier from request.
 *
 * Netlify sets x-nf-client-connection-ip from the actual connection — it is
 * not client-forgeable, unlike x-forwarded-for, which we only use as a
 * fallback for other hosting environments.
 */
export function getClientIdentifier(request: NextRequest): string {
  const netlifyIp = request.headers.get('x-nf-client-connection-ip');
  if (netlifyIp) {
    return netlifyIp.trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // Fallback to connection info or a default
  return 'unknown';
}

function buildLimitResponse(config: RateLimitConfig, windowStart: number, now: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((windowStart + config.windowMs - now) / 1000));

  return NextResponse.json(
    {
      error: config.message || 'Too many requests',
      retryAfter: retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(windowStart + config.windowMs).toISOString(),
      },
    }
  );
}

/**
 * Shared, cross-instance rate limit check backed by rate_limit_records.
 * Atomic: a single upsert increments and returns the current window's count,
 * so concurrent instances cannot race past the limit.
 * Fails open on DB errors (rate limiting must not take down login entirely),
 * leaving the in-memory check as backstop.
 */
async function checkDbRateLimitAtomic(
  clientId: string,
  path: string,
  config: RateLimitConfig,
  now: number
): Promise<NextResponse | null> {
  const windowStartMs = Math.floor(now / config.windowMs) * config.windowMs;
  const windowStart = new Date(windowStartMs);

  try {
    const record = await prisma.rateLimitRecord.upsert({
      where: {
        identifier_endpoint_windowStart: {
          identifier: clientId,
          endpoint: path,
          windowStart,
        },
      },
      update: { requestCount: { increment: 1 } },
      create: {
        identifier: clientId,
        endpoint: path,
        requestCount: 1,
        windowStart,
      },
    });

    const requestCount = record.requestCount ?? 1;

    // Opportunistic cleanup: when a fresh window starts, purge this endpoint's
    // expired rows so the table doesn't grow unbounded.
    if (requestCount === 1) {
      prisma.rateLimitRecord
        .deleteMany({
          where: { endpoint: path, windowStart: { lt: new Date(windowStartMs - config.windowMs) } },
        })
        .catch(() => {});
    }

    if (requestCount > config.maxRequests) {
      return buildLimitResponse(config, windowStartMs, now);
    }
    return null;
  } catch (error) {
    console.error('[rate-limit] DB check failed (failing open):', error);
    return null;
  }
}

/**
 * Check rate limit for a request
 * Returns null if within limit, or an error response if exceeded
 */
export async function checkRateLimit(
  request: NextRequest,
  endpoint?: string
): Promise<NextResponse | null> {
  const path = endpoint || new URL(request.url).pathname;
  const config = RATE_LIMITS[path] || RATE_LIMITS.default;
  const clientId = getClientIdentifier(request);
  const cacheKey = `${clientId}:${path}`;

  const now = Date.now();

  // In-memory fast path (per-instance backstop)
  let cacheEntry = rateLimitCache.get(cacheKey);

  if (!cacheEntry || (now - cacheEntry.windowStart) > config.windowMs) {
    // New window
    cacheEntry = { count: 1, windowStart: now };
    rateLimitCache.set(cacheKey, cacheEntry);
  } else {
    // Same window, increment count
    cacheEntry.count++;
    rateLimitCache.set(cacheKey, cacheEntry);
  }

  if (cacheEntry.count > config.maxRequests) {
    return buildLimitResponse(config, cacheEntry.windowStart, now);
  }

  // Authoritative shared check for security-critical endpoints
  if (config.persist) {
    return checkDbRateLimitAtomic(clientId, path, config, now);
  }

  return null; // Within limit
}

/**
 * Rate limit middleware wrapper for API routes
 */
export function withRateLimit(
  handler: (request: NextRequest, ...args: unknown[]) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: unknown[]) => {
    const rateLimitResponse = await checkRateLimit(request);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    return handler(request, ...args);
  };
}
