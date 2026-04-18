// templates/nextjs-supabase/files/lib/errors.test.ts
import { describe, it, expect } from 'vitest';
import { AppError, ForbiddenError, UnauthorizedError, ValidationError, NotFoundError } from './errors';

describe('AppError hierarchy', () => {
  it('ForbiddenError → 403', () => {
    const e = new ForbiddenError('nope');
    expect(e.statusCode).toBe(403);
    expect(e.message).toBe('nope');
    expect(e).toBeInstanceOf(AppError);
    expect(e).toBeInstanceOf(Error);
  });

  it('UnauthorizedError → 401', () => {
    expect(new UnauthorizedError().statusCode).toBe(401);
  });

  it('ValidationError → 400 and exposes issues', () => {
    const e = new ValidationError('bad input', [{ path: 'email', message: 'invalid' }]);
    expect(e.statusCode).toBe(400);
    expect(e.issues).toEqual([{ path: 'email', message: 'invalid' }]);
  });

  it('NotFoundError → 404', () => {
    expect(new NotFoundError().statusCode).toBe(404);
  });

  it('stack trace is captured', () => {
    expect(new ForbiddenError('x').stack).toMatch(/ForbiddenError/);
  });
});
