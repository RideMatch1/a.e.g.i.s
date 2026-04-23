/**
 * `aegis-skills install` — copy every SKILL.md into a skill-target
 * directory so Claude Code (and compatible agents) can auto-load them.
 *
 * Default target: `$HOME/.claude/skills/user/aegis-skills/`. Namespaced
 * under `aegis-skills/` so `--force` reinstalls cleanly without
 * disturbing unrelated skill trees the operator may have in the same
 * parent directory.
 *
 * Flags:
 *   --to <dir>    Override the target directory.
 *   --force       Overwrite existing files at the target. Without
 *                 --force, refuses to overwrite and exits 1 with a
 *                 pointer.
 *   --dry-run     Print what would be copied without writing anything.
 */
import { homedir } from 'node:os';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { loadAllSkills, type LoadedSkill } from '../skills-loader.js';

export interface InstallOptions {
  to?: string;
  force?: boolean;
  dryRun?: boolean;
}

export function runInstall(options: InstallOptions = {}): number {
  const targetRoot = resolveTargetDir(options.to);

  let skills: LoadedSkill[];
  try {
    skills = loadAllSkills();
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    return 2;
  }

  // Establish which on-disk files already exist under the target — we
  // refuse to overwrite unless --force is set.
  const plannedTargets = skills.map((s) => join(targetRoot, s.relativePath));
  const existing = plannedTargets.filter((p) => existsSync(p));
  if (existing.length > 0 && options.force !== true) {
    console.error(
      `Error: ${existing.length} file(s) already exist under ${targetRoot}.`,
    );
    console.error('Pass --force to overwrite, or choose a different --to directory.');
    if (existing.length <= 5) {
      for (const p of existing) console.error(`  ${p}`);
    } else {
      for (const p of existing.slice(0, 3)) console.error(`  ${p}`);
      console.error(`  … and ${existing.length - 3} more`);
    }
    return 1;
  }

  if (options.dryRun === true) {
    console.log(`(dry-run) would install ${skills.length} skill(s) under ${targetRoot}`);
    for (const skill of skills) {
      console.log(`  ${skill.id.padEnd(40)} → ${join(targetRoot, skill.relativePath)}`);
    }
    return 0;
  }

  let written = 0;
  for (const skill of skills) {
    const targetPath = join(targetRoot, skill.relativePath);
    try {
      mkdirSync(dirname(targetPath), { recursive: true });
      const content = readFileSync(skill.absolutePath, 'utf-8');
      writeFileSync(targetPath, content, 'utf-8');
      written += 1;
    } catch (err) {
      console.error(`Error writing ${targetPath}: ${(err as Error).message}`);
      return 2;
    }
  }

  console.log(`Installed ${written} skill(s) into ${targetRoot}`);
  console.log('');
  console.log('Next steps:');
  console.log(`  aegis-skills list              # browse the installed catalog`);
  console.log(`  aegis-skills info <skill-name> # inspect one skill`);
  console.log('');
  console.log('Your AI agent (Claude Code, Codex, Cursor, etc) will auto-load');
  console.log('each skill based on its frontmatter trigger-phrases on the next');
  console.log('session. See README for the full quickstart.');
  return 0;
}

function resolveTargetDir(override: string | undefined): string {
  if (override && override.trim().length > 0) {
    return resolve(process.cwd(), override);
  }
  return join(homedir(), '.claude', 'skills', 'user', 'aegis-skills');
}
