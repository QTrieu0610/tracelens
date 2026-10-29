import { expect, it } from 'vitest';
import { buildCaptureCommand } from '../../src/lib/captureCommands';

it('provides native structured output for each CLI without permission bypasses', () => {
  expect(buildCaptureCommand('codex', 'powershell')).toContain('--json');
  expect(buildCaptureCommand('gemini', 'powershell')).toContain('--output-format stream-json');
  expect(buildCaptureCommand('claude', 'bash')).toContain('--output-format stream-json --verbose');
  for (const cli of ['codex', 'gemini', 'claude'] as const) {
    expect(buildCaptureCommand(cli, 'powershell')).toContain('-NoClobber');
    expect(buildCaptureCommand(cli, 'bash')).toContain('set -C');
    expect(buildCaptureCommand(cli, 'bash')).not.toMatch(/dangerously|yolo|2>&1/);
  }
});
