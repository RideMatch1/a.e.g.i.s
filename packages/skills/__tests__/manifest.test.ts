/**
 * Manifest integrity tests.
 *
 * Pins the current skill-count and per-category source-namespaces, and
 * verifies that every loaded skill has a well-formed id, category, source,
 * and relativePath. If a future commit drops a skill or renames a
 * directory, the mismatch surfaces here before the tag-push.
 */
import { describe, it, expect } from 'vitest';
import { loadAllSkills, resolveSkillsRoot } from '../src/skills-loader.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const EXPECTED_TOTAL = 46;

const EXPECTED_CATEGORIES = ['offensive', 'defensive', 'mitre-mapped', 'ops'];

const EXPECTED_SOURCES_BY_CATEGORY: Record<string, string[]> = {
  offensive: ['snailsploit-fork'],
  defensive: ['aegis-native'],
  'mitre-mapped': ['aegis-native'],
  ops: ['aegis-native'],
};

const EXPECTED_NAMES_BY_CATEGORY: Record<string, string[]> = {
  offensive: [
    'advanced-redteam',
    'ai-security',
    'basic-exploitation',
    'bug-identification',
    'crash-analysis',
    'deserialization',
    'edr-evasion',
    'exploit-dev-course',
    'exploit-development',
    'fast-checking',
    'file-upload',
    'fuzzing',
    'fuzzing-course',
    'graphql',
    'idor',
    'initial-access',
    'jwt',
    'keylogger-arch',
    'mitigations',
    'oauth',
    'open-redirect',
    'osint',
    'osint-methodology',
    'parameter-pollution',
    'race-condition',
    'rce',
    'request-smuggling',
    'shellcode',
    'sqli',
    'ssrf',
    'ssti',
    'vuln-classes',
    'waf-bypass',
    'windows-boundaries',
    'windows-mitigations',
    'xss',
    'xxe',
  ],
  defensive: ['rls-defense', 'ssrf-defense', 'tenant-isolation-defense'],
  'mitre-mapped': ['mapping-overview', 't1078-valid-accounts', 't1190-exploit-public-app'],
  ops: ['escalation-runbook', 'suppress-correctly', 'triage-finding'],
};

describe('manifest — current shape', () => {
  it('resolves skills root to an existing directory', () => {
    const root = resolveSkillsRoot();
    expect(existsSync(root)).toBe(true);
  });

  it(`loads exactly ${EXPECTED_TOTAL} skills`, () => {
    const skills = loadAllSkills();
    expect(skills.length).toBe(EXPECTED_TOTAL);
  });

  it('every skill has a non-empty id', () => {
    for (const skill of loadAllSkills()) {
      expect(skill.id.length).toBeGreaterThan(0);
    }
  });

  it('every skill id is unique', () => {
    const skills = loadAllSkills();
    const ids = skills.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every skill has a recognized category', () => {
    for (const skill of loadAllSkills()) {
      expect(EXPECTED_CATEGORIES).toContain(skill.category);
    }
  });

  it('every skill has a recognized source for its category', () => {
    for (const skill of loadAllSkills()) {
      const allowedSources = EXPECTED_SOURCES_BY_CATEGORY[skill.category];
      expect(allowedSources).toBeDefined();
      expect(allowedSources).toContain(skill.source);
    }
  });

  it('every skill name matches kebab-case pattern', () => {
    for (const skill of loadAllSkills()) {
      expect(skill.name).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('every skill absolutePath exists on disk', () => {
    for (const skill of loadAllSkills()) {
      expect(existsSync(skill.absolutePath)).toBe(true);
    }
  });

  it('every skill relativePath is under the resolved skills root', () => {
    const root = resolveSkillsRoot();
    for (const skill of loadAllSkills()) {
      expect(existsSync(join(root, skill.relativePath))).toBe(true);
    }
  });

  it('every skill id prefixes with category-source-', () => {
    for (const skill of loadAllSkills()) {
      expect(skill.id.startsWith(`${skill.category}-${skill.source}-`)).toBe(true);
    }
  });
});

describe('manifest — per-category skill-name coverage', () => {
  for (const category of EXPECTED_CATEGORIES) {
    it(`${category} catalog contains every expected skill name`, () => {
      const actual = loadAllSkills()
        .filter((s) => s.category === category)
        .map((s) => s.name)
        .sort();
      const expected = [...EXPECTED_NAMES_BY_CATEGORY[category]].sort();
      expect(actual).toEqual(expected);
    });
  }

  it('does not contain a patch-diffing skill (upstream README-only, absent on disk)', () => {
    const names = loadAllSkills().map((s) => s.name);
    expect(names).not.toContain('patch-diffing');
  });
});
