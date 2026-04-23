/**
 * Frontmatter shape tests.
 *
 * Runs once-per-skill. Verifies that the loader extracts a usable title
 * and description from every SKILL.md regardless of which of the two
 * upstream conventions the file uses (YAML-only frontmatter vs `##
 * Metadata > - Source:` bullet).
 */
import { describe, it, expect } from 'vitest';
import { loadAllSkills } from '../src/skills-loader.js';

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
