/**
 * Feature Flags — POST /api/vuln-15-prototype-pollution
 *
 * Merges runtime feature flag overrides into the server configuration object.
 * Used by the ops dashboard to toggle features without a deployment.
 */
import { NextRequest, NextResponse } from 'next/server';

interface AppConfig {
  debug: boolean;
  maxUploadSizeMb: number;
  enableBetaFeatures: boolean;
  [key: string]: unknown;
}

const config: AppConfig = {
  debug: false,
  maxUploadSizeMb: 10,
  enableBetaFeatures: false,
};

export async function POST(request: NextRequest) {
  try {
    const overrides: Record<string, unknown> = await request.json();

    if (typeof overrides !== 'object' || overrides === null) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Body must be a JSON object' } },
        { status: 400 },
      );
    }

    // VULNERABLE: user-supplied object merged into config via Object.assign — allows __proto__ pollution
    Object.assign(config, overrides);

    return NextResponse.json({ success: true, config });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Failed to apply configuration overrides' } },
      { status: 500 },
    );
  }
}
