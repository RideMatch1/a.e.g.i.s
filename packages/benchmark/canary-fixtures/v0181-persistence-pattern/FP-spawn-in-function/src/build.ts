import { spawn } from 'child_process';

// Legitimate API: spawn() inside a function body. The function only runs
// when an operator explicitly invokes it (e.g. from a CLI command or a
// test harness). NOT persistence — the operator chooses when to fire.
export function runBuild(): void {
  const proc = spawn('tsc', ['--build']);
  proc.on('exit', (code) => {
    if (code !== 0) {
      throw new Error(`build failed: ${code}`);
    }
  });
}
