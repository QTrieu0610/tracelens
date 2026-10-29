import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const prompt = 'Reply exactly TELEMETRY_OK. Do not use tools, inspect files, or modify files.';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function resolveCli(provider) {
  const windowsFile = provider === 'agy' ? 'agy.exe' : `${provider}.cmd`;
  const fallback = provider === 'agy' ? process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'agy', 'bin', windowsFile) : process.env.APPDATA && join(process.env.APPDATA, 'npm', windowsFile);
  const lookup = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [process.platform === 'win32' ? windowsFile : provider], { encoding: 'utf8', windowsHide: true });
  const binary = lookup.stdout?.trim().split(/\r?\n/).find(path => path && existsSync(path))
    || (process.platform === 'win32' && fallback && existsSync(fallback) ? fallback : undefined);
  if (!binary) return undefined;
  let executable = binary, prefix = [];
  if (process.platform === 'win32' && /\.cmd$/i.test(binary)) {
    const script = join(dirname(binary), 'node_modules', provider === 'codex' ? '@openai/codex/bin/codex.js' : '@google/gemini-cli/dist/index.js');
    if (!existsSync(script)) return undefined;
    executable = process.execPath; prefix = [script];
  }
  const flags = provider === 'codex'
    ? ['exec', '--json', '--skip-git-repo-check', '--sandbox', 'read-only', prompt]
    : ['-p', prompt, '--output-format', 'stream-json'];
  return { executable, args: [...prefix, ...flags] };
}

export async function runCli({ provider, command, outputDir, parseTraceImport, timeoutMs = 120000 }) {
  mkdirSync(outputDir, { recursive: true });
  const base = { provider, acceptance: 'unverified' };
  if (!command) return { ...base, status: 'unavailable', message: 'CLI not found. Install it and authenticate in your terminal, then retry.' };
  const started = Date.now();
  const stdout = [], stderr = [];
  let bytes = 0, timedOut = false, tooLarge = false;
  const child = spawn(command.executable, command.args, { cwd: outputDir, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  const stop = () => {
    if (!child.pid) return;
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 1000 });
    else { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* The process may already have exited. */ } }
    child.kill('SIGKILL');
  };
  const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
  child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes <= 10 * 1024 * 1024) stdout.push(chunk); else { tooLarge = true; stop(); } });
  let stderrBytes = 0;
  child.stderr.on('data', chunk => { stderrBytes += chunk.length; if (stderrBytes <= 1024 * 1024) stderr.push(chunk); });
  const outcome = await new Promise(resolveResult => {
    child.once('error', error => resolveResult({ error: error.code }));
    child.once('close', exitCode => resolveResult({ exitCode }));
  });
  clearTimeout(timer);
  const raw = Buffer.concat(stdout).toString('utf8');
  writeFileSync(join(outputDir, 'stdout.jsonl'), raw, { flag: 'wx' });
  writeFileSync(join(outputDir, 'stderr.log'), Buffer.concat(stderr), { flag: 'wx' });
  const measured = { ...base, elapsedMs: Date.now() - started, exitCode: outcome.exitCode ?? null };
  if (timedOut) return { ...measured, status: 'timeout' };
  if (tooLarge) return { ...measured, status: 'output-limit' };
  if (outcome.error || outcome.exitCode !== 0) return { ...measured, status: 'cli-error', message: 'CLI could not complete. Inspect the local stderr.log; no passing model run is claimed.' };
  const imported = parseTraceImport(raw, `${provider}-smoke.jsonl`);
  if (!imported.valid || !imported.trace) return { ...measured, status: 'import-error', issues: imported.errors };
  const trace = imported.trace;
  writeFileSync(join(outputDir, 'trace.json'), JSON.stringify(trace, null, 2), { flag: 'wx' });
  const message = trace.metadata?.source === 'antigravity-stream-json' ? trace.metadata.import.finalResponse ?? '' : trace.steps.filter(step => typeof step.output === 'string' && (step.metadata?.codexItemType === 'agent_message' || step.name === 'Assistant message')).map(step => step.output).join('');
  const actions = trace.steps.some(step => step.type === 'tool_call' || (step.metadata?.codexItemType && !['agent_message', 'reasoning'].includes(step.metadata.codexItemType)));
  const passed = trace.status === 'success' && message.trim() === 'TELEMETRY_OK' && !actions;
  return { ...measured, status: passed ? 'passed' : 'response-mismatch', runId: trace.runId,
    ...(trace.totalTokens ? { totalTokens: trace.totalTokens.totalTokens } : {}),
    telemetryComplete: trace.metadata?.import?.telemetryComplete === true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { createServer } = await import('vite');
  const server = await createServer({ root: repo, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { parseTraceImport } = await server.ssrLoadModule('/src/lib/importTrace.ts');
    const output = join(repo, '.cli-smoke-runs', `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
    const results = [];
    console.log('Runs Codex and AGY once each with existing terminal authentication. Each has a 120s deadline. Raw logs stay local.');
    for (const provider of ['codex', 'agy']) {
      const result = await runCli({ provider, command: resolveCli(provider), outputDir: join(output, provider), parseTraceImport });
      results.push(result);
      console.log(`${provider}: ${result.status}; tokens=${result.totalTokens ?? 'Unknown'}; telemetry=${result.telemetryComplete ?? 'Unknown'}`);
    }
    writeFileSync(join(output, 'summary.json'), JSON.stringify({ kind: 'cli-import-smoke', notABenchmark: true, results }, null, 2), { flag: 'wx' });
    console.log(`Results: ${join(output, 'summary.json')}`);
    if (results.some(result => result.status !== 'passed')) process.exitCode = 1;
  } finally { await server.close(); }
}
