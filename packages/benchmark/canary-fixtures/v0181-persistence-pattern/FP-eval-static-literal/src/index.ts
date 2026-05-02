// Top-level eval of a static literal: bad-practice in a different vuln
// class (general code-quality / SAST eval-detection), but NOT persistence
// because there is no attacker-controlled input path. Differentiator: the
// eval'd string must be a variable / template / expression, not a literal.
const computed = eval('1 + 2 + 3');

export { computed };
