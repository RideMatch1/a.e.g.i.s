/**
 * Configuration-file integrity verification.
 *
 * Closes APTS-MR-004 (Configuration File Integrity Verification) +
 * APTS-MR-012 (Immutable Scope Enforcement Architecture).
 *
 * Design notes:
 *   - At engagement-start, AEGIS pins a SHA-256 hash of the canonical
 *     form of every operator-supplied config (RoE + aegis.config.json).
 *     The pin is timestamped and emitted into the audit channel.
 *   - At every phase boundary, AEGIS re-hashes the in-memory config and
 *     compares against the pin. A mismatch indicates either a runtime
 *     mutation (memory tamper, plugin drift) or a stale fixture, and
 *     the engagement halts with an explicit reason.
 *   - MR-012 (immutable scope) is closed jointly: the SHA-256 pin
 *     covers RoE.in_scope/out_of_scope, so any post-pin change to
 *     scope is detected at the next verification.
 */
import { hashCanonical } from '../runtime/hash.js';

export interface ConfigPin {
  /** Lowercase-hex SHA-256 of the canonical-JSON serialization. */
  hash: string;
  /** ISO-8601 timestamp when the pin was created. */
  pinned_at: string;
  /** Operator-supplied label for audit traceability (e.g. "roe", "aegis-config"). */
  label: string;
}

export interface ConfigVerifyResult {
  ok: boolean;
  reason?: string;
  /** Hash that was actually computed (for mismatch reporting). */
  observed_hash?: string;
  apts_refs: string[];
}

/**
 * Pin a config value at engagement-start. The returned pin is the
 * source of truth for subsequent verifications. Caller should emit a
 * scope-validation or audit event recording the pin.
 */
export function pinConfig(label: string, config: unknown): ConfigPin {
  return {
    hash: hashCanonical(config),
    pinned_at: new Date().toISOString(),
    label,
  };
}

/**
 * Verify the current in-memory config against a previous pin. Returns
 * { ok: true } on match or { ok: false, reason, observed_hash } on
 * mismatch. Callers should halt the engagement on mismatch.
 */
export function verifyConfig(config: unknown, pin: ConfigPin): ConfigVerifyResult {
  const observed = hashCanonical(config);
  if (observed !== pin.hash) {
    return {
      ok: false,
      reason: `config "${pin.label}" integrity check failed: pinned ${pin.hash} at ${pin.pinned_at}, observed ${observed}`,
      observed_hash: observed,
      apts_refs: ['APTS-MR-004', 'APTS-MR-012'],
    };
  }
  return {
    ok: true,
    observed_hash: observed,
    apts_refs: ['APTS-MR-004', 'APTS-MR-012'],
  };
}
