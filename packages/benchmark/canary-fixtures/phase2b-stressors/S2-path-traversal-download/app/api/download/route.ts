import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

// S2 canary — path traversal via dynamic file parameter.
// User-controlled `file` name joined onto /uploads without any
// containment check. Attacker `?file=../../etc/passwd` reads
// arbitrary server files.

export async function GET(req: NextRequest) {
  const fileName = req.nextUrl.searchParams.get('file') ?? '';
  const filePath = path.join('./uploads', fileName);
  const data = await readFile(filePath);
  return new NextResponse(data);
}
