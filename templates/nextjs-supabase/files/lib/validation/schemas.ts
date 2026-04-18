// Reference-implementation extract — generic Next.js+Supabase primitive.
import { z } from 'zod';
import { ValidationError } from '../errors';

/**
 * Sugar over `z.object(shape).strict()`. Every request-body / query-params
 * schema in the scaffold should wrap its shape with this helper so that
 * unknown keys are rejected instead of silently dropped. Prevents mass-
 * assignment drift where a client smuggles in fields the API did not
 * declare.
 */
export function zodStrict<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).strict();
}

/**
 * Canonical scaffold schema. Demonstrates the expected field-naming
 * convention (camelCase in application code, snake_case only at the DB
 * boundary) and the standard metadata columns every tenant-scoped
 * resource carries.
 */
export const ExampleResourceSchema = zodStrict({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  createdAt: z.string().datetime(),
});

export type ExampleResource = z.infer<typeof ExampleResourceSchema>;

/**
 * Convert a `ZodError` into the scaffold's `ValidationError`, flattening
 * the issue list into `{ path, message }` pairs ready for JSON serialisation.
 * Nested paths are joined with `.` (e.g. `items.0.name`).
 */
export function zodToValidationError(err: z.ZodError): ValidationError {
  const issues = err.issues.map((i) => ({
    path: i.path.join('.'),
    message: i.message,
  }));
  return new ValidationError('Input validation failed', issues);
}
