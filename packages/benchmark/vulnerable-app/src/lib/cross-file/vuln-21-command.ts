/**
 * VULN-21 support: method-call cross-file via TypeChecker.
 *
 * Exports a const whose value is an object-literal with a method that
 * internally invokes a sink (child_process.exec). Phase 4 must resolve
 * the method's symbol via TypeChecker — module-graph alone can't
 * navigate into the object literal's property — and build a summary
 * from the method's function node.
 */
import { exec } from 'child_process';

export const commandRunner = {
  run: (cmd: string): void => {
    exec(cmd, () => {});
  },
};
