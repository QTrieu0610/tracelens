/** The Node viewer binds to loopback; hosted static sites have no local API. */
export function supportsLocalDiscovery(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}
