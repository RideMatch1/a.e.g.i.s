import { terminalReporter, jsonReporter, sarifReporter, htmlReporter, markdownReporter } from '@aegis-scan/reporters';
import type { Reporter } from '@aegis-scan/core';

/**
 * Write to stdout and wait for the data to be fully flushed.
 * Prevents truncation when piping large JSON output (e.g. `aegis scan --format json | jq`).
 * Node.js process.stdout.write() is non-blocking for pipes — without draining,
 * process.exit() kills the process before the 729KB JSON reaches the consumer.
 */
export function writeStdout(data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const drained = process.stdout.write(data, (err) => {
      if (err) reject(err);
    });
    if (drained) {
      resolve();
    } else {
      process.stdout.once('drain', resolve);
    }
  });
}

export function selectReporter(format?: string): Reporter {
  switch (format) {
    case 'json':
      return jsonReporter;
    case 'sarif':
      return sarifReporter;
    case 'html':
      return htmlReporter;
    case 'markdown':
    case 'md':
      return markdownReporter;
    default:
      return terminalReporter;
  }
}
