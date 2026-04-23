/**
 * Scrub-clean invariant tests.
 *
 * Enforces that no AEGIS-internal codename leaks into any shipped
 * SKILL.md. The scrub-list is the same cumulative institutional list
 * referenced by the .git/hooks/commit-msg scrub-gate and by the
 * publish-skills.yml tarball-scrub gate landed in commit 7. Upstream
 * content is forked byte-identically and therefore cannot leak AEGIS
 * terms by construction; this suite catches the failure mode where a
 * future sync or hand-edit inadvertently introduces one.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadAllSkills } from '../src/skills-loader.js';

const skills = loadAllSkills();

const FORBIDDEN = [
  'Spa-App',
  'spa-app',
  'lukas',
  'hertle',
  'ucos',
  'voidai',
  'sonnenhof',
  'hundementor',
  'myspa',
  'hotel-pilot',
  'UCOS-space',
  'VoidAI',
  'aegis-precision',
];

const FORBIDDEN_RE = new RegExp(FORBIDDEN.join('|'), 'i');

describe('scrub-clean — every shipped SKILL.md', () => {
  for (const skill of skills) {
    it(`${skill.name} contains zero internal-codename hits`, () => {
      const raw = readFileSync(skill.absolutePath, 'utf-8');
      const match = raw.match(FORBIDDEN_RE);
      if (match) {
        // Provide enough context for a failing run to locate the hit
        // without dumping the entire skill body.
        const idx = raw.toLowerCase().indexOf(match[0].toLowerCase());
        const window = raw.slice(Math.max(0, idx - 40), idx + match[0].length + 40);
        throw new Error(
          `Scrub-term "${match[0]}" found in ${skill.relativePath} — context: …${window}…`,
        );
      }
      expect(match).toBeNull();
    });
  }
});

describe('scrub-clean — package-root documents', () => {
  const PACKAGE_ROOT_FILES = ['README.md', 'CHANGELOG.md', 'ATTRIBUTION.md', 'LICENSE'];
  // These four files travel in the tarball per package.json "files"
  // and must be scrub-clean in the same way every shipped SKILL.md is.
  // We reach them via a relative path from the test-runner CWD — vitest
  // runs from packages/skills/ so the paths are just filenames.
  for (const file of PACKAGE_ROOT_FILES) {
    it(`${file} contains zero internal-codename hits`, () => {
      const raw = readFileSync(file, 'utf-8');
      expect(raw.match(FORBIDDEN_RE)).toBeNull();
    });
  }
});
