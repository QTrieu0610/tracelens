import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

export async function startTestServer(port = 5188) {
  const url = `http://127.0.0.1:${port}/`;
  if (port !== 0) {
    let response;
    try { response = await fetch(url, { signal: AbortSignal.timeout(1500) }); }
    catch (error) {
      if (error.cause?.code !== 'ECONNREFUSED') throw new Error(`Cannot check test server at ${url}: ${error.message}`);
    }
    if (response) {
      if (!response.ok || !(await response.text()).includes('<title>TraceLens')) throw new Error(`Test port ${port} is occupied by another application.`);
      return { url, close: async () => {} };
    }
  }
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port, strictPort: true } });
  try { await server.listen(); }
  catch (error) { await server.close(); throw error; }
  return { url: server.resolvedUrls.local[0], close: async () => {
    try { await server.environments.client.depsOptimizer?.scanProcessing; }
    finally { await server.close(); }
  } };
}
