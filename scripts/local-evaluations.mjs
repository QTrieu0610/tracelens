import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { validateTraceLensJson } from './trace-validator.mjs';

export const validEvaluationId = id => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(id);
const limit = 10 * 1024 * 1024;
const error = (message, statusCode) => Object.assign(new Error(message), { statusCode });

async function readLocalJson(dataDir, id, filename, maxBytes = limit) {
  if (!validEvaluationId(id)) throw error('Invalid evaluation ID', 400);
  const root = await realpath(resolve(dataDir, 'evals'));
  const path = await realpath(join(root, id, filename));
  if (!path.startsWith(root + sep)) throw error('Invalid evaluation path', 403);
  if ((await stat(path)).size > maxBytes) throw error('Evaluation file exceeds the 10 MB viewer limit.', 413);
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function readEvaluationTrace(dataDir, id, kind) {
  if (!['baseline', 'regressed'].includes(kind)) throw error('Invalid evaluation file', 400);
  return readLocalJson(dataDir, id, kind + '.json');
}

export async function readEvaluationPair(dataDir, id) {
  const traces = await Promise.all(['baseline', 'regressed'].map(kind => readEvaluationTrace(dataDir, id, kind)));
  const identities = traces.map(trace => trace?.metadata?.evaluation);
  if (!traces.every(t => validateTraceLensJson(t).valid) || traces[0].runId === traces[1].runId
    || !identities.every(e => typeof e?.datasetId === 'string' && e.datasetId.trim() && typeof e.datasetRevision === 'string' && e.datasetRevision.trim())
    || identities[0].datasetId !== identities[1].datasetId || identities[0].datasetRevision !== identities[1].datasetRevision) {
    throw error('Evaluation traces are incomplete or have incompatible dataset revisions.', 422);
  }
  return traces;
}

export async function listEvaluations(dataDir) {
  let entries;
  try { entries = await readdir(resolve(dataDir, 'evals'), { withFileTypes: true }); }
  catch (e) { if (e.code === 'ENOENT') return { evaluations: [], unreadable: 0 }; throw e; }
  const evaluations = [];
  let unreadable = 0;
  for (const entry of entries.filter(e => e.isDirectory() && validEvaluationId(e.name))) {
    try {
      const manifest = await readLocalJson(dataDir, entry.name, 'manifest.json', 65536);
      if (manifest.id !== entry.name || typeof manifest.name !== 'string' || !Number.isFinite(Date.parse(manifest.createdAt))) throw error('Invalid evaluation manifest', 422);
      await readEvaluationPair(dataDir, entry.name);
      evaluations.push({ id: manifest.id, name: manifest.name, createdAt: manifest.createdAt, synthetic: manifest.synthetic === true });
    } catch { unreadable++; }
  }
  evaluations.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { evaluations, unreadable };
}
