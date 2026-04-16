/**
 * User Search API — GET /api/vuln-01-sqli
 *
 * VULN-01: SQL Injection via taint flow
 * Source: request body → variable → trim → template literal → db.query()
 * Expected: taint-analyzer, CWE-89, CRITICAL
 */
import { NextRequest, NextResponse } from 'next/server';

interface SearchResult {
  id: string;
  name: string;
  email: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id || typeof body.id !== 'string') {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'ID is required' } },
        { status: 400 },
      );
    }

    const id = body.id;
    const trimmed = id.trim();

    // VULNERABLE: template literal with tainted data flows into SQL query
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
