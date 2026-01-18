/**
 * Rate Limiting Middleware for FLCSeek
 * Prevents brute force attacks and API abuse
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  message?: string;      // Custom error message
}

// Rate limit configurations for different endpoints
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Login: 5 attempts per 15 minutes
  '/api/auth/login': {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
  // API default: 100 requests per minute
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
 * Get client identifier from request
 */
export function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from various headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  // Fallback to connection info or a default
  return 'unknown';
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
  
  // Check in-memory cache first
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
  
  // Check if limit exceeded
  if (cacheEntry.count > config.maxRequests) {
    const retryAfter = Math.ceil((cacheEntry.windowStart + config.windowMs - now) / 1000);
    
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
          'X-RateLimit-Reset': new Date(cacheEntry.windowStart + config.windowMs).toISOString(),
        },
      }
    );
  }
  
  return null; // Within limit
}

/**
 * Rate limit middleware wrapper for API routes
 */
export function withRateLimit(
  handler: (request: NextRequest, ...args: unknown[]) => Promise<NextResponse>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _customConfig?: RateLimitConfig
) {
  return async (request: NextRequest, ...args: unknown[]) => {
    const rateLimitResponse = await checkRateLimit(request);
    
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    return handler(request, ...args);
  };
}

/**
 * Persist rate limit to database (for distributed systems)
 * Call this for critical endpoints like login
 */
export async function persistRateLimitToDb(
  identifier: string,
  endpoint: string
): Promise<void> {
  try {
    const windowStart = new Date();
    windowStart.setMinutes(Math.floor(windowStart.getMinutes() / 15) * 15, 0, 0); // 15-minute windows
    
    await prisma.rateLimitRecord.upsert({
      where: {
        identifier_endpoint_windowStart: {
          identifier,
          endpoint,
          windowStart,
        }
      },
      update: {
        requestCount: { increment: 1 }
      },
      create: {
        identifier,
        endpoint,
        requestCount: 1,
        windowStart,
      }
    });
  } catch (error) {
    console.error('Failed to persist rate limit:', error);
    // Don't throw - rate limiting shouldn't break the app
  }
}

/**
 * Check rate limit from database (for distributed systems)
 */
export async function checkDbRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<boolean> {
  try {
    const windowStart = new Date();
    windowStart.setMinutes(Math.floor(windowStart.getMinutes() / 15) * 15, 0, 0);
    
    const record = await prisma.rateLimitRecord.findUnique({
      where: {
        identifier_endpoint_windowStart: {
          identifier,
          endpoint,
          windowStart,
        }
      }
    });
    
    const count = record?.requestCount || 0;
    return count >= config.maxRequests;
  } catch (error) {
    console.error('Failed to check DB rate limit:', error);
    return false; // Allow on error
  }
}
