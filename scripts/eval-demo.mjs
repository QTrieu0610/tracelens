import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { readEvaluationPair } from './local-evaluations.mjs';

async function runProcess(executable, args, { quiet = false } = {}) {
  return new Promise(resolve => {
    const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', data => { stdout = (stdout + data).slice(-65536); if (!quiet) process.stdout.write(data); });
    child.stderr.on('data', data => { if (!quiet) process.stderr.write(data); });
    child.once('error', () => resolve({ code: 1, stdout }));
    child.once('close', code => resolve({ code: code ?? 1, stdout }));
  });
}

export async function runEvalDemo({ dataDir, run = runProcess,
  pythonCandidates = [{ executable: 'py', args: ['-3'] }, { executable: 'python3', args: [] }, { executable: 'python', args: [] }],
  log = console.log }) {
  const scripts = fileURLToPath(new URL('.', import.meta.url));
  const environment = join(dataDir, 'python-evals');
  const python = join(environment, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const versionCheck = ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)'];
  if (!existsSync(python)) {
    let candidate;
    for (const command of pythonCandidates) {
      if ((await run(command.executable, [...command.args, ...versionCheck], { quiet: true })).code === 0) { candidate = command; break; }
    }
    if (!candidate) throw new Error('Python 3.11+ is required to run evaluations. Install Python, reopen your terminal, then retry. Viewing logs and sample comparisons does not require Python.');
    log('Preparing an isolated Python environment (first run only)…');
    await mkdir(dataDir, { recursive: true });
    if ((await run(candidate.executable, [...candidate.args, '-m', 'venv', environment])).code !== 0) throw new Error('Could not create the evaluation environment. Install Python venv support and retry.');
  }
  if ((await run(python, versionCheck, { quiet: true })).code !== 0) throw new Error(`The evaluation environment needs Python 3.11+. Check ${environment} and recreate that optional environment before retrying.`);
  const requirements = join(scripts, 'requirements-evals.txt');
  const pinned = (await readFile(requirements, 'utf8')).match(/pydantic-evals\[logfire\]==([\d.]+)/)?.[1];
  if (!pinned) throw new Error('Evaluation requirements are missing a pinned Pydantic Evals version. Reinstall TraceLens.');
  const installed = await run(python, ['-c', `import importlib.metadata as m; import logfire; import pydantic_evals; assert m.version('pydantic-evals') == '${pinned}'`], { quiet: true });
  if (installed.code !== 0) {
    log('Installing evaluation dependencies (requires internet on first run)…');
    if ((await run(python, ['-m', 'pip', 'install', '-r', requirements])).code !== 0) throw new Error('Could not install evaluation dependencies. Check your internet connection and pip output above, then retry the same command.');
  }
  const id = `eval-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
  const directory = join(dataDir, 'evals', id);
  await mkdir(directory, { recursive: true });
  log('Running 20 synthetic cases; no LLM calls or account required…');
  if ((await run(python, [join(scripts, 'pydantic_evals_demo.py'), '--output', directory])).code !== 0) throw new Error(`Evaluation failed. Review the output above and retry. Partial files remain at ${directory}; they are not listed as a completed comparison.`);
  await readEvaluationPair(dataDir, id);
  const manifest = { id, createdAt: new Date().toISOString(), name: 'Form-fill evaluation demo', synthetic: true };
  await writeFile(join(directory, 'manifest.tmp'), JSON.stringify(manifest, null, 2));
  await rename(join(directory, 'manifest.tmp'), join(directory, 'manifest.json'));
  log('Evaluation ready. In Dashboard → Local evaluations, choose Open comparison.');
  return { id, directory };
}
