/**
 * Hash + canonical-serialization helpers.
 *
 * Closes APTS-AR-010 (Cryptographic Hashing of All Evidence) +
 * APTS-AR-012 (Tamper-Evident Logging with Hash Chains) jointly with
 * runtime/chain.ts.
 *
 * Design notes:
 *   - SHA-256 (Node `crypto` module). FIPS 180-4 + RFC 6234.
 *   - Canonical JSON: sorted keys recursively, no whitespace. Two
 *     semantically-equal objects always serialize to the same string.
 *   - The `this_hash` field is excluded from the canonical input — you
 *     cannot include the hash in its own preimage.
 *   - Used by both per-event chain (chain.ts) and per-finding evidence
 *     hash (events.ts findingEvent).
 */
import { createHash } from 'node:crypto';

/**
 * SHA-256 hash of a UTF-8 string, returned as lowercase hex.
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

/**
 * Canonicalize an arbitrary JSON-shaped value: sort keys at every depth,
 * no whitespace, no surprising number formatting. Returns a string suitable
 * for hashing.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(canonicalNormalize(value));
}

/**
 * Hash a JSON-shaped value's canonical form. Convenience wrapper over
 * sha256(canonicalize(value)).
 */
export function hashCanonical(value: unknown): string {
  return sha256(canonicalize(value));
}

/**
 * Recursively normalize an object so JSON.stringify produces a stable form.
 * - Plain objects: keys sorted lexicographically; values recursed.
 * - Arrays: order preserved, elements recursed.
 * - Primitives + null: returned as-is.
 * - Undefined values + functions are dropped (matching JSON.stringify's
 *   own behavior, but here we make it explicit so the canonicalization
 *   is consistent across runtimes).
 */
function canonicalNormalize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const t = typeof value;
  if (t === 'string' || t === 'boolean' || t === 'number') return value;
  if (Array.isArray(value)) return value.map(canonicalNormalize);
  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const v = obj[k];
      if (v === undefined || typeof v === 'function') continue;
      out[k] = canonicalNormalize(v);
    }
    return out;
  }
  return null;
}
