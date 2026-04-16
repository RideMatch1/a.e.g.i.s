/**
 * Static Asset Reader — GET /api/vuln-04-path-traversal
 *
 * Reads a file from the server's public assets directory and returns its content.
 * Used by the template engine to serve configuration snippets by filename.
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const file = request.nextUrl.searchParams.get('file');

    if (!file) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAM', message: 'file parameter is required' } },
        { status: 400 },
      );
    }

    const allowedExtensions = ['.txt', '.json', '.html'];
    const ext = path.extname(file);

    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json(
        { error: { code: 'INVALID_TYPE', message: 'File type not permitted' } },
        { status: 400 },
      );
    }

    // VULNERABLE: user-supplied path flows into fs.readFileSync without normalisation
    const filePath = path.join('/public/assets', file);
    const content = fs.readFileSync(filePath!, 'utf-8');

    return NextResponse.json({ success: true, content });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'READ_FAILED', message: 'Could not read file' } },
      { status: 500 },
    );
  }
}
