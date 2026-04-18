// templates/nextjs-supabase/files/lib/errors.ts

/** Base class for every handler-producible error. HTTP-status-code
 *  aware so a single catch-to-response mapper can render all of them. */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  constructor(message = 'Forbidden') { super(message); }
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  constructor(message = 'Unauthorized') { super(message); }
}

export interface ValidationIssue { path: string; message: string; }

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly issues: readonly ValidationIssue[];
  constructor(message: string, issues: readonly ValidationIssue[] = []) {
    super(message);
    this.issues = issues;
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  constructor(message = 'Not Found') { super(message); }
}
