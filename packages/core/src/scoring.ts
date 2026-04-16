import type { Finding, ScanCategory, Grade, Badge, AuditResult, Confidence } from './types.js';

// Spec-specified relative weights. These do NOT need to sum to 1.0 here;
// calculateScore normalizes by dividing each weight by the sum so the
// final score is always on a 0–1000 scale regardless.
export const CATEGORY_WEIGHTS: Record<ScanCategory, number> = {
  security: 0.20,
  dast: 0.10,
  dependencies: 0.10,
  compliance: 0.10,
  quality: 0.075,
  infrastructure: 0.075,
  accessibility: 0.05,
  performance: 0.05,
  'ai-llm': 0.05,
  i18n: 0.025,
  runtime: 0.025,
  attack: 0.05,
};

/** Base deduction per finding severity. Actual deduction uses diminishing returns. */
const SEVERITY_BASE_DEDUCTIONS: Record<string, number> = {
  blocker: Infinity,
  critical: 40,
  high: 15,
  medium: 5,
  low: 1,
  info: 0,
};

export function getGrade(score: number): Grade {
  if (score >= 950) return 'S';
  if (score >= 850) return 'A';
  if (score >= 700) return 'B';
  if (score >= 500) return 'C';
  if (score >= 300) return 'D';
  return 'F';
}

export function getBadge(grade: Grade): Badge {
  const map: Record<Grade, Badge> = {
    S: 'FORTRESS',
    A: 'HARDENED',
    B: 'SOLID',
    C: 'NEEDS_WORK',
    D: 'AT_RISK',
    F: 'CRITICAL',
  };
  return map[grade];
}

export interface ScoreResult {
  score: number;
  grade: Grade;
  badge: Badge;
  blocked: boolean;
  blockerReason?: string;
  breakdown: AuditResult['breakdown'];
  confidence: Confidence;
}

export function calculateScore(findings: Finding[], confidence: Confidence = 'high'): ScoreResult {
  // Check for blockers first — scanners are responsible for emitting severity: 'blocker'
  const blockerFinding = findings.find(
    (f) => f.severity === 'blocker',
  );
  if (blockerFinding) {
    const breakdown = buildBreakdown(findings);
    // Force all scores to 0
    for (const cat of Object.keys(breakdown) as ScanCategory[]) {
      breakdown[cat].score = 0;
    }
    return {
      score: 0,
      grade: 'F',
      badge: 'CRITICAL',
      blocked: true,
      blockerReason: `Blocker finding: ${blockerFinding.title} (${blockerFinding.id})`,
      breakdown,
      confidence,
    };
  }

  const breakdown = buildBreakdown(findings);

  // Normalize weights so they sum to 1.0, preserving relative ratios
  const weightSum = Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0);

  // Calculate weighted total score (0–1000)
  let totalScore = 0;
  for (const [cat, weight] of Object.entries(CATEGORY_WEIGHTS) as [ScanCategory, number][]) {
    const catData = breakdown[cat];
    const catScore = catData.score; // already 0–1000 for this category
    totalScore += catScore * (weight / weightSum);
  }

  // Round to nearest integer
  const score = Math.round(totalScore);
  let grade = getGrade(score);
  let badge = getBadge(grade);

  // Cap grade when confidence is low — S requires comprehensive scanning
  // A is still achievable with low confidence, but S (FORTRESS) requires proof
  if (confidence === 'low' && grade === 'S') {
    grade = 'A';
    badge = getBadge(grade);
  }

  return {
    score,
    grade,
    badge,
    blocked: false,
    breakdown,
    confidence,
  };
}

function buildBreakdown(findings: Finding[]): AuditResult['breakdown'] {
  // Initialize breakdown with full scores per category
  const breakdown = {} as AuditResult['breakdown'];
  for (const cat of Object.keys(CATEGORY_WEIGHTS) as ScanCategory[]) {
    breakdown[cat] = { score: 1000, maxScore: 1000, findings: 0 };
  }

  // Apply deductions per category with diminishing returns.
  // Each subsequent finding of the same category deducts less (1/sqrt(n) scaling).
  // This prevents 40 HIGH findings from completely zeroing a category while
  // still penalizing projects with more findings.
  const categoryFindingCount: Record<string, number> = {};

  for (const finding of findings) {
    const cat = finding.category;
    if (!(cat in breakdown)) continue;

    breakdown[cat].findings += 1;
    const baseDeduction = SEVERITY_BASE_DEDUCTIONS[finding.severity] ?? 0;
    if (baseDeduction === Infinity) {
      breakdown[cat].score = 0;
      continue;
    }
    if (baseDeduction === 0) continue;

    // Diminishing returns: nth finding deducts base / sqrt(n)
    categoryFindingCount[cat] = (categoryFindingCount[cat] ?? 0) + 1;
    const n = categoryFindingCount[cat];
    const actualDeduction = baseDeduction / Math.sqrt(n);
    breakdown[cat].score = Math.max(0, breakdown[cat].score - actualDeduction);
  }

  return breakdown;
}
