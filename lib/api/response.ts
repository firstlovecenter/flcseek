import { NextResponse } from 'next/server';

/**
 * Standardized API Response Format
 * All API endpoints should use these response helpers for consistency
 */

// Standard success response structure
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
    hasMore?: boolean;
  };
}

// Standard error response structure  
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// Error codes for consistency
export const ErrorCodes = {
  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// HTTP status mapping
const ErrorStatusMap: Record<ErrorCode, number> = {
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.INVALID_TOKEN]: 401,
  [ErrorCodes.VALIDATION_ERROR]: 400,
  [ErrorCodes.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCodes.INVALID_INPUT]: 400,
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.ALREADY_EXISTS]: 409,
  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.INTERNAL_ERROR]: 500,
  [ErrorCodes.DATABASE_ERROR]: 500,
  [ErrorCodes.RATE_LIMITED]: 429,
};

/**
 * Create a success response with data
 */
export function success<T>(
  data: T,
  meta?: ApiSuccessResponse['meta'],
  headers?: Record<string, string>
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(meta && { meta }),
  };
  
  return NextResponse.json(response, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

/**
 * Create a success response for created resources
 */
export function created<T>(
  data: T,
  headers?: Record<string, string>
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    { success: true, data } as ApiSuccessResponse<T>,
    {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }
  );
}

/**
 * Create an error response
 */
export function error(
  code: ErrorCode,
  message: string,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const status = ErrorStatusMap[code] || 500;
  
  const errorPayload: ApiErrorResponse['error'] = {
    code,
    message,
  };
  
  if (details) {
    errorPayload.details = details;
  }
  
  return NextResponse.json(
    {
      success: false,
      error: errorPayload,
    } as ApiErrorResponse,
    { status }
  );
}

/**
 * Common error responses
 */
export const errors = {
  unauthorized: (message = 'Authentication required') =>
    error(ErrorCodes.UNAUTHORIZED, message),
    
  forbidden: (message = 'Access denied') =>
    error(ErrorCodes.FORBIDDEN, message),
    
  notFound: (resource = 'Resource') =>
    error(ErrorCodes.NOT_FOUND, `${resource} not found`),
    
  validation: (message: string, details?: unknown) =>
    error(ErrorCodes.VALIDATION_ERROR, message, details),
    
  internal: (message = 'An unexpected error occurred') =>
    error(ErrorCodes.INTERNAL_ERROR, message),
    
  database: (details?: unknown) =>
    error(ErrorCodes.DATABASE_ERROR, 'Database operation failed', details),
};

/**
 * Wrap async route handlers with error catching
 */
export function withErrorHandler<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | ApiErrorResponse>> {
  return handler().catch((err: unknown) => {
    console.error('[API Error]', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errors.internal(message);
  });
}
