'use client'

/**
 * Browser client for /api/ccg/*. Auth rides on the httpOnly cookie. Never
 * throws for HTTP errors: returns { ok: false, error } with the server's
 * code, message and details (e.g. zod fieldErrors) so forms can show them.
 */

export interface CcgApiError {
  code: string
  message: string
  details?: { fieldErrors?: Record<string, string[]>; answers?: Record<string, string>; reason?: string } & Record<string, unknown>
}

export type CcgResult<T> = { ok: true; data: T; meta?: Record<string, unknown> } | { ok: false; error: CcgApiError; status: number }

async function call<T>(method: string, path: string, body?: unknown): Promise<CcgResult<T>> {
  try {
    const res = await fetch(`/api/ccg${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || json?.success === false) {
      return {
        ok: false,
        status: res.status,
        error: json?.error ?? { code: 'HTTP_' + res.status, message: json?.error?.message ?? 'Something went wrong' },
      }
    }
    return { ok: true, data: json?.data as T, meta: json?.meta }
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Could not reach the server' } }
  }
}

export const ccgApi = {
  get: <T>(path: string) => call<T>('GET', path),
  post: <T>(path: string, body?: unknown) => call<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => call<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => call<T>('PUT', path, body),
  del: <T>(path: string) => call<T>('DELETE', path),
}

/** First message per field from a validation error. */
export function fieldErrors(err: CcgApiError | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(err?.details?.fieldErrors ?? {})) if (v?.[0]) out[k] = v[0]
  return out
}
