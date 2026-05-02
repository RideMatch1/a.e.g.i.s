import { appendFileSync } from 'fs';

// Legitimate top-level fs write: project-relative log path. Common
// pattern for boot-time logging; NOT a persistence vector because the
// file lives inside the project tree (lost on uninstall, no privilege
// escalation, no cross-process effect).
appendFileSync('./logs/boot.log', `[${new Date().toISOString()}] init\n`);

export const noop = () => null;
