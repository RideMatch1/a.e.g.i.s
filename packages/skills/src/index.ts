/**
 * `@aegis-scan/skills` programmatic entry point.
 *
 * Re-exports the skill-loader plus the three CLI handlers so
 * downstream tooling (e.g. a future aegis-scan plugin, a wizard-cli
 * brief-generator hook, or direct agent-SDK invocations) can build
 * on the same introspection surface without shelling out to the bin.
 */
export {
  loadAllSkills,
  resolveSkillsRoot,
  type LoadedSkill,
} from './skills-loader.js';

export { runList, type ListOptions } from './commands/list.js';
export { runInfo, type InfoOptions } from './commands/info.js';
export { runInstall, type InstallOptions } from './commands/install.js';
