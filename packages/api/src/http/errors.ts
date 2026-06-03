import type { ZodError } from 'zod';

// Typed API error carrying the contract's status + stable code (+ optional
// per-field details). The errorHandler middleware serialises it to the contract
// envelope (spec/api/00-conventions.md).
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, string>,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

/** Flatten a ZodError into `{ field: reason }` for a 422 `details` payload. */
export function zodDetails(error: ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join('.') || '_';
    details[field] ??= issue.message;
  }
  return details;
}
