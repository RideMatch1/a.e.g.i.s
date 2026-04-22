/**
 * Flow-helper unit tests.
 *
 * Covers pure-function helpers exported from src/wizard/flow.ts that are
 * easy to unit-test in isolation (as opposed to runWizard itself, which
 * drives an interactive @clack/prompts session).
 */
import { describe, it, expect } from 'vitest';
import { pickDefaultLocale, legalPagesForJurisdiction } from '../src/wizard/flow.js';

describe('pickDefaultLocale', () => {
  it('returns de when de is in locales (single)', () => {
    expect(pickDefaultLocale(['de'])).toBe('de');
  });

  it('returns de when de is in locales (multi, de first)', () => {
    expect(pickDefaultLocale(['de', 'en'])).toBe('de');
  });

  it('returns de when de is in locales (multi, de not first)', () => {
    expect(pickDefaultLocale(['en', 'de'])).toBe('de');
    expect(pickDefaultLocale(['fr', 'es', 'de'])).toBe('de');
  });

  it('returns en when de is not in locales but en is', () => {
    expect(pickDefaultLocale(['en'])).toBe('en');
    expect(pickDefaultLocale(['en', 'fr'])).toBe('en');
    expect(pickDefaultLocale(['fr', 'en'])).toBe('en');
  });

  it('returns first-selected when neither de nor en is in locales', () => {
    expect(pickDefaultLocale(['fr'])).toBe('fr');
    expect(pickDefaultLocale(['fr', 'es'])).toBe('fr');
    expect(pickDefaultLocale(['es', 'it', 'nl'])).toBe('es');
  });

  it('throws on empty array (defensive — callers must pass at least one)', () => {
    expect(() => pickDefaultLocale([])).toThrow(/at least one locale/);
  });

  it('is pure — same input always yields the same output', () => {
    const input = ['fr', 'es'];
    const first = pickDefaultLocale(input);
    const second = pickDefaultLocale(input);
    expect(first).toBe(second);
    // And input is not mutated
    expect(input).toEqual(['fr', 'es']);
  });
});

describe('legalPagesForJurisdiction', () => {
  it('returns [impressum, datenschutz] for DE', () => {
    expect(legalPagesForJurisdiction('DE')).toEqual(['impressum', 'datenschutz']);
  });

  it('returns empty list for every non-DE jurisdiction', () => {
    expect(legalPagesForJurisdiction('EU')).toEqual([]);
    expect(legalPagesForJurisdiction('US')).toEqual([]);
    expect(legalPagesForJurisdiction('CH')).toEqual([]);
    expect(legalPagesForJurisdiction('AT')).toEqual([]);
    expect(legalPagesForJurisdiction('other')).toEqual([]);
  });

  it('returns empty list for unknown jurisdiction strings defensively', () => {
    expect(legalPagesForJurisdiction('')).toEqual([]);
    expect(legalPagesForJurisdiction('XX')).toEqual([]);
    expect(legalPagesForJurisdiction('de')).toEqual([]); // lowercase does not match
  });

  it('is pure — same input always yields the same output', () => {
    const first = legalPagesForJurisdiction('DE');
    const second = legalPagesForJurisdiction('DE');
    expect(first).toEqual(second);
  });
});
