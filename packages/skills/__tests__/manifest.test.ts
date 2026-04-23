/**
 * Manifest integrity tests.
 *
 * Pins the v0.1.0 skill-count to 37 and verifies that every loaded skill
 * has a well-formed id, category, source, name, and relativePath. If a
 * future commit drops a skill or renames a directory, the mismatch
 * surfaces here before the tag-push.
 */
import { describe, it, expect } from 'vitest';
import { loadAllSkills, resolveSkillsRoot } from '../src/skills-loader.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

describe('manifest — v0.1.0 shape', () => {
  it('resolves skills root to an existing directory', () => {
    const root = resolveSkillsRoot();
    expect(existsSync(root)).toBe(true);
  });

  it('loads exactly 37 skills for the v0.1.0 ship', () => {
    const skills = loadAllSkills();
    expect(skills.length).toBe(37);
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

  it('every skill has category set to offensive for v0.1.0', () => {
    for (const skill of loadAllSkills()) {
      expect(skill.category).toBe('offensive');
    }
  });

  it('every skill has source set to snailsploit-fork for v0.1.0', () => {
    for (const skill of loadAllSkills()) {
      expect(skill.source).toBe('snailsploit-fork');
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

describe('manifest — v0.1.0 skill-name coverage', () => {
  const EXPECTED_NAMES = [
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
  ];

  it('catalog contains every expected upstream-forked skill name', () => {
    const actual = loadAllSkills()
      .map((s) => s.name)
      .sort();
    expect(actual).toEqual([...EXPECTED_NAMES].sort());
  });

  it('does not contain a patch-diffing skill (upstream README-only, absent on disk)', () => {
    const names = loadAllSkills().map((s) => s.name);
    expect(names).not.toContain('patch-diffing');
  });
});
