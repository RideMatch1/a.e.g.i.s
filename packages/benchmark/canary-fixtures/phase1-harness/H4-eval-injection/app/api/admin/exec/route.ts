import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const code = body.code as string;
  const result = eval(code);
  return NextResponse.json({ result });
}
