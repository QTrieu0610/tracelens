import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readFile, readdir, realpath } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { listEvaluations, readEvaluationTrace } from './local-evaluations.mjs';

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.jsonl': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };
const validId = id => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(id);
const inside = (root, path) => path === root || path.startsWith(root + sep);
const limit = 10 * 1024 * 1024;

export async function startLocalServer({ dataDir, distDir, port = 5188 }) {
  try { await stat(join(distDir, 'index.html')); }
  catch { throw new Error('TraceLens build is missing. Run npm run build in the source checkout, or reinstall the packaged app.'); }
  const staticRoot = await realpath(distDir);
  const captures = resolve(dataDir, 'runs');
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const send = (status, body, type = 'application/json; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type });
      res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
    };
    const port = server.address().port;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!hosts.includes(req.headers.host) || (req.headers.origin && !hosts.some(host => req.headers.origin === `http://${host}`))) return send(403, { error: 'Local access only' });
    if (!['GET', 'HEAD'].includes(req.method)) return send(405, { error: 'Read-only server' });
    let path;
    try { path = decodeURIComponent((req.url || '/').split('?')[0]); }
    catch { return send(400, { error: 'Invalid path' }); }
    if (path.startsWith('/api/') && req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Local access only' });
    try {
      if (path === '/api/evals') return send(200, { service: 'tracelens-local-v1', ...await listEvaluations(dataDir) });
      if (path.startsWith('/api/evals/')) {
        const [, , , id, kind, ...extra] = path.split('/');
        if (extra.length) return send(400, { error: 'Invalid evaluation path' });
        return send(200, await readEvaluationTrace(dataDir, id, kind));
      }
      if (path === '/api/runs') {
        let entries = [];
        try { entries = await readdir(captures, { withFileTypes: true }); }
        catch (e) { if (e.code !== 'ENOENT') throw e; }
        const runs = [];
        let unreadable = 0;
        for (const entry of entries.filter(e => e.isDirectory() && validId(e.name))) {
          try {
            const file = join(captures, entry.name, 'manifest.json');
            const actual = await realpath(file);
            if (!inside(await realpath(captures), actual) || (await stat(actual)).size > 65536) throw new Error('Invalid manifest');
            const item = JSON.parse(await readFile(actual, 'utf8'));
            if (item.id !== entry.name || !['codex', 'claude', 'gemini', 'agy'].includes(item.provider) || !['running', 'completed', 'failed'].includes(item.status) || typeof item.startedAt !== 'string') throw new Error('Invalid manifest');
            let bytes = 0;
            try { bytes = (await stat(join(captures, entry.name, 'stdout.jsonl'))).size; } catch { /* Interrupted before output creation. */ }
            runs.push({ id: entry.name, provider: item.provider, status: item.status, startedAt: item.startedAt, completedAt: item.completedAt,
              exitCode: item.exitCode, elapsedMs: item.elapsedMs, bytes, error: item.error });
          } catch { unreadable++; }
        }
        runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
        return send(200, { service: 'tracelens-local-v1', runs, unreadable });
      }
      if (path.startsWith('/api/runs/')) {
        const [, , , id, kind, ...extra] = path.split('/');
        if (!validId(id) || extra.length || !['stdout', 'stderr'].includes(kind)) return send(400, { error: 'Invalid capture path' });
        const actual = await realpath(join(captures, id, kind === 'stdout' ? 'stdout.jsonl' : 'stderr.log'));
        if (!inside(await realpath(captures), actual)) return send(403, { error: 'Invalid capture path' });
        const info = await stat(actual);
        if (info.size > limit) return send(413, { error: 'This log exceeds the 10 MB viewer limit. The full file remains in your capture directory.' });
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': info.size });
        if (req.method === 'HEAD') return res.end();
        return createReadStream(actual).on('error', () => res.destroy()).pipe(res);
      }
      if (path.startsWith('/api/')) return send(404, { error: 'Unknown endpoint' });
      const target = resolve(staticRoot, '.' + (path === '/' ? '/index.html' : path));
      if (!inside(staticRoot, target) || path.includes('\\')) return send(403, { error: 'Invalid asset path' });
      const actual = await realpath(target);
      if (!inside(staticRoot, actual)) return send(403, { error: 'Invalid asset path' });
      const info = await stat(actual);
      if (!info.isFile()) return send(404, { error: 'Not found' });
      res.writeHead(200, { 'Content-Type': types[extname(actual)] || 'application/octet-stream', 'Content-Length': info.size });
      if (req.method === 'HEAD') return res.end();
      createReadStream(actual).on('error', () => res.destroy()).pipe(res);
    } catch (e) {
      send(e.statusCode || (['ENOENT', 'ENOTDIR'].includes(e.code) ? 404 : 500), { error: e.statusCode ? e.message : ['ENOENT', 'ENOTDIR'].includes(e.code) ? 'Not found' : 'Unable to read local files. Check directory permissions.' });
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())) };
}
