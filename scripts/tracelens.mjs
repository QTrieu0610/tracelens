#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { captureAgent } from './agent-capture.mjs';
import { startLocalServer } from './local-server.mjs';

const help = `TraceLens — local agent log capture and viewer (Node.js 22+)

  tracelens                                  Open the local viewer
  tracelens run codex -- "Review this project"
  tracelens run codex -- --sandbox read-only "Explain this code"
  tracelens run claude -- "Review this project"
  tracelens run gemini -- "Review this project"
  tracelens run agy -- "Review this project"

Options before 'run': --data-dir PATH, --port NUMBER, --no-open
Default data: ~/.tracelens (private raw stdout, stderr and capture manifests)
Agents use their existing authentication, settings and account allowance.
The wrapper preserves agent permissions; CLI completion does not verify task correctness.
`;

export async function main(argv = process.argv.slice(2)) {
  let dataDir = join(homedir(), '.tracelens'), port = 5188, open = true;
  const args = [...argv];
  while (args[0]?.startsWith('--')) {
    const option = args.shift();
    if (option === '--help') { console.log(help); return; }
    if (option === '--no-open') { open = false; continue; }
    if (!['--data-dir', '--port'].includes(option) || !args.length) throw new Error('Unknown or incomplete option. Run tracelens --help.');
    const value = args.shift();
    if (option === '--data-dir') dataDir = resolve(value);
    else {
      if (!/^\d+$/.test(value) || +value < 1 || +value > 65535) throw new Error('Port must be between 1 and 65535.');
      port = +value;
    }
  }
  if (args.length) {
    if (args.shift() !== 'run') throw new Error('Unknown command. Run tracelens --help.');
    const provider = args.shift();
    if (args.shift() !== '--' || !args.length) throw new Error('Usage: tracelens run codex|claude|gemini|agy -- AGENT_ARGUMENTS');
    const run = await captureAgent({ provider, args, dataDir });
    console.error(`\nTraceLens capture: ${run.status}${run.exitCode === null ? '' : ` (exit ${run.exitCode})`}\nSaved: ${run.directory}\nOpen the viewer with: tracelens${dataDir === join(homedir(), '.tracelens') ? '' : ` --data-dir "${dataDir}"`}`);
    if (run.error) console.error(run.error);
    process.exitCode = run.status === 'completed' ? 0 : run.exitCode > 0 && run.exitCode <= 255 ? run.exitCode : 1;
    return;
  }
  const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
  const local = await startLocalServer({ dataDir, distDir, port });
  console.log(`TraceLens: ${local.url}\nCaptures: ${dataDir}\nRun an agent in another terminal with tracelens run codex -- "your task".\nPress Ctrl+C to stop.`);
  let stopping = false;
  const stop = async () => { if (!stopping) { stopping = true; await local.close(); } };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  if (open) {
    const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const browser = spawn(command, process.platform === 'win32' ? ['url.dll,FileProtocolHandler', local.url] : [local.url], { windowsHide: true, stdio: 'ignore' });
    browser.on('error', () => console.log(`Open ${local.url} in your browser.`));
    browser.unref();
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) main().catch(e => {
  console.error(e.code === 'EADDRINUSE' ? 'TraceLens port is busy. Open the existing viewer or choose --port 5189.' : e.message);
  process.exitCode = 1;
});
