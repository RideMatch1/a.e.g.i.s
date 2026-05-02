// Real-world pattern from AEGIS's own packages/core/src/utils.ts (v0181
// battle-test self-scan): a function NAMED `exec` is being DEFINED — there
// is no call to a child_process function on import. The regex must
// distinguish definition (`function exec(...)`) from call (`exec(...)`).
import * as childProcess from 'node:child_process';

export function exec(
  command: string,
  args: string[] = [],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    childProcess.execFile(command, args, (err, stdout, stderr) => {
      resolve({ stdout: String(stdout), stderr: String(stderr), exitCode: err?.code ?? 0 });
    });
  });
}

export function spawn(command: string): unknown {
  return childProcess.spawn(command);
}
