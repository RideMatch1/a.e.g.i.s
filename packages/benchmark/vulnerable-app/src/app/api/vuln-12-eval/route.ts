/**
 * Formula Evaluator — POST /api/vuln-12-eval
 *
 * Evaluates a mathematical or logical expression submitted by the user.
 * Used by the reporting dashboard to compute custom KPI formulas.
 */
import { NextRequest, NextResponse } from 'next/server';

interface EvalRequest {
  expression: string;
}

interface EvalResult { expression: string; result: unknown; type: string }

export async function POST(request: NextRequest) {
  try {
    const body: EvalRequest = await request.json();

    if (!body.expression || typeof body.expression !== 'string') {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'expression is required' } },
        { status: 400 },
      );
    }

    // VULNERABLE: user-supplied expression passed directly to eval()
    const result = eval(body.expression);

    const evalResult: EvalResult = {
      expression: body.expression,
      result,
      type: typeof result,
    };

    return NextResponse.json({ success: true, data: evalResult });
  } catch {
    return NextResponse.json(
      { error: { code: 'EVAL_FAILED', message: 'Expression evaluation failed' } },
      { status: 500 },
    );
  }
}
