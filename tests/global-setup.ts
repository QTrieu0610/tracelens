import { startTestServer } from './test-server.mjs';

export default async function globalSetup() {
  const server = await startTestServer();
  return () => server.close();
}
