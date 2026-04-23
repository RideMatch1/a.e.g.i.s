/**
 * `aegis-skills info <skill-name>` — render one skill's metadata.
 *
 * The argument matches by leaf `name` (e.g. `sqli`) or full `id` (e.g.
 * `offensive-snailsploit-fork-sqli`). Returns exit 0 on found, exit 1
 * on not-found, exit 2 on loader error.
 */
import { loadAllSkills, type LoadedSkill } from '../skills-loader.js';

export interface InfoOptions {
  json?: boolean;
}

export function runInfo(query: string, options: InfoOptions = {}): number {
  if (!query || query.trim().length === 0) {
    console.error('Error: aegis-skills info requires a skill-name argument');
    return 1;
  }

  let skills: LoadedSkill[];
  try {
    skills = loadAllSkills();
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    return 2;
  }

  const needle = query.trim().toLowerCase();
  const matches = skills.filter(
    (s) => s.name.toLowerCase() === needle || s.id.toLowerCase() === needle,
  );

  if (matches.length === 0) {
    console.error(`Error: no skill found matching "${query}"`);
    console.error('Run `aegis-skills list` to see the available catalog.');
    return 1;
  }
  if (matches.length > 1) {
    console.error(`Error: "${query}" is ambiguous — matches:`);
    for (const m of matches) console.error(`  ${m.id}`);
    console.error('Use the full id (e.g. offensive-snailsploit-fork-<name>) to disambiguate.');
    return 1;
  }

  const skill = matches[0];
  if (options.json) {
    process.stdout.write(JSON.stringify(skill, null, 2) + '\n');
    return 0;
  }

  console.log(`# ${skill.title}`);
  console.log('');
  console.log(`id:           ${skill.id}`);
  console.log(`category:     ${skill.category}`);
  console.log(`source:       ${skill.source || '(none)'}`);
  console.log(`name:         ${skill.name}`);
  console.log(`relativePath: ${skill.relativePath}`);
  if (skill.upstreamSourceUrl) {
    console.log(`upstream:     ${skill.upstreamSourceUrl}`);
  }
  console.log('');
  console.log('Description:');
  console.log(wrap(skill.description || '(no description extracted)', 78, '  '));
  console.log('');
  console.log(`File on disk: ${skill.absolutePath}`);
  return 0;
}

function wrap(text: string, width: number, indent: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = indent;
  for (const word of words) {
    if ((line.length + word.length + 1) > width && line.trim().length > 0) {
      lines.push(line);
      line = indent + word;
    } else {
      line = line.trim().length === 0 ? `${indent}${word}` : `${line} ${word}`;
    }
  }
  if (line.trim().length > 0) lines.push(line);
  return lines.join('\n');
}
