import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { finished } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';

export const providers = ['codex', 'claude', 'gemini', 'agy'];

export function agentArguments(provider, args) {
  if (!providers.includes(provider)) throw new Error(`Unsupported agent: ${provider}. Choose ${providers.join(', ')}.`);
  if (args.some(arg => /^--output-format(?:=|$)/.test(arg))) throw new Error('TraceLens sets --output-format to stream-json; remove your output-format flag.');
  if (provider === 'codex') return ['exec', '--json', ...args];
  if (provider === 'claude') return ['--print', '--output-format', 'stream-json', '--verbose', ...args];
  if (args.length === 1 && !args[0].startsWith('-')) return ['--output-format', 'stream-json', '-p', ...args];
  if (args.includes('-p') || args.some(arg => /^--prompt(?:=|$)/.test(arg))) return ['--output-format', 'stream-json', ...args];
  throw new Error(`Use ${provider} -- -p "your task" when also supplying agent options.`);
}

export function resolveAgent(provider, args) {
  const flags = agentArguments(provider, args);
  if (process.platform !== 'win32') return { executable: provider, args: flags };
  const found = spawnSync('where.exe', [provider], { encoding: 'utf8', windowsHide: true });
  const candidates = found.stdout?.split(/\r?\n/).filter(path => path && existsSync(path)) || [];
  const standard = provider === 'agy'
    ? process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'agy', 'bin', 'agy.exe')
    : process.env.APPDATA && join(process.env.APPDATA, 'npm', `${provider}.cmd`);
  if (standard && existsSync(standard)) candidates.push(standard);
  const native = candidates.find(path => /\.exe$/i.test(path));
  if (native) return { executable: native, args: flags };
  // npm shims need their JS entrypoint on Windows; never interpolate agent arguments into a shell.
  const shim = candidates.find(path => /\.cmd$/i.test(path));
  const entries = { codex: '@openai/codex/bin/codex.js', claude: '@anthropic-ai/claude-code/cli.js', gemini: '@google/gemini-cli/dist/index.js' };
  const entry = shim && entries[provider] && join(dirname(shim), 'node_modules', entries[provider]);
  if (entry && existsSync(entry)) return { executable: process.execPath, args: [entry, ...flags] };
  throw new Error(`${provider} CLI not found. Install and authenticate it in this terminal, then retry. Native executables and standard npm installations are supported.`);
}

export async function captureAgent({ provider, args = [], cwd = process.cwd(), dataDir, command, stdout = process.stdout, stderr = process.stderr }) {
  agentArguments(provider, args);
  const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID();
  const directory = join(dataDir, 'runs', id);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const manifest = { id, provider, status: 'running', startedAt: new Date().toISOString(), cwd, args, exitCode: null };
  const save = () => {
    writeFileSync(join(directory, 'manifest.tmp'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
    renameSync(join(directory, 'manifest.tmp'), join(directory, 'manifest.json'));
  };
  save();
  const raw = createWriteStream(join(directory, 'stdout.jsonl'), { flags: 'wx', mode: 0o600 });
  const diagnostic = createWriteStream(join(directory, 'stderr.log'), { flags: 'wx', mode: 0o600 });
  const started = performance.now();
  let child, writeError, interrupted = false;
  const stop = () => {
    interrupted = true;
    if (!child?.pid) return;
    if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 5000 });
    else { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); } }
  };
  // Keep disk errors explicit: a successful agent with an incomplete log is a failed capture.
  raw.on('error', e => { writeError = e; stop(); });
  diagnostic.on('error', e => { writeError = e; stop(); });
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    command ||= resolveAgent(provider, args);
    child = spawn(command.executable, command.args, { cwd, windowsHide: true, detached: process.platform !== 'win32', stdio: ['inherit', 'pipe', 'pipe'] });
    child.stdout.pipe(raw);
    child.stderr.pipe(diagnostic);
    if (stdout) child.stdout.pipe(stdout, { end: false });
    if (stderr) child.stderr.pipe(stderr, { end: false });
    const outcome = await new Promise(resolve => {
      let error;
      child.once('error', e => { error = e; });
      child.once('close', (exitCode, signal) => resolve({ exitCode, signal, error }));
    });
    await Promise.all([finished(raw), finished(diagnostic)]);
    Object.assign(manifest, { exitCode: outcome.exitCode, signal: outcome.signal,
      status: outcome.exitCode === 0 && !outcome.error && !writeError && !interrupted ? 'completed' : 'failed',
      error: outcome.error?.message || writeError?.message || (interrupted ? 'Capture interrupted' : null) });
  } catch (error) {
    raw.end(); diagnostic.end();
    await Promise.allSettled([finished(raw), finished(diagnostic)]);
    Object.assign(manifest, { status: 'failed', error: error.message });
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    Object.assign(manifest, { completedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - started) });
    save();
  }
  return { ...manifest, directory };
}
