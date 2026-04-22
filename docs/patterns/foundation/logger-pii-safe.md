---
name: logger-pii-safe
category: foundation
title: PII-Safe Logger (deep-sanitize, cyclic-safe)
description: >
  Structured logger that automatically redacts sensitive keys at any nesting depth.
  Safe against cyclic references via WeakSet. Redacts 30+ default patterns (passwords,
  tokens, emails, phone-numbers) plus project-specific additions.
version: 1
dependencies:
  npm: []
placeholders:
  - name: PROJECT_NAME
    description: The project identifier (kebab-case, from wizard). Used in file-headers and path hints.
    required: true
  - name: EXTRA_SENSITIVE_KEYS_JSON
    description: JSON-encoded list of extra field-name patterns to redact (substring-match, case-insensitive).
    default: '[]'
    type: json
brief_section: Foundation
estimated_files: 1
tags: [logging, pii, dsgvo, security]
related:
  - foundation/multi-tenant-supabase
  - compliance/dsgvo-kit
---

# PII-Safe Logger

Logging with user-data is a DSGVO minefield. A single `console.log(user)` can leak emails, phone-numbers, or payment-info into log-aggregators where they live forever.

This logger auto-redacts 30+ sensitive key-patterns at any nesting depth. Cycle-safe. Email-specific redaction (first-char + domain visible for debugging). Development-stack-traces. Production-minimal.

**Zero-config usage.** Just `logger.info('message', { context })`. PII gets stripped automatically.

---

## Commands to run

No new dependencies. Pure-TypeScript.

---

## Files to create

### `src/lib/utils/logger.ts`

```typescript
/**
 * PII-Safe Logger — {{PROJECT_NAME}}
 *
 * Deep-sanitize nested objects (redacts passwords/tokens/PII at any depth)
 * Email redaction (first char + domain visible for debug)
 * Cycle-safe (WeakSet)
 * Dev-mode: includes stack-traces on errors
 *
 * SERVER-SIDE ONLY — prevents PII leaks into logs.
 * Never use in client-code (use console directly there).
 */

interface LogContext {
  userId?: string;
  email?: string;
  action?: string;
  [key: string]: unknown;
}

/**
 * Substring-match patterns for sensitive keys. Case-insensitive.
 * Extend via EXTRA_SENSITIVE_KEYS placeholder during scaffold.
 */
const SENSITIVE_KEY_PATTERNS = [
  // Auth / tokens
  'password', 'passwd', 'secret', 'token', 'authorization',
  'apikey', 'api_key', 'private_key', 'client_secret', 'session',
  'cookie', 'bearer', 'refresh_token', 'access_token', 'id_token',

  // Payment / finance
  'iban', 'bic', 'credit_card', 'cvv', 'cvc', 'card_number',
  'account_number', 'routing_number',

  // Identity / personal
  'ssn', 'social_security', 'passport', 'id_number', 'tax_id',
  'birth_date', 'birthdate', 'date_of_birth',
  'phone', 'phone_number', 'mobile',
  'address', 'street', 'postal_code', 'zip',
  'emergency_contact', 'next_of_kin',

  // Health
  'health_insurance', 'insurance_number', 'medical', 'diagnosis',

  // HR (add/remove per your domain)
  'hourly_rate', 'monthly_salary', 'salary', 'tax_class',

  // Extra project-specific
  ...{{EXTRA_SENSITIVE_KEYS_JSON}},
];

const MAX_DEPTH = 5;

export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((p) => lower.includes(p));
}

export function redactValue(value: unknown): unknown {
  if (typeof value === 'string' && value.length > 4) {
    return `${value.substring(0, 2)}***${value.substring(value.length - 2)}`;
  }
  return '[redacted]';
}

export function redactEmail(value: string): string {
  const [user, domain] = value.split('@');
  return user && domain ? `${user[0]}***@${domain}` : '[redacted]';
}

function sanitizeValue(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
  parentKey?: string,
): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value !== 'object') {
    // Email-string detection via parent-key hint
    if (typeof value === 'string' && parentKey && parentKey.toLowerCase().includes('email')) {
      return redactEmail(value);
    }
    return value;
  }

  if (depth >= MAX_DEPTH) return '[max-depth]';
  if (seen.has(value as object)) return '[circular]';
  seen.add(value as object);

  // Binary blobs
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) return '[binary]';

  // Errors get structured representation
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(process.env.NODE_ENV === 'development' && { stack: value.stack }),
    };
  }

  // Dates as ISO-strings
  if (value instanceof Date) return value.toISOString();

  // Arrays
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen, depth + 1));
  }

  // Plain objects
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = redactValue(val);
    } else if (key.toLowerCase().includes('email') && typeof val === 'string') {
      result[key] = redactEmail(val);
    } else {
      result[key] = sanitizeValue(val, seen, depth + 1, key);
    }
  }
  return result;
}

function sanitizeContext(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;
  const seen = new WeakSet<object>();
  return sanitizeValue(context, seen, 0) as LogContext;
}

/**
 * Logger public API. Use across all server-code.
 *
 * Examples:
 *   logger.info('User logged in', { userId, email });  // email auto-redacted
 *   logger.warn('Rate limit exceeded', { ip, route });
 *   logger.error('DB query failed', err, { query: q });
 *   logger.debug('Cache miss', { key });  // only visible in dev
 */
export const logger = {
  info: (message: string, context?: LogContext) => {
    console.log('[INFO]', message, sanitizeContext(context) || '');
  },
  warn: (message: string, context?: LogContext) => {
    console.warn('[WARN]', message, sanitizeContext(context) || '');
  },
  error: (message: string, error?: Error | unknown, context?: LogContext) => {
    const errorDetails =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
          }
        : error !== undefined
          ? sanitizeValue(error, new WeakSet(), 0)
          : undefined;
    console.error('[ERROR]', message, errorDetails, sanitizeContext(context) || '');
  },
  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[DEBUG]', message, sanitizeContext(context) || '');
    }
  },
};
```

---

## Usage examples

```typescript
import { logger } from '@/lib/utils/logger';

// Nested PII automatically redacted at any depth
logger.info('Payment processed', {
  userId: 'u1',
  customer: {
    email: 'alice@example.com',       // → a***@example.com
    phone: '+491234567890',            // → [redacted]
    address_street: '123 Main',        // → [redacted]
  },
  metadata: {
    api_key: 'sk_live_abc123',        // → sk***23
  },
});

// Errors get structured form
try {
  await doSomething();
} catch (err) {
  logger.error('Operation failed', err, { userId: 'u1' });
}

// Debug only in dev-mode
logger.debug('Cache hit', { key: 'user:u1' });
```

---

## Redaction behavior

| Input | Output |
|---|---|
| `{password: "secret123"}` | `{password: "se***23"}` |
| `{email: "alice@example.com"}` | `{email: "a***@example.com"}` |
| `{nested: {api_key: "abc"}}` | `{nested: {api_key: "[redacted]"}}` |
| `{phone: "+491234"}` | `{phone: "+4***34"}` (4-char threshold) |
| `{birth_date: "1990-01-01"}` | `{birth_date: "19***01"}` |
| `{circular}` (ref to self) | `{circular: "[circular]"}` |
| `new Uint8Array(...)` | `"[binary]"` |
| `new Error('oops')` (prod) | `{name: "Error", message: "oops"}` |
| `new Error('oops')` (dev) | `{name, message, stack}` |
| deeply-nested 6+ levels | `"[max-depth]"` at level 6 |

---

## Test example

```typescript
// src/lib/utils/__tests__/logger.test.ts
import { describe, it, expect, vi } from 'vitest';
import { logger, redactValue, redactEmail, isSensitiveKey } from '../logger';

describe('logger PII redaction', () => {
  it('redacts password at top level', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('test', { password: 'supersecret123' });
    expect(spy).toHaveBeenCalledWith('[INFO]', 'test', expect.objectContaining({ password: 'su***23' }));
    spy.mockRestore();
  });

  it('redacts email at top level', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('test', { email: 'alice@example.com' });
    expect(spy).toHaveBeenCalledWith('[INFO]', 'test', expect.objectContaining({ email: 'a***@example.com' }));
    spy.mockRestore();
  });

  it('redacts nested api_key', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('test', { nested: { api_key: 'secretkey' } });
    expect(spy).toHaveBeenCalledWith('[INFO]', 'test', expect.objectContaining({
      nested: expect.objectContaining({ api_key: 'se***ey' }),
    }));
    spy.mockRestore();
  });

  it('handles cyclic references', () => {
    const a: Record<string, unknown> = { name: 'test' };
    a.self = a;  // cycle
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => logger.info('cyclic', a)).not.toThrow();
    spy.mockRestore();
  });

  it('handles deep nesting', () => {
    const nest = { a: { b: { c: { d: { e: { f: { g: 'deep' } } } } } } };
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('deep', nest);
    // Verify [max-depth] appears somewhere in the sanitized output
    const firstArg = spy.mock.calls[0]![2] as Record<string, unknown>;
    const serialized = JSON.stringify(firstArg);
    expect(serialized).toMatch(/\[max-depth\]/);
    spy.mockRestore();
  });

  it('isSensitiveKey catches substrings', () => {
    expect(isSensitiveKey('password')).toBe(true);
    expect(isSensitiveKey('PASSWORD')).toBe(true);
    expect(isSensitiveKey('user_password_hash')).toBe(true);
    expect(isSensitiveKey('full_name')).toBe(false);
  });

  it('redactValue short strings returns full redact', () => {
    expect(redactValue('ab')).toBe('[redacted]');
    expect(redactValue(12345)).toBe('[redacted]');
    expect(redactValue('abcdef')).toBe('ab***ef');
  });
});
```

---

## Common pitfalls

1. **Using `console.log` directly instead of `logger`.** Bypasses all redaction. Linter-rule suggested: ban `console.*` in production code-paths.
2. **Custom field-name that doesn't match patterns.** e.g. `customerEmailAddress` — redacted ONLY if you add `email` pattern (which is default). Check substrings.
3. **Logging full request-body on errors.** Request-bodies contain user-inputs, including passwords on login-routes. Use `sanitizeBody()` before logging.
4. **Assuming `[redacted]` means the value is gone.** The fact that a sensitive key EXISTS is still metadata. If you log `{password: "[redacted]"}`, the log still shows an attempt to auth with that email. Don't log entire auth-payloads at all.
5. **Not testing with cyclic objects.** Some ORMs (TypeORM, Prisma-legacy) can produce cyclic results. Test with a real repo-response.
6. **Using this logger in client-side code.** It will work but logs end up in browser-console, which isn't where you want sensitive-handling anyway. Client-logging should be minimal and shipped to an error-tracker like Sentry which has its own redaction.

---

## Production upgrade: structured-logging for aggregators

The default `console.log` output is human-readable. For log-aggregators (Datadog, Axiom, Loki), switch to JSON output:

```typescript
// Replace console.log(...) with:
console.log(JSON.stringify({
  level: 'info',
  message,
  timestamp: new Date().toISOString(),
  context: sanitizeContext(context),
  service: '{{PROJECT_NAME}}',
}));
```

Or integrate pino / winston — both have built-in redaction that complements (not replaces) this logger.

---

## Related patterns

- `foundation/multi-tenant-supabase` — the tenant-guard uses logger for auth-failures
- `foundation/middleware-hardened` — middleware logs rate-limit hits
- `compliance/dsgvo-kit` — DSGVO audit-log uses logger; redaction ensures DSGVO-compliance on logs

---

## Quality-gate

```bash
# Tests pass
npm run test -- logger

# Grep for console.log usage outside logger (should be near-zero)
grep -rn "console\." src/lib src/app/api --include="*.ts" | grep -v "logger.ts"
# expect: only inside logger.ts itself

# AEGIS scan
npx -y @aegis-scan/cli scan . --focus logging
```

---

**Pattern version: 1 · Last-updated: 2026-04-22 · AEGIS-foundation**
