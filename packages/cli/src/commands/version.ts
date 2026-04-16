import { getVersion } from '@aegis-scan/core';

export function showVersion(): void {
  console.log(`aegis v${getVersion()}`);
}
