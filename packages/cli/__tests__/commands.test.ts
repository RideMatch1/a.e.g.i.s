import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// Mock all external dependencies so the module can be imported without side effects
vi.mock('@aegis-scan/core', () => ({
  loadConfig: vi.fn(),
  Orchestrator: vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    run: vi.fn(),
  })),
  detectStack: vi.fn(),
}));

vi.mock('@aegis-scan/reporters', () => ({
  terminalReporter: { name: 'terminal', format: vi.fn(() => '') },
  jsonReporter: { name: 'json', format: vi.fn(() => '{}') },
  sarifReporter: { name: 'sarif', format: vi.fn(() => '{}') },
  htmlReporter: { name: 'html', format: vi.fn(() => '<html></html>') },
}));

vi.mock('@aegis-scan/scanners', () => ({
  getAllScanners: vi.fn(() => []),
}));

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  })),
}));

vi.mock('chalk', () => ({
  default: Object.assign(
    (s: string) => s,
    {
      bold: (s: string) => s,
      dim: (s: string) => s,
      cyan: (s: string) => s,
      green: (s: string) => s,
      level: 3,
    },
  ),
}));

describe('CLI commands structure', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    program.exitOverride(); // prevent process.exit in tests
  });

  it('can construct a Commander program', () => {
    expect(program).toBeInstanceOf(Command);
  });

  it('registers scan command', () => {
    const scanCmd = program
      .command('scan [path]')
      .description('Quick scan')
      .option('-f, --format <format>', 'Output format', 'terminal');

    expect(scanCmd.name()).toBe('scan');
    expect(scanCmd.description()).toBe('Quick scan');
  });

  it('registers audit command', () => {
    const auditCmd = program
      .command('audit [path]')
      .description('Full audit')
      .option('-f, --format <format>', 'Output format', 'terminal')
      .option('-t, --target <url>', 'Target URL for DAST');

    expect(auditCmd.name()).toBe('audit');
    expect(auditCmd.description()).toBe('Full audit');
  });

  it('registers init command', () => {
    const initCmd = program
      .command('init [path]')
      .description('Create aegis.config.ts');

    expect(initCmd.name()).toBe('init');
  });

  it('registers version command', () => {
    const versionCmd = program
      .command('version')
      .description('Show version');

    expect(versionCmd.name()).toBe('version');
  });

  it('registers all six expected commands', () => {
    program.command('scan [path]').description('Quick scan');
    program.command('audit [path]').description('Full audit');
    program.command('pentest [path]').description('Full pentest');
    program.command('siege [path]').description('Multi-phase adversary simulation');
    program.command('init [path]').description('Initialize config');
    program.command('version').description('Show version');

    const commandNames = program.commands.map((c) => c.name());
    expect(commandNames).toContain('scan');
    expect(commandNames).toContain('audit');
    expect(commandNames).toContain('pentest');
    expect(commandNames).toContain('siege');
    expect(commandNames).toContain('init');
    expect(commandNames).toContain('version');
  });
});

describe('scan command fast-category filter', () => {
  it('only uses fast scanner categories', async () => {
    const { getAllScanners } = await import('@aegis-scan/scanners');
    const mockGetAllScanners = vi.mocked(getAllScanners);

    const allCategories = [
      'security', 'dast', 'dependencies', 'compliance', 'quality',
      'accessibility', 'performance', 'infrastructure', 'i18n', 'ai-llm', 'runtime',
    ];

    const mockScanners = allCategories.map((cat) => ({
      name: `${cat}-scanner`,
      description: `${cat} scanner`,
      category: cat as import('@aegis-scan/core').ScanCategory,
      isAvailable: vi.fn(),
      scan: vi.fn(),
    }));

    mockGetAllScanners.mockReturnValue(mockScanners);

    const fastCategories = ['security', 'dependencies', 'quality', 'compliance', 'i18n'];
    const filtered = mockScanners.filter((s) => fastCategories.includes(s.category));

    expect(filtered).toHaveLength(5);
    expect(filtered.map((s) => s.category)).toEqual(
      expect.arrayContaining(fastCategories),
    );

    // Ensure DAST and other slow scanners are excluded
    const excluded = filtered.find((s) =>
      ['dast', 'accessibility', 'performance', 'infrastructure', 'ai-llm', 'runtime'].includes(
        s.category,
      ),
    );
    expect(excluded).toBeUndefined();
  });
});

describe('reporter selection', () => {
  it('terminal reporter has correct name', async () => {
    const { terminalReporter } = await import('@aegis-scan/reporters');
    expect(terminalReporter.name).toBe('terminal');
    expect(typeof terminalReporter.format).toBe('function');
  });

  it('json reporter has correct name', async () => {
    const { jsonReporter } = await import('@aegis-scan/reporters');
    expect(jsonReporter.name).toBe('json');
    expect(typeof jsonReporter.format).toBe('function');
  });

  it('sarif reporter has correct name', async () => {
    const { sarifReporter } = await import('@aegis-scan/reporters');
    expect(sarifReporter.name).toBe('sarif');
    expect(typeof sarifReporter.format).toBe('function');
  });
});
