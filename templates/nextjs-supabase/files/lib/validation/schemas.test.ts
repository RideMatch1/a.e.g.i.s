// templates/nextjs-supabase/files/lib/validation/schemas.test.ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodStrict, ExampleResourceSchema, zodToValidationError } from './schemas';
import { ValidationError } from '../errors';

const VALID_UUID_A = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_B = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

describe('zodStrict', () => {
  it('accepts valid input', () => {
    const Schema = zodStrict({ name: z.string().min(1) });
    expect(() => Schema.parse({ name: 'test-name' })).not.toThrow();
  });

  it('rejects unknown keys', () => {
    const Schema = zodStrict({ name: z.string().min(1) });
    expect(() => Schema.parse({ name: 'test-name', extra: 1 })).toThrow();
  });

  it('rejects missing required fields', () => {
    const Schema = zodStrict({ name: z.string().min(1), count: z.number() });
    expect(() => Schema.parse({ name: 'test-name' })).toThrow();
  });
});

describe('ExampleResourceSchema', () => {
  it('accepts a valid resource', () => {
    const input = {
      id: VALID_UUID_A,
      tenantId: VALID_UUID_B,
      name: 'test-name',
      description: 'test-description',
      createdAt: '2026-04-18T00:00:00Z',
    };
    expect(() => ExampleResourceSchema.parse(input)).not.toThrow();
  });

  it('rejects a resource with a non-UUID id', () => {
    const input = {
      id: 'not-a-uuid',
      tenantId: VALID_UUID_B,
      name: 'test-name',
      createdAt: '2026-04-18T00:00:00Z',
    };
    expect(() => ExampleResourceSchema.parse(input)).toThrow();
  });

  it('rejects a resource with an extra unknown key', () => {
    const input = {
      id: VALID_UUID_A,
      tenantId: VALID_UUID_B,
      name: 'test-name',
      createdAt: '2026-04-18T00:00:00Z',
      extraField: 'x',
    };
    expect(() => ExampleResourceSchema.parse(input)).toThrow();
  });
});

describe('zodToValidationError', () => {
  it('produces a ValidationError with populated issues', () => {
    const Schema = zodStrict({ name: z.string().min(1), count: z.number() });
    const result = Schema.safeParse({ name: '', count: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const err = zodToValidationError(result.error);
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.issues.length).toBeGreaterThan(0);
      for (const issue of err.issues) {
        expect(typeof issue.path).toBe('string');
        expect(typeof issue.message).toBe('string');
      }
    }
  });

  it('joins nested paths correctly', () => {
    const Schema = zodStrict({
      items: z.array(zodStrict({ name: z.string().min(1) })),
    });
    const result = Schema.safeParse({ items: [{ name: '' }] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const err = zodToValidationError(result.error);
      const paths = err.issues.map((i) => i.path);
      expect(paths).toContain('items.0.name');
    }
  });
});
