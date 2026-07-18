/**
 * Test environment setup. Runs before any test file is imported.
 *
 * Modules under test transitively import '@/lib/prisma', which instantiates
 * the Prisma client at import time from NEON_DATABASE_URL. No connection is
 * opened until a query runs, so a placeholder URL is enough for unit tests
 * that never touch the database.
 */
process.env.NEON_DATABASE_URL =
  process.env.NEON_DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'vitest-secret-not-for-production-use';
