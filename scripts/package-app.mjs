import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (!process.env.npm_execpath) throw new Error('Use npm run pack:app.');
const repo = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(new URL('../.release/', import.meta.url), { recursive: true });
const result = spawnSync(process.execPath, [process.env.npm_execpath, 'pack', '--pack-destination', '.release'], { cwd: repo, stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
