// Canonical test-file. Scanner must not emit.
import { describe, it, expect } from 'vitest';

describe('harness', () => {
  it('exercises unsafe-html shape', () => {
    const html = '<p>x</p>';
    const node = <div dangerouslySetInnerHTML={{ __html: html }} />;
    expect(node).toBeDefined();
  });
});
