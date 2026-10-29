import { parseTraceImport } from './importTrace';
import { TraceLensV1Trace } from '../types/trace';

export interface LocalCapture {
  id: string;
  provider: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  exitCode?: number | null;
  elapsedMs?: number;
  bytes: number;
  error?: string;
}

export function parseLocalCapture(raw: string, capture: LocalCapture): TraceLensV1Trace {
  const parsed = parseTraceImport(raw, `${capture.provider} capture`);
  if (!parsed.valid || !parsed.trace) throw new Error(parsed.errors.map(e => e.message).join(' '));
  const trace = parsed.trace;
  trace.runId = capture.id;
  trace.name = `${capture.provider} · ${new Date(capture.startedAt).toLocaleString()}`;
  trace.metadata = { ...trace.metadata, localCapture: { ...capture, observedTokens: trace.totalTokens } };
  if (capture.status !== 'completed') {
    trace.status = capture.status === 'failed' ? 'failed' : 'running';
    delete trace.totalTokens;
    const sourceImport = trace.metadata.import;
    trace.metadata.import = { ...(sourceImport && typeof sourceImport === 'object' ? sourceImport : {}), telemetryComplete: false };
    trace.steps.push({ stepId: `${capture.id}-process`, stepIndex: trace.steps.length, type: 'system_event',
      name: capture.status === 'failed' ? 'Capture process failed' : 'Capture process unfinished',
      status: capture.status === 'failed' ? 'failed' : 'running', startedAt: capture.completedAt || capture.startedAt,
      durationMs: 0, output: { exitCode: capture.exitCode, error: capture.error },
      ...(capture.status === 'failed' ? { error: { code: 'CAPTURE_PROCESS_FAILED', message: capture.error || `Agent process exited ${capture.exitCode ?? 'without an exit code'}.` } } : {}) });
  }
  return trace;
}
