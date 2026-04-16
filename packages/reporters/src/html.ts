import type { AuditResult, Finding, Reporter } from '@aegis-scan/core';
import { getVersion } from '@aegis-scan/core';

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function severityBadgeStyle(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'blocker':
      return 'background:#ff1744;color:#fff;font-weight:700;';
    case 'critical':
      return 'background:#d32f2f;color:#fff;font-weight:700;';
    case 'high':
      return 'background:#ff5722;color:#fff;font-weight:600;';
    case 'medium':
      return 'background:#ffc107;color:#1a1a2e;font-weight:600;';
    case 'low':
      return 'background:#1565c0;color:#fff;';
    case 'info':
    default:
      return 'background:#37474f;color:#cfd8dc;';
  }
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'S':
    case 'A':
      return '#00e676';
    case 'B':
      return '#ffeb3b';
    case 'C':
      return '#ff9800';
    case 'D':
      return '#ff5722';
    default:
      return '#ff1744';
  }
}

function scoreGaugePct(score: number): number {
  // Score is 0–1000
  return Math.round(Math.max(0, Math.min(100, score / 10)));
}

function gaugeColor(score: number): string {
  if (score >= 800) return '#00e676';
  if (score >= 600) return '#ffeb3b';
  return '#ff5722';
}

function confidenceColor(confidence: string): string {
  switch (confidence) {
    case 'high':
      return '#00e676';
    case 'medium':
      return '#ffeb3b';
    default:
      return '#ff5722';
  }
}

function renderCategoryRows(breakdown: AuditResult['breakdown']): string {
  const rows: string[] = [];
  for (const [cat, data] of Object.entries(breakdown)) {
    const pct = data.maxScore > 0 ? Math.round((data.score / data.maxScore) * 100) : 0;
    let barColor = '#00e676';
    if (pct < 80) barColor = '#ffeb3b';
    if (pct < 50) barColor = '#ff5722';

    rows.push(`
      <tr>
        <td class="cat-name">${escHtml(cat)}</td>
        <td class="cat-bar-cell">
          <div class="cat-bar-track">
            <div class="cat-bar-fill" style="width:${pct}%;background:${barColor};"></div>
          </div>
        </td>
        <td class="cat-score" style="color:${barColor};">${data.score}/${data.maxScore}</td>
        <td class="cat-findings">${data.findings > 0 ? `<span class="findings-count">${data.findings}</span>` : '<span class="findings-zero">0</span>'}</td>
      </tr>`);
  }
  return rows.join('');
}

function renderFindingRow(finding: Finding, index: number): string {
  const loc = finding.file
    ? finding.line != null
      ? `${escHtml(finding.file)}:${finding.line}`
      : escHtml(finding.file)
    : '—';

  const detailId = `finding-detail-${index}`;

  const extraRows: string[] = [];
  if (finding.description) {
    extraRows.push(`
          <tr class="detail-row" id="${detailId}-desc">
            <td colspan="5" class="detail-cell">
              <div class="detail-block">
                <span class="detail-label">Description:</span>
                <span class="detail-text">${escHtml(finding.description)}</span>
              </div>
              ${finding.fix ? `<div class="detail-block fix-block">
                <span class="detail-label">Fix:</span>
                <span class="detail-text fix-text">${escHtml(finding.fix)}</span>
              </div>` : ''}
            </td>
          </tr>`);
  }

  return `
        <tr class="finding-row" onclick="toggleDetail('${detailId}')" style="cursor:pointer;">
          <td><span class="severity-badge" style="${severityBadgeStyle(finding.severity)}">${escHtml(finding.severity.toUpperCase())}</span></td>
          <td class="finding-title">${escHtml(finding.title)}</td>
          <td class="finding-loc">${loc}</td>
          <td class="finding-scanner">${escHtml(finding.scanner)}</td>
          <td class="finding-id">${escHtml(finding.id)}</td>
        </tr>
        ${extraRows.join('')}`;
}

function renderFindingsTable(findings: Finding[]): string {
  if (findings.length === 0) {
    return '<div class="no-findings">No findings — clean audit.</div>';
  }

  const severityOrder: string[] = ['blocker', 'critical', 'high', 'medium', 'low', 'info'];
  const sorted = [...findings].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity),
  );

  const rows = sorted.map((f, i) => renderFindingRow(f, i)).join('');

  return `
    <table class="findings-table">
      <thead>
        <tr>
          <th>Severity</th>
          <th>Title</th>
          <th>Location</th>
          <th>Scanner</th>
          <th>ID</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}

function renderScannerSection(scanResults: AuditResult['scanResults']): string {
  const available = scanResults.filter((r) => r.available);
  const unavailable = scanResults.filter((r) => !r.available);

  const availRows = available.map((r) => {
    const dur = r.duration >= 1000
      ? `${(r.duration / 1000).toFixed(1)}s`
      : `${r.duration}ms`;
    return `<tr>
      <td><span class="scanner-dot active-dot"></span>${escHtml(r.scanner)}</td>
      <td class="scanner-cat">${escHtml(r.category)}</td>
      <td class="scanner-dur">${dur}</td>
      <td class="scanner-findings">${r.findings.length}</td>
    </tr>`;
  }).join('');

  const unavailRows = unavailable.map((r) => `<tr class="unavail-row">
    <td><span class="scanner-dot unavail-dot"></span>${escHtml(r.scanner)}</td>
    <td class="scanner-cat">${escHtml(r.category)}</td>
    <td colspan="2" class="scanner-unavail">not installed${r.error ? ` — ${escHtml(r.error)}` : ''}</td>
  </tr>`).join('');

  return `
    <table class="scanner-table">
      <thead>
        <tr>
          <th>Scanner</th>
          <th>Category</th>
          <th>Duration</th>
          <th>Findings</th>
        </tr>
      </thead>
      <tbody>
        ${availRows}
        ${unavailRows}
      </tbody>
    </table>`;
}

function format(result: AuditResult): string {
  const pct = scoreGaugePct(result.score);
  const gColor = gaugeColor(result.score);
  const grColor = gradeColor(result.grade);
  const cColor = confidenceColor(result.confidence);

  const durationStr = result.duration >= 1000
    ? `${(result.duration / 1000).toFixed(1)}s`
    : `${result.duration}ms`;

  const totalScanners = result.scanResults.length;
  const unavailableCount = result.scanResults.filter((r) => !r.available).length;
  const activeCount = totalScanners - unavailableCount;

  const stackParts = [
    result.stack.framework,
    result.stack.database,
    result.stack.language,
  ].filter(Boolean).join(' &middot; ');

  const blockerBanner = result.blocked
    ? `<div class="blocker-banner">
        <span class="blocker-icon">&#9940;</span>
        <strong>BLOCKED</strong> &mdash; ${escHtml(result.blockerReason ?? 'Critical security issues detected')}
      </div>`
    : '';

  // Circumference for SVG gauge circle: r=54, C = 2*pi*54 ≈ 339.3
  const circumference = 339;
  const dashOffset = Math.round(circumference * (1 - pct / 100));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AEGIS Security Audit Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #1a1a2e;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.5;
    }

    a { color: #00d4ff; }

    /* ── Layout ─────────────────────────────── */
    .page-wrapper {
      max-width: 1100px;
      margin: 0 auto;
      padding: 32px 24px 64px;
    }

    /* ── Header ─────────────────────────────── */
    .report-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 24px;
      border-bottom: 1px solid #2a2a4a;
      padding-bottom: 32px;
      margin-bottom: 40px;
    }

    .header-left h1 {
      font-size: 26px;
      font-weight: 700;
      color: #00d4ff;
      letter-spacing: 3px;
      text-transform: uppercase;
    }

    .header-left .subtitle {
      font-size: 12px;
      color: #607d8b;
      margin-top: 4px;
      letter-spacing: 1px;
    }

    .header-metrics {
      display: flex;
      align-items: center;
      gap: 32px;
      flex-wrap: wrap;
    }

    /* Gauge */
    .gauge-wrap {
      position: relative;
      width: 120px;
      height: 120px;
    }

    .gauge-wrap svg {
      transform: rotate(-90deg);
    }

    .gauge-track {
      fill: none;
      stroke: #2a2a4a;
      stroke-width: 10;
    }

    .gauge-fill {
      fill: none;
      stroke-width: 10;
      stroke-linecap: round;
      transition: stroke-dashoffset 0.6s ease;
    }

    .gauge-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      pointer-events: none;
    }

    .gauge-score {
      font-size: 22px;
      font-weight: 700;
      line-height: 1;
    }

    .gauge-label {
      font-size: 10px;
      color: #607d8b;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    /* Grade badge */
    .grade-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .grade-value {
      font-size: 52px;
      font-weight: 900;
      line-height: 1;
    }

    .grade-label {
      font-size: 10px;
      color: #607d8b;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    /* Meta chips */
    .meta-chips {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }

    .chip-label {
      color: #607d8b;
      min-width: 80px;
    }

    .chip-value {
      font-weight: 600;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 3px;
      background: #16213e;
      border: 1px solid #2a2a4a;
    }

    /* ── Blocker ────────────────────────────── */
    .blocker-banner {
      background: #b71c1c;
      border: 1px solid #ff1744;
      border-radius: 6px;
      padding: 16px 20px;
      margin-bottom: 32px;
      font-size: 15px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .blocker-icon {
      font-size: 20px;
    }

    /* ── Sections ───────────────────────────── */
    .section {
      margin-bottom: 40px;
    }

    .section-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #00d4ff;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #2a2a4a;
    }

    /* ── Category breakdown ─────────────────── */
    .cat-table {
      width: 100%;
      border-collapse: collapse;
    }

    .cat-name {
      width: 200px;
      font-size: 13px;
      color: #b0bec5;
      padding: 8px 12px 8px 0;
    }

    .cat-bar-cell {
      padding: 8px 16px 8px 0;
    }

    .cat-bar-track {
      background: #16213e;
      border-radius: 4px;
      height: 10px;
      width: 100%;
      min-width: 200px;
      overflow: hidden;
    }

    .cat-bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.5s ease;
    }

    .cat-score {
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      padding: 8px 16px 8px 0;
      min-width: 70px;
    }

    .cat-findings {
      font-size: 12px;
      text-align: right;
      padding: 8px 0;
    }

    .findings-count {
      background: #ff5722;
      color: #fff;
      border-radius: 12px;
      padding: 1px 7px;
      font-size: 11px;
      font-weight: 600;
    }

    .findings-zero {
      color: #37474f;
    }

    /* ── Findings table ─────────────────────── */
    .findings-table, .scanner-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .findings-table th, .scanner-table th {
      text-align: left;
      font-size: 11px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #607d8b;
      padding: 10px 12px;
      border-bottom: 1px solid #2a2a4a;
      background: #16213e;
    }

    .findings-table td, .scanner-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #1e1e3a;
      vertical-align: top;
    }

    .finding-row:hover {
      background: #1e1e3a;
    }

    .severity-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
      white-space: nowrap;
    }

    .finding-title {
      font-weight: 600;
      color: #eceff1;
    }

    .finding-loc {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #00d4ff;
      white-space: nowrap;
    }

    .finding-scanner {
      color: #78909c;
      font-size: 12px;
    }

    .finding-id {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      color: #455a64;
    }

    /* Detail rows */
    .detail-row { display: none; }
    .detail-row.open { display: table-row; }

    .detail-cell {
      background: #12122a;
      padding: 12px 16px 16px 24px;
    }

    .detail-block {
      display: flex;
      gap: 10px;
      margin-top: 6px;
    }

    .detail-label {
      color: #607d8b;
      font-size: 12px;
      min-width: 90px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .detail-text {
      color: #b0bec5;
      font-size: 13px;
    }

    .fix-block {
      margin-top: 8px;
    }

    .fix-text {
      color: #00e676;
    }

    .no-findings {
      padding: 24px;
      text-align: center;
      color: #00e676;
      font-size: 15px;
      background: #12122a;
      border-radius: 6px;
    }

    /* ── Scanners ───────────────────────────── */
    .scanner-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 8px;
      vertical-align: middle;
    }

    .active-dot { background: #00e676; }
    .unavail-dot { background: #455a64; }
    .unavail-row { opacity: 0.5; }

    .scanner-cat {
      font-size: 12px;
      color: #78909c;
    }

    .scanner-dur {
      font-size: 12px;
      color: #607d8b;
      text-align: right;
    }

    .scanner-findings {
      font-size: 12px;
      text-align: right;
    }

    .scanner-unavail {
      font-size: 12px;
      color: #455a64;
      font-style: italic;
    }

    /* ── Footer ─────────────────────────────── */
    .report-footer {
      margin-top: 48px;
      padding-top: 20px;
      border-top: 1px solid #2a2a4a;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 12px;
      color: #455a64;
    }

    .footer-right {
      text-align: right;
    }
  </style>
</head>
<body>
  <div class="page-wrapper">

    <!-- Header -->
    <header class="report-header">
      <div class="header-left">
        <h1>AEGIS Security Audit</h1>
        <div class="subtitle">Automated Enterprise-Grade Inspection Suite &mdash; ${escHtml(stackParts)}</div>
      </div>

      <div class="header-metrics">
        <!-- Score gauge -->
        <div class="gauge-wrap">
          <svg viewBox="0 0 120 120" width="120" height="120">
            <circle class="gauge-track" cx="60" cy="60" r="54"/>
            <circle class="gauge-fill"
              cx="60" cy="60" r="54"
              stroke="${gColor}"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${dashOffset}"/>
          </svg>
          <div class="gauge-text">
            <div class="gauge-score" style="color:${gColor};">${result.score}</div>
            <div class="gauge-label">Score</div>
          </div>
        </div>

        <!-- Grade -->
        <div class="grade-badge">
          <div class="grade-value" style="color:${grColor};">${escHtml(result.grade)}</div>
          <div class="grade-label">Grade</div>
        </div>

        <!-- Meta chips -->
        <div class="meta-chips">
          <div class="chip">
            <span class="chip-label">Badge</span>
            <span class="chip-value" style="color:#e0e0e0;">${escHtml(result.badge)}</span>
          </div>
          <div class="chip">
            <span class="chip-label">Confidence</span>
            <span class="chip-value" style="color:${cColor};">${escHtml(result.confidence.toUpperCase())}</span>
          </div>
          <div class="chip">
            <span class="chip-label">Findings</span>
            <span class="chip-value" style="color:${result.findings.length > 0 ? '#ff5722' : '#00e676'};">${result.findings.length}</span>
          </div>
        </div>
      </div>
    </header>

    ${blockerBanner}

    <!-- Category Breakdown -->
    <section class="section">
      <div class="section-title">Category Breakdown</div>
      <table class="cat-table">
        <tbody>
          ${renderCategoryRows(result.breakdown)}
        </tbody>
      </table>
    </section>

    <!-- Findings -->
    <section class="section">
      <div class="section-title">Findings (${result.findings.length})</div>
      ${renderFindingsTable(result.findings)}
    </section>

    <!-- Scanners -->
    <section class="section">
      <div class="section-title">Scanners (${activeCount} active / ${totalScanners} total)</div>
      ${renderScannerSection(result.scanResults)}
    </section>

    <!-- Footer -->
    <footer class="report-footer">
      <div class="footer-left">
        AEGIS v${getVersion()} &mdash; Completed in ${durationStr} &mdash; ${activeCount}/${totalScanners} scanners active
      </div>
      <div class="footer-right">
        ${escHtml(result.timestamp)}
      </div>
    </footer>

  </div>

  <script>
    function toggleDetail(id) {
      var rows = document.querySelectorAll('[id^="' + id + '"]');
      rows.forEach(function(row) {
        row.classList.toggle('open');
      });
    }
  </script>
</body>
</html>`;
}

export const htmlReporter: Reporter = {
  name: 'html',
  format,
};
