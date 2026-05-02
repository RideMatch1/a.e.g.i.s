// Persistence pattern: top-level eval() of an attacker-controlled
// string. Executes at module load — classic obfuscated-payload trojan.
eval(decodeURIComponent(process.env.PAYLOAD ?? ''));

export const noop = () => null;
