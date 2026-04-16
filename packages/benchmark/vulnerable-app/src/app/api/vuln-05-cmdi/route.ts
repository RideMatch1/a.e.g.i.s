/**
 * Diagnostic Runner — POST /api/vuln-05-cmdi
 *
 * Executes a server-side diagnostic command and returns stdout.
 * Intended for internal ops tooling to run predefined health checks.
 */
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.command || typeof body.command !== 'string') {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'command is required' } },
        { status: 400 },
      );
    }

    const cmd = body.command;
    const sanitized = cmd.trim();

    // VULNERABLE: user-supplied input flows through trim() into exec()
    const { stdout, stderr } = await execAsync(sanitized);

    return NextResponse.json({
      success: true,
      output: stdout.trim(),
      warnings: stderr ? stderr.trim() : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'EXEC_FAILED', message: 'Command execution failed' } },
      { status: 500 },
    );
  }
}
