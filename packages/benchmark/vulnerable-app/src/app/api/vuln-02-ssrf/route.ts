/**
 * Webhook Proxy — POST /api/vuln-02-ssrf
 *
 * Fetches a remote URL on behalf of the caller and returns the response body.
 * Intended for previewing external webhook payloads during integration setup.
 */
import { NextRequest, NextResponse } from 'next/server';

interface ProxyRequest {
  url: string;
  method?: string;
}

interface ProxyResult {
  status: number;
  body: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body: ProxyRequest = await request.json();

    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'url is required' } },
        { status: 400 },
      );
    }

    // VULNERABLE: user-supplied URL flows directly into fetch()
    const upstream = await fetch(body.url, {
      method: body.method ?? 'GET',
    });

    const responseBody = await upstream.json();
    const result: ProxyResult = { status: upstream.status, body: responseBody };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'FETCH_FAILED', message: 'Could not reach remote endpoint' } },
      { status: 502 },
    );
  }
}
