import type { AuditResult, Reporter } from '@aegis-scan/core';

function format(result: AuditResult): string {
  return JSON.stringify(result, null, 2);
}

export const jsonReporter: Reporter = {
  name: 'json',
  format,
};
