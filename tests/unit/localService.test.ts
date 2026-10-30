import { expect, it } from 'vitest';
import { supportsLocalDiscovery } from '../../src/lib/localService';

it.each([
  ['localhost', true], ['127.0.0.1', true], ['qtrieu0610.github.io', false],
  ['hosted.tracelens.test', false], ['localhost.example.com', false],
])('only probes local APIs on the local viewer host %s', (hostname, expected) => {
  expect(supportsLocalDiscovery(hostname as string)).toBe(expected);
});
