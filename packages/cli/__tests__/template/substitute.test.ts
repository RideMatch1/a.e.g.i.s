import { describe, it, expect } from 'vitest';
import { substitute } from '../../src/template/substitute.js';

describe('substitute', () => {
  it('replaces a single {{KEY}} with the given value', () => {
    expect(substitute('hello {{NAME}}', { NAME: 'world' })).toBe('hello world');
  });

  it('replaces multiple occurrences of the same key', () => {
    expect(substitute('{{X}}-{{X}}', { X: 'a' })).toBe('a-a');
  });

  it('replaces multiple distinct keys', () => {
    expect(substitute('{{A}}/{{B}}', { A: 'x', B: 'y' })).toBe('x/y');
  });

  it('leaves unknown placeholders untouched (conservative)', () => {
    expect(substitute('{{KNOWN}} + {{UNKNOWN}}', { KNOWN: 'ok' })).toBe('ok + {{UNKNOWN}}');
  });

  it('does not recursively expand replacement values', () => {
    expect(substitute('{{A}}', { A: '{{B}}', B: 'recursed' })).toBe('{{B}}');
  });

  it('is a no-op when no placeholders are present', () => {
    expect(substitute('plain text, no braces', { X: 'ignored' })).toBe('plain text, no braces');
  });
});
