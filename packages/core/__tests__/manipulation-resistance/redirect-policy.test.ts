/**
 * APTS-MR-007/008/009 — safeFetch redirect/SSRF/DNS-rebind tests.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  safeFetch,
  classifyIp,
  isSafeFetchRejection,
} from '../../src/manipulation-resistance/redirect-policy.js';

describe('classifyIp', () => {
  it('classifies loopback', () => {
    expect(classifyIp('127.0.0.1')).toBe('loopback');
    expect(classifyIp('127.5.5.5')).toBe('loopback');
    expect(classifyIp('::1')).toBe('loopback');
  });

  it('classifies RFC 1918 private', () => {
    expect(classifyIp('10.0.0.1')).toBe('private');
    expect(classifyIp('172.16.0.1')).toBe('private');
    expect(classifyIp('192.168.1.1')).toBe('private');
  });

  it('classifies link-local', () => {
    expect(classifyIp('169.254.0.1')).toBe('link-local');
    expect(classifyIp('fe80::1')).toBe('link-local');
  });

  it('classifies cloud-metadata', () => {
    expect(classifyIp('169.254.169.254')).toBe('cloud-metadata');
  });

  it('classifies a routable IPv4 as public', () => {
    expect(classifyIp('8.8.8.8')).toBe('public');
    expect(classifyIp('1.1.1.1')).toBe('public');
  });

  it('treats unparseable input as non-public (private fallback)', () => {
    expect(classifyIp('not-an-ip')).toBe('private');
  });
});

describe('safeFetch', () => {
  it('rejects non-HTTP(S) protocols', async () => {
    await expect(
      safeFetch('file:///etc/passwd', { fetchImpl: vi.fn() }),
    ).rejects.toMatchObject({ reason: 'non-http-protocol' });
  });

  it('rejects loopback IP literal directly', async () => {
    await expect(
      safeFetch('http://127.0.0.1/', { fetchImpl: vi.fn() }),
    ).rejects.toMatchObject({ reason: 'loopback-ip' });
  });

  it('rejects RFC 1918 IP literal directly', async () => {
    await expect(
      safeFetch('http://10.0.0.1/', { fetchImpl: vi.fn() }),
    ).rejects.toMatchObject({ reason: 'private-ip' });
  });

  it('rejects cloud-metadata IP literal (AWS IMDS)', async () => {
    await expect(
      safeFetch('http://169.254.169.254/latest/meta-data/', { fetchImpl: vi.fn() }),
    ).rejects.toMatchObject({ reason: 'cloud-metadata-ip' });
  });

  it('rejects when DNS lookup resolves to a private IP', async () => {
    const dnsLookup = vi.fn(async () => '10.0.0.1');
    await expect(
      safeFetch('https://internal.local/', { dnsLookup, fetchImpl: vi.fn() }),
    ).rejects.toMatchObject({ reason: 'private-ip' });
    expect(dnsLookup).toHaveBeenCalled();
  });

  it('passes a public-IP fetch through to the underlying fetch impl', async () => {
    const dnsLookup = vi.fn(async () => '8.8.8.8');
    const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 }));
    const res = await safeFetch('https://routable.example/', { dnsLookup, fetchImpl });
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('re-validates redirect targets via the same policy', async () => {
    const dnsLookup = vi.fn(async () => '8.8.8.8');
    const fetchImpl = vi.fn();
    fetchImpl
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: 'http://10.0.0.1/inner' } }),
      );
    await expect(
      safeFetch('https://routable.example/', { dnsLookup, fetchImpl }),
    ).rejects.toMatchObject({ reason: 'private-ip' });
  });

  it('isSafeFetchRejection narrows correctly for thrown rejections', async () => {
    try {
      await safeFetch('file:///x', { fetchImpl: vi.fn() });
    } catch (err) {
      expect(isSafeFetchRejection(err)).toBe(true);
    }
  });

  it('fails the chain after maxRedirects hops', async () => {
    const dnsLookup = vi.fn(async () => '8.8.8.8');
    const fetchImpl = vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: 'https://routable.example/next' } }),
    );
    await expect(
      safeFetch('https://routable.example/', { dnsLookup, fetchImpl, maxRedirects: 2 }),
    ).rejects.toMatchObject({ reason: 'redirect-chain-too-long' });
  });

  describe('allowLoopback opt-in (--allow-loopback)', () => {
    it('rejects loopback by default', async () => {
      const fetchImpl = vi.fn();
      await expect(
        safeFetch('http://127.0.0.1:3000/', { fetchImpl }),
      ).rejects.toMatchObject({ reason: 'loopback-ip' });
    });

    it('permits loopback IPv4 when allowLoopback=true', async () => {
      const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 }));
      const res = await safeFetch('http://127.0.0.1:3000/', {
        allowLoopback: true,
        fetchImpl,
      });
      expect(res.status).toBe(200);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('permits loopback IPv6 (::1) when allowLoopback=true', async () => {
      const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 }));
      const res = await safeFetch('http://[::1]:3000/', {
        allowLoopback: true,
        fetchImpl,
      });
      expect(res.status).toBe(200);
    });

    it('allowLoopback does NOT bypass private-ip rejection', async () => {
      const dnsLookup = vi.fn(async () => '10.0.0.5');
      const fetchImpl = vi.fn();
      await expect(
        safeFetch('http://corp.internal/', { allowLoopback: true, dnsLookup, fetchImpl }),
      ).rejects.toMatchObject({ reason: 'private-ip' });
    });

    it('allowLoopback does NOT bypass cloud-metadata rejection', async () => {
      const fetchImpl = vi.fn();
      await expect(
        safeFetch('http://169.254.169.254/latest/meta-data', { allowLoopback: true, fetchImpl }),
      ).rejects.toMatchObject({ reason: 'cloud-metadata-ip' });
    });

    it('allowLoopback does NOT bypass link-local rejection', async () => {
      const fetchImpl = vi.fn();
      await expect(
        safeFetch('http://169.254.5.5/', { allowLoopback: true, fetchImpl }),
      ).rejects.toMatchObject({ reason: 'link-local-ip' });
    });

    it('permits loopback when DNS resolves a hostname to 127.0.0.1', async () => {
      const dnsLookup = vi.fn(async () => '127.0.0.1');
      const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 }));
      const res = await safeFetch('http://localhost.example/', {
        allowLoopback: true,
        dnsLookup,
        fetchImpl,
      });
      expect(res.status).toBe(200);
    });
  });
});
