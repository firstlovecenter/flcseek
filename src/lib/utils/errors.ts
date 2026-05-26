/**
 * Error message extraction utility.
 * Use this in catch blocks instead of typing `error` as `any`.
 *
 * @example
 * try { ... } catch (error: unknown) {
 *   message.error(getErrorMessage(error));
 * }
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred';
}
