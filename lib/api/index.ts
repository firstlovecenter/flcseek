/**
 * API Utilities - Central Export
 * Import from '@/lib/api' for all API-related utilities
 */

// Response utilities
export {
  success,
  created,
  error,
  errors,
  withErrorHandler,
  ErrorCodes,
  type ApiSuccessResponse,
  type ApiErrorResponse,
  type ApiResponse,
  type ErrorCode,
} from './response';

// Middleware utilities
export {
  getAuthUser,
  requireAuth,
  requireRole,
  requireMinRole,
  requireAdmin,
  requireSuperAdmin,
  hasMinRole,
  getQueryParams,
  getEffectiveGroupFilter,
  type AuthenticatedRequest,
} from './middleware';

// Validation utilities
export {
  validateRequired,
  validateString,
  validateEmail,
  validatePhone,
  validateUUID,
  validateInt,
  validateYear,
  validateRole,
  combineValidations,
  validatePersonData,
  validateUserData,
  validateGroupData,
  type ValidationResult,
} from './validators';

// Client-side API utilities (browser only)
export { api, type APIResponse } from './client';
