// @vitest-environment node
import { expect, it } from 'vitest';
import { createServer as createHttpServer } from 'node:http';
import { startTestServer } from '../test-server.mjs';

it('closes the Vite server it owns without shell process termination', async () => {
  const server = await startTestServer(0);
  try { expect((await fetch(server.url)).status).toBe(200); }
  finally { await server.close(); }
  await expect(fetch(server.url)).rejects.toThrow();
}, 45000); // A cold Vite dependency scan on Windows can exceed 15 seconds.

it('reuses an existing TraceLens server without taking ownership of it', async () => {
  const original = await startTestServer(0);
  try {
    const reused = await startTestServer(Number(new URL(original.url).port));
    await reused.close();
    expect((await fetch(original.url)).status).toBe(200);
  } finally { await original.close(); }
}, 45000);

it('refuses an unrelated server without stopping it', async () => {
  const external = createHttpServer((_request, response) => response.end('Unrelated application'));
  await new Promise<void>(resolve => external.listen(0, '127.0.0.1', resolve));
  const address = external.address() as { port: number };
  try {
    await expect(startTestServer(address.port)).rejects.toThrow(/another application/i);
    expect(await (await fetch(`http://127.0.0.1:${address.port}`)).text()).toBe('Unrelated application');
  } finally { await new Promise<void>((resolve, reject) => external.close(error => error ? reject(error) : resolve())); }
}, 15000);
