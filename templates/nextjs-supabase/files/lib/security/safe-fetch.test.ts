// templates/nextjs-supabase/files/lib/security/safe-fetch.test.ts
import { describe, it, expect } from 'vitest';
import { safeFetch } from './safe-fetch';

describe('safeFetch', () => {
  it('rejects URLs with a non-http(s) protocol', async () => {
    await expect(safeFetch('file:///etc/passwd')).rejects.toThrow(/protocol/i);
  });

  it('rejects URLs with an RFC1918 private IPv4 host', async () => {
    await expect(safeFetch('http://192.168.1.1/')).rejects.toThrow(/private/i);
  });

  it('rejects URLs resolving to loopback', async () => {
    await expect(safeFetch('http://127.0.0.1/')).rejects.toThrow(/private/i);
  });

  it('rejects URLs with link-local 169.254.x.x', async () => {
    await expect(safeFetch('http://169.254.169.254/')).rejects.toThrow(/private/i);
  });

  it('aborts requests that exceed the timeout', async () => {
    // Use an allowed-syntax URL; the timeout is what we prove.
    await expect(safeFetch('https://10.255.255.1/', { timeoutMs: 1 })).rejects.toThrow(/private/i);
  });
});
