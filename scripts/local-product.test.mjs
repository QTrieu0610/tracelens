import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { request } from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { captureAgent, agentArguments } from './agent-capture.mjs';
import { startLocalServer } from './local-server.mjs';

const folder = () => mkdtempSync(join(tmpdir(), 'tracelens-product-'));
const command = code => ({ executable: process.execPath, args: ['-e', code] });

test('installed bin symlink invokes the CLI instead of silently exiting', t => {
  const cli = fileURLToPath(new URL('./tracelens.mjs', import.meta.url));
  const temporary = folder();
  let link = join(temporary, 'tracelens.mjs');
  try { symlinkSync(cli, link, 'file'); }
  catch (e) {
    if (!['EPERM', 'EACCES'].includes(e.code)) throw e;
    try { symlinkSync(dirname(cli), join(temporary, 'scripts'), 'junction'); link = join(temporary, 'scripts', 'tracelens.mjs'); }
    catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) return t.skip('OS does not allow links'); throw error; }
  }
  const result = spawnSync(process.execPath, [link, '--help'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /local agent log capture and viewer/);
});

test('captures original arguments/cwd and preserves separate logs, exit status and distinct runs', async () => {
  const dataDir = folder(), cwd = folder();
  const args = ['--sandbox', 'read-only', 'literal $() & " task'];
  const cmd = command('process.stdout.write(JSON.stringify({cwd:process.cwd(),args:process.argv.slice(1)}));process.stderr.write("diagnostic");process.exitCode=7;');
  cmd.args.push('--', ...args);
  const result = await captureAgent({ provider: 'codex', args, command: cmd, cwd, dataDir, stdout: null, stderr: null });
  assert.equal(result.status, 'failed');
  assert.equal(result.exitCode, 7);
  const raw = JSON.parse(readFileSync(join(result.directory, 'stdout.jsonl'), 'utf8'));
  assert.equal(raw.cwd, cwd);
  assert.deepEqual(raw.args, args);
  assert.equal(readFileSync(join(result.directory, 'stderr.log'), 'utf8'), 'diagnostic');
  const second = await captureAgent({ provider: 'codex', command: command('process.stdout.write("second")'), dataDir, cwd, stdout: null, stderr: null });
  assert.equal(second.status, 'completed');
  assert.notEqual(second.id, result.id);
  assert.equal(readFileSync(join(result.directory, 'stderr.log'), 'utf8'), 'diagnostic');
});

test('missing executable records failure rather than losing the run', async () => {
  const result = await captureAgent({ provider: 'codex', command: { executable: join(folder(), 'missing'), args: [] }, dataDir: folder(), stdout: null, stderr: null });
  assert.equal(result.status, 'failed');
  assert.match(result.error, /not found|ENOENT/i);
  assert.ok(existsSync(join(result.directory, 'manifest.json')));
});

test('capture flags keep output structured and preserve safe literal arguments', () => {
  assert.deepEqual(agentArguments('codex', ['--model', 'example', 'task']), ['exec', '--json', '--model', 'example', 'task']);
  assert.deepEqual(agentArguments('claude', ['task']), ['--print', '--output-format', 'stream-json', '--verbose', 'task']);
  assert.deepEqual(agentArguments('gemini', ['task']), ['--output-format', 'stream-json', '-p', 'task']);
  assert.deepEqual(agentArguments('gemini', ['--model', 'example', '-p', 'task']), ['--output-format', 'stream-json', '--model', 'example', '-p', 'task']);
  assert.throws(() => agentArguments('gemini', ['--model', 'example', 'task']), /-p/);
  assert.throws(() => agentArguments('unknown', ['task']), /Unsupported/);
  assert.throws(() => agentArguments('claude', ['--output-format=json', 'task']), /output-format/);
});

test('Windows standard npm installation works even when npm directory is absent from PATH', { skip: process.platform !== 'win32' }, () => {
  const appdata = folder(), dataDir = folder();
  const cliDir = join(appdata, 'npm', 'node_modules', '@openai', 'codex', 'bin');
  mkdirSync(cliDir, { recursive: true });
  writeFileSync(join(appdata, 'npm', 'codex.cmd'), '@echo off');
  writeFileSync(join(cliDir, 'codex.js'), 'console.log("synthetic standard npm shim output");');
  const cli = fileURLToPath(new URL('./tracelens.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, '--data-dir', dataDir, 'run', 'codex', '--', 'synthetic prompt'], {
    encoding: 'utf8', env: { ...process.env, APPDATA: appdata, PATH: join(process.env.SystemRoot, 'System32') }, timeout: 10000, windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /synthetic standard npm shim output/);
});

test('serves built app and captures, rejecting foreign origins, traversal and write requests', async () => {
  const dataDir = folder(), distDir = folder();
  writeFileSync(join(distDir, 'index.html'), '<title>TraceLens</title>');
  const run = await captureAgent({ provider: 'codex', command: command('process.stdout.write("{\\\"type\\\":\\\"example\\\"}")'), dataDir, stdout: null, stderr: null });
  const local = await startLocalServer({ dataDir, distDir, port: 0 });
  try {
    const response = await fetch(local.url);
    assert.match(await response.text(), /TraceLens/);
    const list = await (await fetch(new URL('/api/runs', local.url))).json();
    assert.equal(list.runs.length, 1);
    assert.equal(list.runs[0].id, run.id);
    assert.equal(list.runs[0].status, 'completed');
    assert.equal('args' in list.runs[0], false);
    const raw = await fetch(new URL(`/api/runs/${run.id}/stdout`, local.url));
    assert.equal(await raw.text(), '{"type":"example"}');
    assert.equal((await fetch(new URL('/api/runs', local.url), { headers: { Origin: 'https://foreign.example' } })).status, 403);
    const hostStatus = await new Promise((resolve, reject) => {
      const req = request(new URL('/api/runs', local.url), { headers: { Host: 'foreign.example' } }, response => { response.resume(); resolve(response.statusCode); });
      req.on('error', reject); req.end();
    });
    assert.equal(hostStatus, 403);
    assert.equal((await fetch(new URL('/api/runs', local.url), { method: 'POST' })).status, 405);
    assert.equal((await fetch(local.url + 'api/runs/%2e%2e%2fsecret/stdout')).status, 400);
    assert.equal((await fetch(local.url + '%2e%2e%2fpackage.json')).status, 403);
    assert.equal((await fetch(new URL('/api/not-found', local.url))).status, 404);
    writeFileSync(join(run.directory, 'stdout.jsonl'), Buffer.alloc(10 * 1024 * 1024 + 1));
    assert.equal((await fetch(new URL(`/api/runs/${run.id}/stdout`, local.url))).status, 413);
  } finally { await local.close(); }
});

test('missing build has actionable error; incomplete and corrupt captures do not break listing', async () => {
  await assert.rejects(startLocalServer({ dataDir: folder(), distDir: folder(), port: 0 }), /build/i);
  const dataDir = folder(), distDir = folder();
  writeFileSync(join(distDir, 'index.html'), '<title>TraceLens</title>');
  for (const id of ['incomplete', 'corrupt']) mkdirSync(join(dataDir, 'runs', id), { recursive: true });
  writeFileSync(join(dataDir, 'runs', 'incomplete', 'manifest.json'), JSON.stringify({ id: 'incomplete', provider: 'codex', status: 'running', startedAt: '2026-10-29T00:00:00Z' }));
  writeFileSync(join(dataDir, 'runs', 'corrupt', 'manifest.json'), '{invalid');
  const local = await startLocalServer({ dataDir, distDir, port: 0 });
  try {
    const list = await (await fetch(new URL('/api/runs', local.url))).json();
    assert.equal(list.runs[0].status, 'running');
    assert.equal(list.unreadable, 1);
  } finally { await local.close(); }
});
