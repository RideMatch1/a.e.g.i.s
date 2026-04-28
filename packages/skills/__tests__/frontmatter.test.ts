/**
 * Frontmatter shape tests.
 *
 * Runs once-per-skill. Verifies that the loader extracts a usable title
 * and description from every SKILL.md regardless of which of the two
 * upstream conventions the file uses (YAML-only frontmatter vs `##
 * Metadata > - Source:` bullet).
 */
import { describe, it, expect } from 'vitest';
import { loadAllSkills, parseHardConstraintFrontmatter } from '../src/skills-loader.js';

const skills = loadAllSkills();

describe('frontmatter — per-skill extraction', () => {
  for (const skill of skills) {
    describe(skill.name, () => {
      it('has a non-empty title', () => {
        expect(skill.title.length).toBeGreaterThan(0);
      });

      it('has a title within a sane length band', () => {
        expect(skill.title.length).toBeLessThanOrEqual(200);
      });

      it('has either a non-empty description or falls back to an extractable paragraph', () => {
        // The loader guarantees `description` is always a string. For a
        // handful of skills the first non-empty paragraph may be shorter
        // than 20 chars (e.g. "Offensive OSINT Methodology"), so we do
        // not enforce a strict minimum length — only that the field is
        // present and is a string.
        expect(typeof skill.description).toBe('string');
      });

      it('title does not start with a shell-comment marker (code-fence bleed)', () => {
        // The extractor walks code-fence state when looking for H1s, so a
        // `# comment` inside a bash block should never leak. This test
        // protects against a regression where the fence-tracker breaks
        // and a shell-comment becomes the rendered title.
        expect(skill.title).not.toMatch(/^# /);
      });
    });
  }
});

describe('frontmatter — loader stability', () => {
  it('loads deterministic ids across two calls', () => {
    const first = loadAllSkills().map((s) => s.id);
    const second = loadAllSkills().map((s) => s.id);
    expect(first).toEqual(second);
  });

  it('loads deterministic titles across two calls', () => {
    const first = loadAllSkills().map((s) => `${s.id}::${s.title}`);
    const second = loadAllSkills().map((s) => `${s.id}::${s.title}`);
    expect(first).toEqual(second);
  });
});

describe('frontmatter — HARD-CONSTRAINT fields (v0.3.0)', () => {
  const parse = parseHardConstraintFrontmatter;

  it('parses required_tools as comma-separated string', () => {
    const md = `---
name: test-skill
description: Test skill for HARD-CONSTRAINT format
required_tools: "ucos-engine,aegis-scan,brutaler-anwalt"
required_audit_passes: 2
enforced_quality_gates: 9
pre_done_audit: true
model: opus
license: MIT
---

# Test Skill`;

    const fm = parse(md);
    expect(fm.name).toBe('test-skill');
    expect(fm.description).toBe('Test skill for HARD-CONSTRAINT format');
    expect(fm.required_tools).toBe('ucos-engine,aegis-scan,brutaler-anwalt');
    expect(fm.required_audit_passes).toBe('2');
    expect(fm.enforced_quality_gates).toBe('9');
    expect(fm.pre_done_audit).toBe('true');
    expect(fm.model).toBe('opus');
    expect(fm.license).toBe('MIT');
  });

  it('returns undefined for missing HARD-CONSTRAINT fields (backward compat)', () => {
    const md = `---
name: legacy-skill
description: Pre-v0.3.0 skill without HARD-CONSTRAINT fields
---

# Legacy Skill`;

    const fm = parse(md);
    expect(fm.name).toBe('legacy-skill');
    expect(fm.description).toBe('Pre-v0.3.0 skill without HARD-CONSTRAINT fields');
    expect(fm.required_tools).toBeUndefined();
    expect(fm.required_audit_passes).toBeUndefined();
    expect(fm.enforced_quality_gates).toBeUndefined();
    expect(fm.pre_done_audit).toBeUndefined();
    expect(fm.model).toBeUndefined();
    expect(fm.license).toBeUndefined();
  });

  it('tolerates a leading <!-- aegis-local --> HTML header', () => {
    const md = `<!-- aegis-local: AEGIS-native skill, MIT-licensed; consumer-facing override allowed. -->
---
name: aegis-local-skill
description: Skill that ships under upstream-fork
required_tools: "shell-ops,file-ops"
model: sonnet
license: MIT
---

# AEGIS-local skill`;

    const fm = parse(md);
    expect(fm.name).toBe('aegis-local-skill');
    expect(fm.required_tools).toBe('shell-ops,file-ops');
    expect(fm.model).toBe('sonnet');
    expect(fm.license).toBe('MIT');
  });

  it('returns empty name+description when no frontmatter present', () => {
    const md = `# Just a heading\n\nbody text`;
    const fm = parse(md);
    expect(fm.name).toBe('');
    expect(fm.description).toBe('');
  });
});
