// Real-world pattern from AEGIS's own mass-assignment-checker (v0181
// battle-test self-scan): RegExp.prototype.exec called on a regex
// instance. NOT a child_process call.
const dataRe = /options\s*:\s*\{([^}]+)\}/;

export function parseInput(input: string): string | null {
  const dataMatch = dataRe.exec(input);
  return dataMatch ? dataMatch[1] : null;
}

// Top-level RegExp.exec is also fine — it's a parser primitive, not a
// child_process call. The regex must distinguish via negative-lookbehind
// `(?<!\.)` to skip method-call shapes.
const HEADER_RE = /^Authorization:\s+(\w+)/;
const sample = 'Authorization: Bearer xyz';
const headerMatch = HEADER_RE.exec(sample);

export const TOKEN_TYPE = headerMatch ? headerMatch[1] : null;
