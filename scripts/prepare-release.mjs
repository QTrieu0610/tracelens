import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const roots = ['src', 'public', '.github', 'scripts', 'tests', 'fixtures/demo-coding-agent.json', 'fixtures/demo-trip-planner-failure.json',
  'fixtures/demo-support-subagents.json', 'fixtures/demo-honesty-false-completion.json', 'fixtures/invalid-missing-steps.json', 'README.md', 'LICENSE', 'CONTRIBUTING.md', 'SECURITY.md',
  '.gitignore', 'package.json', 'package-lock.json', 'index.html', 'vite.config.ts', 'vitest.config.ts', 'tsconfig.json', 'playwright.config.ts',
  'postcss.config.js', 'tailwind.config.js', 'docs/codex-jsonl.md', 'docs/publishing.md', 'docs/case-study.md', 'docs/product-stability.md', 'docs/product-readiness.md', 'docs/cli-smoke-results.md', 'docs/local-use.md', 'docs/pydantic-evals.md', 'docs/pydantic-evals-results.json'];
const excluded = new Set(['tests/unit/benchmark-artifacts.test.ts', 'tests/e2e/benchmark-comparison.spec.ts']);

export function prepareRelease(output) {
  if (existsSync(output)) throw new Error('Output directory already exists; choose a new directory');
  mkdirSync(output, { recursive: true });
  const files = [];
  const copy = relative => {
    if (relative.split('/').includes('__pycache__') || relative.endsWith('.pyc')) return;
    if (excluded.has(relative)) return;
    const source = join(repo, relative), stat = lstatSync(source);
    if (stat.isSymbolicLink()) throw new Error(`Refusing symbolic link: ${relative}`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(source)) copy(`${relative}/${name}`);
      return;
    }
    mkdirSync(dirname(join(output, relative)), { recursive: true });
    copyFileSync(source, join(output, relative));
    if (relative === 'package.json') {
      const pkg = JSON.parse(readFileSync(source, 'utf8'));
      for (const name of ['benchmark', 'benchmark:cli', 'test:benchmark']) delete pkg.scripts[name];
      writeFileSync(join(output, relative), JSON.stringify(pkg, null, 2) + '\n');
    }
    files.push({ path: relative, sha256: createHash('sha256').update(readFileSync(join(output, relative))).digest('hex') });
  };
  for (const path of roots) copy(path);
  for (const path of ['docs/screenshots/product-demo.png']) if (existsSync(join(repo, path))) copy(path);
  const manifest = { generatedAt: new Date().toISOString(), policy: 'Product source allowlist; excludes real benchmark logs, workspaces, local credentials and build artifacts', files };
  writeFileSync(join(output, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = join(repo, '.release', `tracelens-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  try { const manifest = prepareRelease(output); console.log(`Prepared ${manifest.files.length} files: ${output}`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
