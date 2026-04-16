import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const diagnosticCollection = vscode.languages.createDiagnosticCollection('aegis');

export function activate(context: vscode.ExtensionContext) {
  // Command: Scan Workspace
  context.subscriptions.push(
    vscode.commands.registerCommand('aegis.scan', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      await runScan(workspaceFolder.uri.fsPath);
    })
  );

  // Command: Show Score
  context.subscriptions.push(
    vscode.commands.registerCommand('aegis.showScore', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;

      try {
        const { stdout } = await execAsync(
          `npx @aegis-scan/cli scan "${workspaceFolder.uri.fsPath}" --format json`,
          { maxBuffer: 50 * 1024 * 1024 }
        );
        const result = JSON.parse(stdout);
        vscode.window.showInformationMessage(
          `AEGIS Score: ${result.score}/1000 — Grade ${result.grade} (${result.badge})`
        );
      } catch (err) {
        vscode.window.showErrorMessage(`AEGIS scan failed: ${err}`);
      }
    })
  );

  // Status bar item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'aegis.showScore';
  statusBarItem.text = '$(shield) AEGIS';
  statusBarItem.tooltip = 'Click to run AEGIS security scan';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

async function runScan(workspacePath: string) {
  const minSeverity = vscode.workspace.getConfiguration('aegis').get('severity.minimum', 'medium');

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'AEGIS Security Scan',
    cancellable: false,
  }, async (progress) => {
    progress.report({ message: 'Scanning...' });

    try {
      const { stdout } = await execAsync(
        `npx @aegis-scan/cli scan "${workspacePath}" --format json`,
        { maxBuffer: 50 * 1024 * 1024, timeout: 300_000 }
      );

      const result = JSON.parse(stdout);

      // Convert findings to VS Code diagnostics
      diagnosticCollection.clear();
      const diagMap = new Map<string, vscode.Diagnostic[]>();

      const severityOrder = ['info', 'low', 'medium', 'high', 'critical', 'blocker'];
      const minIdx = severityOrder.indexOf(minSeverity);

      for (const finding of result.findings) {
        const sevIdx = severityOrder.indexOf(finding.severity);
        if (sevIdx < minIdx) continue;
        if (!finding.file) continue;

        const uri = vscode.Uri.file(finding.file);
        const line = Math.max(0, (finding.line ?? 1) - 1);
        const range = new vscode.Range(line, 0, line, 200);

        const severity = finding.severity === 'blocker' || finding.severity === 'critical'
          ? vscode.DiagnosticSeverity.Error
          : finding.severity === 'high' || finding.severity === 'medium'
            ? vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Information;

        const diag = new vscode.Diagnostic(range, `[${finding.id}] ${finding.title}`, severity);
        diag.source = `aegis/${finding.scanner}`;
        if (finding.fix) diag.message += `\nFix: ${finding.fix}`;

        const existing = diagMap.get(uri.toString()) ?? [];
        existing.push(diag);
        diagMap.set(uri.toString(), existing);
      }

      for (const [uriStr, diags] of diagMap) {
        diagnosticCollection.set(vscode.Uri.parse(uriStr), diags);
      }

      vscode.window.showInformationMessage(
        `AEGIS: ${result.score}/1000 ${result.grade} — ${result.findings.length} findings`
      );
    } catch (err) {
      vscode.window.showErrorMessage(`AEGIS scan failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}

export function deactivate() {
  diagnosticCollection.dispose();
}
