import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const sql = `SELECT * FROM users WHERE id = ${id}`;
  const result = await db.query(sql);
  return NextResponse.json(result);
}

declare const db: { query: (sql: string) => Promise<unknown> };
