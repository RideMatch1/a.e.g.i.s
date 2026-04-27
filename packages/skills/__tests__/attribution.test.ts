/**
 * Attribution preservation tests.
 *
 * Verifies that every shipped SKILL.md carries the per-source
 * AEGIS-side attribution header applied during fork (snailsploit-fork)
 * or authoring (aegis-native). Upstream uses two conventions for its
 * own per-file attribution in the snailsploit-fork case (YAML-only
 * frontmatter vs `## Metadata > - Source:` bullet) — see
 * ATTRIBUTION.md and the v0.1.0 fork-commit body. The aegis-local
 * HTML header is the uniform anchor and is what this suite tests
 * against, with the expected pattern varying per source-namespace.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadAllSkills } from '../src/skills-loader.js';

const skills = loadAllSkills();

const HEADER_RE_BY_SOURCE: Record<string, RegExp> = {
  'snailsploit-fork':
    /^<!-- aegis-local: forked \d{4}-\d{2}-\d{2} from SnailSploit\/Claude-Red@[0-9a-f]{40}; attribution preserved, see ATTRIBUTION\.md -->/,
  'aegis-native':
    /^<!-- aegis-local: AEGIS-native skill, MIT-licensed;.*-->/,
};

describe('attribution — every shipped SKILL.md preserves source-appropriate provenance', () => {
  for (const skill of skills) {
    describe(`${skill.category}/${skill.source}/${skill.name}`, () => {
      it('starts with the per-source aegis-local HTML attribution header', () => {
        const raw = readFileSync(skill.absolutePath, 'utf-8');
        const firstLine = raw.split(/\r?\n/, 1)[0];
        const expectedRe = HEADER_RE_BY_SOURCE[skill.source];
        expect(expectedRe).toBeDefined();
        expect(firstLine).toMatch(expectedRe);
      });

      it('aegis-local header is the very first line (not buried)', () => {
        const raw = readFileSync(skill.absolutePath, 'utf-8');
        // First line should contain the aegis-local marker; otherwise
        // someone has prepended content above the provenance anchor,
        // which breaks the structural invariant the loader relies on.
        const firstLine = raw.split(/\r?\n/, 1)[0];
        expect(firstLine).toMatch(/^<!-- aegis-local:/);
      });
    });
  }
});

describe('attribution — snailsploit-fork specifics', () => {
  const forked = skills.filter((s) => s.source === 'snailsploit-fork');

  it('every snailsploit-forked skill pins to a 40-hex upstream SHA', () => {
    for (const skill of forked) {
      const raw = readFileSync(skill.absolutePath, 'utf-8');
      // The header-regex already enforces a 40-hex SHA — this test is
      // intentionally redundant so a PR that tries to slip a short-SHA
      // or a "TBD" placeholder past the header tightening still fails
      // out here.
      expect(raw).toMatch(/[0-9a-f]{40}/);
    }
  });

  // Thirty-two of thirty-seven upstream files include a `## Metadata` section
  // with a `- Source: https://…` bullet pointing at sahar042's checklist.
  // Five use YAML-only frontmatter and have no per-file source URL (loader
  // returns null). Both states are expected — what we verify here is that
  // when a URL IS extracted, it points at a known upstream host.
  for (const skill of forked) {
    it(`${skill.name}: upstreamSourceUrl is null or points at an approved host`, () => {
      const url = skill.upstreamSourceUrl;
      if (url === null) {
        // YAML-only file, acceptable.
        return;
      }
      expect(url).toMatch(/^https:\/\/github\.com\/(SnailSploit|sahar042)\//);
    });
  }
});

describe('attribution — per-source coverage', () => {
  it('every skill carries a recognized per-source attribution header', () => {
    let unrecognized = 0;
    for (const skill of skills) {
      const raw = readFileSync(skill.absolutePath, 'utf-8');
      const firstLine = raw.split(/\r?\n/, 1)[0];
      const expectedRe = HEADER_RE_BY_SOURCE[skill.source];
      if (!expectedRe || !expectedRe.test(firstLine)) {
        unrecognized += 1;
      }
    }
    expect(unrecognized).toBe(0);
  });

  it('source-namespaces are bounded to the documented set', () => {
    const sources = new Set(skills.map((s) => s.source));
    for (const src of sources) {
      expect(Object.keys(HEADER_RE_BY_SOURCE)).toContain(src);
    }
  });
});
