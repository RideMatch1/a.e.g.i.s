/**
 * i18n helper for brief-rendering.
 *
 * Usage:
 *   import { getMessage } from '../i18n/index.js';
 *   getMessage('de', 'core_rules.multi_tenancy'); // → 'Multi-Tenancy (HART)'
 *
 * Fallback semantics: if a key is missing in the requested language, the
 * helper falls back to English and warns to stderr once per missing key.
 * Missing-in-both throws — that is a catalog bug and should fail-fast.
 *
 * Dynamic interpolations (file-paths, command-names, variable-names, URLs)
 * stay language-agnostic and are concatenated by section-renderers outside
 * the i18n layer.
 *
 * The catalogs are loaded at module-init time from sibling en.json / de.json
 * via readFileSync so downstream consumers (tsc, vitest, node-runtime) do
 * not need JSON-module import-attribute support.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type BriefLang = 'en' | 'de';

type MessageCatalog = Record<string, unknown>;

const __dirname = dirname(fileURLToPath(import.meta.url));

const CATALOGS: Record<BriefLang, MessageCatalog> = {
  en: JSON.parse(readFileSync(join(__dirname, 'en.json'), 'utf-8')) as MessageCatalog,
  de: JSON.parse(readFileSync(join(__dirname, 'de.json'), 'utf-8')) as MessageCatalog,
};

const warnedMissing = new Set<string>();

/**
 * Dot-path lookup — `core_rules.multi_tenancy` walks `catalog.core_rules.multi_tenancy`.
 */
function lookup(catalog: MessageCatalog, dotPath: string): string | null {
  const parts = dotPath.split('.');
  let cursor: unknown = catalog;
  for (const p of parts) {
    if (cursor && typeof cursor === 'object' && p in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[p];
    } else {
      return null;
    }
  }
  return typeof cursor === 'string' ? cursor : null;
}

export function getMessage(lang: BriefLang, key: string): string {
  const primary = lookup(CATALOGS[lang], key);
  if (primary !== null) return primary;

  // Fallback to English if a de-key is missing.
  if (lang !== 'en') {
    const fallback = lookup(CATALOGS.en, key);
    if (fallback !== null) {
      const warnKey = `${lang}:${key}`;
      if (!warnedMissing.has(warnKey)) {
        warnedMissing.add(warnKey);
        // eslint-disable-next-line no-console
        console.warn(
          `[i18n] Missing translation ${lang}:${key} — falling back to English.`,
        );
      }
      return fallback;
    }
  }

  // Key missing in both languages — that's a catalog bug.
  throw new Error(
    `i18n: message key "${key}" missing in both "${lang}" and "en" catalogs. ` +
      'This is a brief-generator bug — check src/brief/i18n/en.json.',
  );
}

/**
 * Test-only: reset the "already-warned" deduplication set so repeated
 * invocations in a test-suite can assert warning emission deterministically.
 */
export function _resetI18nWarningsForTesting(): void {
  warnedMissing.clear();
}
