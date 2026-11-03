import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { getCloudflareContext } from '@opennextjs/cloudflare'

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.NEON_DATABASE_URL!
  // maxUses: 1 — on Cloudflare Workers a socket opened in one request cannot be
  // used by another, so pooled connections must never be reused.
  const adapter = new PrismaNeon({ connectionString, maxUses: 1 })

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
  })
}

/**
 * On Workers, one client per request (keyed by the request's ExecutionContext).
 * Outside a Worker request (next dev without the CF shim, vitest, scripts),
 * fall back to a single process-wide client.
 */
const perRequest = new WeakMap<object, PrismaClient>()
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function currentRequestKey(): object | undefined {
  try {
    return getCloudflareContext().ctx as unknown as object
  } catch {
    return undefined
  }
}

export function getPrisma(): PrismaClient {
  const key = currentRequestKey()
  if (key) {
    let client = perRequest.get(key)
    if (!client) {
      client = createPrismaClient()
      perRequest.set(key, client)
    }
    return client
  }
  return (globalForPrisma.prisma ??= createPrismaClient())
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma()
    const value = Reflect.get(client, prop, client)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
