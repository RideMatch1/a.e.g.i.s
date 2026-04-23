/**
 * Attribution preservation tests.
 *
 * Verifies that every forked SKILL.md carries the uniform AEGIS-side
 * attribution header applied during the commit-3 fork. Upstream uses
 * two conventions for its own per-file attribution (YAML-only
 * frontmatter vs `## Metadata > - Source:` bullet) — see
 * ATTRIBUTION.md and the commit-3 body. The aegis-local HTML header
 * is the uniform anchor that works across both conventions and is
 * what this suite tests against.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadAllSkills } from '../src/skills-loader.js';

const skills = loadAllSkills();

const AEGIS_LOCAL_HEADER_RE =
  /^<!-- aegis-local: forked \d{4}-\d{2}-\d{2} from SnailSploit\/Claude-Red@[0-9a-f]{40}; attribution preserved, see ATTRIBUTION\.md -->/;

describe('attribution — every forked SKILL.md preserves provenance', () => {
  for (const skill of skills) {
    describe(skill.name, () => {
      it('starts with the aegis-local HTML attribution header', () => {
        const raw = readFileSync(skill.absolutePath, 'utf-8');
        const firstLine = raw.split(/\r?\n/, 1)[0];
        expect(firstLine).toMatch(AEGIS_LOCAL_HEADER_RE);
      });

      it('pins to an upstream-SHA-bearing header (not a dev-placeholder)', () => {
        const raw = readFileSync(skill.absolutePath, 'utf-8');
        // The header-regex already enforces a 40-hex SHA — this test is
        // intentionally redundant so a PR that tries to slip a short-
        // SHA or a "TBD" placeholder past the AEGIS_LOCAL_HEADER_RE
        // tightening still fails out here.
        expect(raw).toMatch(/[0-9a-f]{40}/);
      });
    });
  }
});

describe('attribution — upstream source-URL capture where present', () => {
  // Thirty-two of thirty-seven upstream files include a `## Metadata` section
  // with a `- Source: https://…` bullet pointing at sahar042's checklist.
  // Five use YAML-only frontmatter and have no per-file source URL (loader
  // returns null). Both states are expected — what we verify here is that
  // when a URL IS extracted, it points at a known upstream host.
  for (const skill of skills) {
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

describe('attribution — per-source coverage at v0.1.0', () => {
  it('every skill sources from snailsploit-fork (single-source at v0.1.0)', () => {
    const sources = new Set(skills.map((s) => s.source));
    expect(sources.size).toBe(1);
    expect(sources.has('snailsploit-fork')).toBe(true);
  });

  it('all 37 skills carry the aegis-local attribution header', () => {
    let count = 0;
    for (const skill of skills) {
      const raw = readFileSync(skill.absolutePath, 'utf-8');
      if (AEGIS_LOCAL_HEADER_RE.test(raw.split(/\r?\n/, 1)[0])) count += 1;
    }
    expect(count).toBe(37);
  });
});
