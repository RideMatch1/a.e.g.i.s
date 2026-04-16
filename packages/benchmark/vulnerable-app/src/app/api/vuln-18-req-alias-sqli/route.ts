/**
 * req-alias SQL Injection — POST /api/vuln-18-req-alias-sqli
 *
 * VULN-18 (v0.7.1 regression pin): identical taint flow to VULN-01 but
 * using the `req` argument name instead of `request`. Pre-v0.7.1 the
 * TAINT_SOURCES list covered `request.json()` but NOT `req.json()` — a
 * byte-identical handler with only the argument renamed dropped the
 * CWE-89 finding silently.
 *
 * This fixture locks the symmetry in place: if the `req.*` entries are
 * ever removed from TAINT_SOURCES, benchmark flips red.
 * Expected: taint-analyzer, CWE-89, CRITICAL.
 */
import { NextRequest, NextResponse } from 'next/server';

interface SearchResult {
  id: string;
  name: string;
  email: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.id || typeof body.id !== 'string') {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'ID is required' } },
        { status: 400 },
      );
    }

    const id = body.id;
    const trimmed = id.trim();

    // VULNERABLE: tainted req.json() data flows into SQL query via template literal.
    // Pre-v0.7.1: req.json was missing from TAINT_SOURCES → silent FN.
    const query = `SELECT * FROM users WHERE id = ${trimmed}`;
    const results: SearchResult[] = await db.query(query);

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Search failed' } },
      { status: 500 },
    );
  }
}
