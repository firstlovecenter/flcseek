import { errors, error as apiError, ErrorCodes } from '@/lib/api/response'

export type CcgErrorCode = 'not_found' | 'validation' | 'conflict' | 'forbidden'

/** Domain error thrown by CCG services; the route wrappers map it to a response. */
export class CcgError extends Error {
  constructor(
    public code: CcgErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message)
  }
}

export const notFound = (what: string) => new CcgError('not_found', `${what} not found`)
export const forbidden = (msg = 'You do not have permission for this action') => new CcgError('forbidden', msg)
export const invalid = (msg: string, details?: unknown) => new CcgError('validation', msg, details)
export const conflict = (msg: string, details?: unknown) => new CcgError('conflict', msg, details)

export function ccgErrorResponse(err: CcgError) {
  switch (err.code) {
    case 'not_found':
      return apiError(ErrorCodes.NOT_FOUND, err.message)
    case 'validation':
      return errors.validation(err.message, err.details)
    case 'conflict':
      return apiError(ErrorCodes.CONFLICT, err.message, err.details)
    case 'forbidden':
      return errors.forbidden(err.message)
  }
}

/** Map Prisma unique / FK violations to CcgErrors; null when not one. */
export function fromPrismaError(err: unknown): CcgError | null {
  const code = typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined
  if (code === 'P2002') return conflict('A record with that value already exists')
  if (code === 'P2003') return invalid('A referenced record does not exist')
  if (code === 'P2025') return notFound('Record')
  return null
}
