// Reference-implementation extract — generic Next.js+Supabase primitive.

/**
 * PII-sanitizing logger for server-side code.
 *
 * Walks `meta` objects of arbitrary shape and redacts any value whose key
 * matches a sensitive-key substring (case-insensitive). Safe against
 * unbounded depth (MAX_DEPTH cap) and circular references (WeakSet).
 *
 * Key-match is substring-based — e.g. the pattern `password` also matches
 * `user_password_hash`, `oldPassword`, `new_password_1`. This is
 * intentional: logging helpers should over-redact rather than leak.
 *
 * SERVER-SIDE ONLY. Do not import into client bundles.
 */

const SENSITIVE_KEY_PATTERNS: readonly string[] = [
  // Authentication / secrets
  'password', 'passwd', 'secret', 'token', 'authorization',
  'bearer', 'apikey', 'api_key', 'private_key', 'client_secret',
  'session', 'cookie', 'refresh_token', 'access_token', 'jwt',
  // Financial / account
  'iban', 'credit_card', 'cvv', 'routing_number', 'account_number',
  // Personal identifiers
  'ssn', 'social_security', 'national_id', 'passport',
  'id_number', 'tax_id', 'driver_license',
  // Contact info
  'phone', 'phone_number', 'mobile', 'address', 'street',
  'postal_code', 'zip', 'city',
  // Personal names
  'full_name', 'first_name', 'last_name',
  // Dates of birth
  'birth_date', 'birthdate', 'date_of_birth', 'dob',
  // Health / insurance (generic HR/benefits shape)
  'health_insurance', 'insurance_number',
  // Salary / HR
  'salary', 'hourly_rate', 'monthly_salary', 'tax_class',
  // Emergency contact
  'emergency_contact', 'next_of_kin',
];

const MAX_DEPTH = 5;

// Normalize key and patterns by stripping underscores / hyphens before
// substring match. Without this, snake_case patterns (first_name) would
// miss camelCase keys (firstName) — a silent under-redaction of PII in
// TypeScript codebases where camelCase is the cultural default.
// Pre-normalize patterns once at module load so runtime cost is O(n)
// single scan per isSensitiveKey call.
const NORMALIZED_PATTERNS: readonly string[] = SENSITIVE_KEY_PATTERNS.map(
  (p) => p.replace(/[_-]/g, ''),
);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, '');
}

export function isSensitiveKey(key: string): boolean {
  if (!key) return false;
  const normalized = normalizeKey(key);
  return NORMALIZED_PATTERNS.some((p) => normalized.includes(p));
}

export function redactValue(value: unknown): unknown {
  if (typeof value === 'string' && value.length > 4) {
    return `${value.substring(0, 2)}***${value.substring(value.length - 2)}`;
  }
  return '[redacted]';
}

export function redactEmail(value: string): string {
  if (typeof value !== 'string' || value.length === 0) return '[redacted]';
  const [user, domain] = value.split('@');
  if (!user || !domain || value.split('@').length !== 2) return '[redacted]';
  return `${user[0]}***@${domain}`;
}

function sanitizeValue(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  if (depth >= MAX_DEPTH) return '[max-depth-exceeded]';
  if (seen.has(value as object)) return '[circular]';
  seen.add(value as object);

  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = redactValue(val);
    } else if (key.toLowerCase().includes('email') && typeof val === 'string') {
      result[key] = redactEmail(val);
    } else {
      result[key] = sanitizeValue(val, seen, depth + 1);
    }
  }
  return result;
}

function sanitizeMeta(meta: unknown): unknown {
  if (meta === undefined) return undefined;
  return sanitizeValue(meta, new WeakSet(), 0);
}

function format(level: string, message: string, meta: unknown): string {
  const sanitized = sanitizeMeta(meta);
  const payload =
    sanitized === undefined
      ? { level, message }
      : { level, message, meta: sanitized };
  return JSON.stringify(payload);
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>): void => {
    console.log(format('info', message, meta));
  },
  warn: (message: string, meta?: Record<string, unknown>): void => {
    console.warn(format('warn', message, meta));
  },
  error: (message: string, meta?: unknown): void => {
    console.error(format('error', message, meta));
  },
  debug: (message: string, meta?: Record<string, unknown>): void => {
    console.debug(format('debug', message, meta));
  },
};
