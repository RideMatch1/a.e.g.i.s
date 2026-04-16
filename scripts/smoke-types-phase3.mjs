import ts from 'typescript';
import { resolve } from 'node:path';
import fs from 'node:fs';

const root = resolve(process.cwd(), 'packages/benchmark/vulnerable-app');
const testFile = resolve(root, 'src/__smoke__.ts');
fs.mkdirSync(resolve(root, 'src'), { recursive: true });
fs.writeFileSync(testFile, `
import { exec, execSync } from 'child_process';
function myLocalExec(cmd: string): string { return cmd; }

exec('ls');        // real — should resolve to @types/node
execSync('ls');    // real
myLocalExec('ls'); // local — NOT a sink
`);

const configPath = resolve(root, 'tsconfig.json');
const parsed = ts.parseConfigFileTextToJson(configPath, fs.readFileSync(configPath, 'utf-8'));
const config = ts.parseJsonConfigFileContent(parsed.config, ts.sys, root);
const program = ts.createProgram([testFile], config.options);
const checker = program.getTypeChecker();
const target = program.getSourceFile(testFile);

function resolveRealDeclaration(symbol) {
  // If the symbol is an alias (import binding), follow through to the source
  if (symbol.flags & ts.SymbolFlags.Alias) {
    return checker.getAliasedSymbol(symbol);
  }
  return symbol;
}

function visit(node) {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
    const name = node.expression.text;
    const sym = checker.getSymbolAtLocation(node.expression);
    if (!sym) { console.log(`  ${name}(): NO SYMBOL`); return; }

    const real = resolveRealDeclaration(sym);
    const decls = real.getDeclarations() ?? [];
    for (const decl of decls) {
      const declPath = decl.getSourceFile().fileName.replace(/\\/g, '/');
      const origin = declPath.includes('/@types/node/') ? 'NODE_TYPES' :
                     /\/typescript\/lib\/lib\.[^/]+\.d\.ts$/.test(declPath) ? 'TS_LIB' :
                     declPath === testFile.replace(/\\/g, '/') ? 'LOCAL' : 'OTHER';
      console.log(`  ${name}(): ${origin} — ${declPath.split('/').slice(-3).join('/')}`);
    }
  }
  ts.forEachChild(node, visit);
}

// Always clean up, even if visit() throws (validator obs #2)
try {
  visit(target);
} finally {
  try { fs.unlinkSync(testFile); } catch {}
}
