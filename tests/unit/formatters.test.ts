import { describe, it, expect } from 'vitest';
import { formatDuration, formatTokens, truncateString } from '../../src/lib/formatters';

describe('formatters', () => {
  it('formats durations across scales', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(450)).toBe('450ms');
    expect(formatDuration(2500)).toBe('2.50s');
    expect(formatDuration(65000)).toBe('1m 5.0s');
    expect(formatDuration(undefined)).toBe('0ms');
  });

  it('formats token numbers cleanly', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(850)).toBe('850');
    expect(formatTokens(4200)).toBe('4.2k');
    expect(formatTokens(1250000)).toBe('1.25M');
    expect(formatTokens(undefined)).toBe('Unknown');
    expect(formatTokens(NaN)).toBe('Unknown');
  });

  it('truncates strings cleanly', () => {
    expect(truncateString('hello', 10)).toBe('hello');
    expect(truncateString('1234567890abcdef', 10)).toBe('1234567890...');
  });
});
