import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import { AddressInfo, connect as netConnect } from 'node:net';
import { fetch as undiciFetch, getGlobalDispatcher, setGlobalDispatcher, type Dispatcher } from 'undici';
import {
  opsecPace,
  applyOpsecHeaders,
  applyOpsecDispatcher,
  validateProxyUrl,
  _resetOpsecPacingForTesting,
} from '../../src/runtime/opsec.js';

describe('opsecPace — request pacing', () => {
  beforeEach(() => _resetOpsecPacingForTesting());

  it('is a no-op when opsec is undefined', async () => {
    const start = Date.now();
    await opsecPace(undefined);
    expect(Date.now() - start).toBeLessThan(20);
  });

  it('is a no-op when rateMs and jitterMs are both 0', async () => {
    const start = Date.now();
    await opsecPace({ rateMs: 0, jitterMs: 0 });
    expect(Date.now() - start).toBeLessThan(20);
  });

  it('enforces rateMs minimum between successive calls', async () => {
    const opsec = { rateMs: 100 };
    await opsecPace(opsec);
    const t1 = Date.now();
    await opsecPace(opsec);
    const t2 = Date.now();
    // Must wait at least rateMs between calls. Allow some scheduler slop on the upper bound.
    expect(t2 - t1).toBeGreaterThanOrEqual(80);
    expect(t2 - t1).toBeLessThan(180);
  });

  it('adds jitter on top of rateMs', async () => {
    const opsec = { rateMs: 50, jitterMs: 50 };
    await opsecPace(opsec);
    const t1 = Date.now();
    await opsecPace(opsec);
    const t2 = Date.now();
    // 50 base + 0..50 jitter = 50..100ms; allow scheduler slop
    expect(t2 - t1).toBeGreaterThanOrEqual(40);
    expect(t2 - t1).toBeLessThan(140);
  });

  it('applies jitter even when rateMs is 0', async () => {
    const opsec = { rateMs: 0, jitterMs: 100 };
    const start = Date.now();
    await opsecPace(opsec);
    const elapsed = Date.now() - start;
    // 0..100ms jitter
    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(elapsed).toBeLessThan(140);
  });

  it('pacing across non-trivial gap does not over-sleep', async () => {
    const opsec = { rateMs: 50 };
    await opsecPace(opsec);
    // Manually wait longer than rateMs
    await new Promise((r) => setTimeout(r, 80));
    const t1 = Date.now();
    await opsecPace(opsec);
    const t2 = Date.now();
    // Should NOT sleep — already 80ms since last call, > 50ms rate
    expect(t2 - t1).toBeLessThan(20);
  });
});

describe('applyOpsecHeaders — User-Agent override', () => {
  it('returns a new init unchanged when opsec is undefined', () => {
    const init = { method: 'GET' };
    const result = applyOpsecHeaders(init, undefined);
    expect(result).toEqual(init);
    expect(result).not.toBe(init);
  });

  it('returns init unchanged when opsec has no userAgent', () => {
    const init = { method: 'GET' };
    const result = applyOpsecHeaders(init, { rateMs: 100 });
    expect(result).toEqual(init);
  });

  it('handles undefined init by returning a fresh init with UA', () => {
    const result = applyOpsecHeaders(undefined, { userAgent: 'AEGIS-Engagement/1.0' });
    const headers = new Headers(result.headers);
    expect(headers.get('User-Agent')).toBe('AEGIS-Engagement/1.0');
  });

  it('sets User-Agent when opsec.userAgent is provided', () => {
    const result = applyOpsecHeaders({ method: 'GET' }, { userAgent: 'AEGIS-Engagement-2026/1.0' });
    const headers = new Headers(result.headers);
    expect(headers.get('User-Agent')).toBe('AEGIS-Engagement-2026/1.0');
  });

  it('overrides an existing User-Agent header', () => {
    const result = applyOpsecHeaders(
      { method: 'GET', headers: { 'User-Agent': 'old-ua' } },
      { userAgent: 'new-ua' },
    );
    const headers = new Headers(result.headers);
    expect(headers.get('User-Agent')).toBe('new-ua');
  });

  it('preserves other headers', () => {
    const result = applyOpsecHeaders(
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Custom': 'value' },
      },
      { userAgent: 'AEGIS' },
    );
    const headers = new Headers(result.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-Custom')).toBe('value');
    expect(headers.get('User-Agent')).toBe('AEGIS');
  });

  it('does NOT mutate the input init', () => {
    const init = { method: 'GET', headers: { 'User-Agent': 'original' } };
    const result = applyOpsecHeaders(init, { userAgent: 'override' });
    // Original init's headers should be unchanged
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('original');
    // Result has the override
    const resHeaders = new Headers(result.headers);
    expect(resHeaders.get('User-Agent')).toBe('override');
  });
});

describe('validateProxyUrl — fail-fast at flag-parse time', () => {
  it('accepts a well-formed http proxy URL', () => {
    expect(() => validateProxyUrl('http://127.0.0.1:8080')).not.toThrow();
  });

  it('accepts a well-formed https proxy URL', () => {
    expect(() => validateProxyUrl('https://proxy.example.com:443')).not.toThrow();
  });

  it('rejects a non-URL string', () => {
    expect(() => validateProxyUrl('not-a-url')).toThrow(/Invalid --proxy URL/);
  });

  it('rejects a non-http(s) protocol', () => {
    expect(() => validateProxyUrl('socks5://127.0.0.1:1080')).toThrow(/Invalid --proxy protocol/);
  });

  it('rejects file:// scheme', () => {
    expect(() => validateProxyUrl('file:///etc/passwd')).toThrow(/Invalid --proxy protocol/);
  });
});

describe('applyOpsecDispatcher — global dispatcher save/restore', () => {
  let priorDispatcher: Dispatcher;

  beforeEach(() => {
    // Snapshot the dispatcher BEFORE each test so leakage between tests is
    // detectable in afterEach. This is the discipline operators of long-lived
    // Node processes need too — see runtime/opsec.ts docstring.
    priorDispatcher = getGlobalDispatcher();
  });

  afterEach(() => {
    // Hard restore: even if a test forgot to call its restore-fn, the next
    // test must not inherit a polluted dispatcher.
    setGlobalDispatcher(priorDispatcher);
  });

  it('is a no-op when opsec is undefined', () => {
    const before = getGlobalDispatcher();
    const restore = applyOpsecDispatcher(undefined);
    expect(getGlobalDispatcher()).toBe(before);
    restore();
    expect(getGlobalDispatcher()).toBe(before);
  });

  it('is a no-op when proxy field is unset', () => {
    const before = getGlobalDispatcher();
    const restore = applyOpsecDispatcher({ userAgent: 'x', rateMs: 100 });
    expect(getGlobalDispatcher()).toBe(before);
    restore();
    expect(getGlobalDispatcher()).toBe(before);
  });

  it('installs a different dispatcher when proxy is set, and restore puts the prior one back', () => {
    const before = getGlobalDispatcher();
    const restore = applyOpsecDispatcher({ proxy: 'http://127.0.0.1:9999' });
    const installed = getGlobalDispatcher();
    expect(installed).not.toBe(before);
    restore();
    expect(getGlobalDispatcher()).toBe(before);
  });

  it('throws on invalid proxy URL before mutating the dispatcher', () => {
    const before = getGlobalDispatcher();
    expect(() => applyOpsecDispatcher({ proxy: 'not-a-url' })).toThrow(/Invalid --proxy URL/);
    expect(getGlobalDispatcher()).toBe(before);
  });

  it('routes native fetch through the proxy (in-process CONNECT-tunnel integration)', async () => {
    // Brutal-honest test (per advisor 2026-05-02): spin up a real target
    // server + a CONNECT-tunneling proxy and verify undici.ProxyAgent
    // (default proxyTunnel=true in undici 8.x) routes traffic through the
    // proxy. Replaces the manual mitmproxy step with something CI-runnable
    // and deterministic. Two servers wired loopback:
    //   target — handles the actual GET request, records the path
    //   proxy  — handles CONNECT, pipes the socket through to target
    // Assertion: BOTH servers must observe traffic; proxy MUST see a
    // CONNECT for the target's host:port, target MUST see the GET.
    const targetGets: string[] = [];
    const target: Server = await new Promise((resolve) => {
      const s = createServer((req, res) => {
        targetGets.push(req.url ?? '?');
        const body = 'proxied-tunnel';
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Content-Length': String(Buffer.byteLength(body)),
        });
        res.end(body);
      });
      s.listen(0, '127.0.0.1', () => resolve(s));
    });
    const targetPort = (target.address() as AddressInfo).port;

    const proxyConnects: string[] = [];
    const proxy: Server = await new Promise((resolve) => {
      const s = createServer();
      s.on('connect', (req, clientSocket, head) => {
        proxyConnects.push(req.url ?? '?');
        const [host, portStr] = (req.url ?? '').split(':');
        const tunnel = netConnect(Number.parseInt(portStr, 10), host, () => {
          clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          if (head.length > 0) tunnel.write(head);
          tunnel.pipe(clientSocket);
          clientSocket.pipe(tunnel);
        });
        tunnel.on('error', () => {
          try {
            clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
          } catch {
            /* ignore */
          }
          clientSocket.destroy();
        });
        clientSocket.on('error', () => tunnel.destroy());
      });
      s.listen(0, '127.0.0.1', () => resolve(s));
    });
    const proxyPort = (proxy.address() as AddressInfo).port;

    const restore = applyOpsecDispatcher({ proxy: `http://127.0.0.1:${proxyPort}` });
    try {
      // Use undici's fetch directly to keep the dispatcher path explicit in
      // the assertion (no assumption about which undici copy provides
      // globalThis.fetch). Node's bundled undici and the npm undici share
      // global dispatcher state via the well-known
      // Symbol.for('undici.globalDispatcher.1'), so production flows that
      // call globalThis.fetch in attack-probes route through the same
      // ProxyAgent installed here. The 7.x and 8.x undici lines have
      // identical proxyTunnel default + dispatcher contract.
      const response = await undiciFetch(`http://127.0.0.1:${targetPort}/probe`);
      const body = await response.text();
      expect(body).toBe('proxied-tunnel');
      expect(proxyConnects.length).toBe(1);
      expect(proxyConnects[0]).toBe(`127.0.0.1:${targetPort}`);
      expect(targetGets).toEqual(['/probe']);
    } finally {
      restore();
      await new Promise<void>((r) => proxy.close(() => r()));
      await new Promise<void>((r) => target.close(() => r()));
    }
  }, 15_000);
});
