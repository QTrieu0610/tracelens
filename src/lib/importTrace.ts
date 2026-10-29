import { TraceLensStep, TokenUsage, ValidationResult } from '../types/trace';
import { validateTraceLensJson } from './validator';
import { parseClaudeEvents } from './importClaude';
import { parseGeminiEvents } from './importGemini';
import { parseAgyEvents } from './importAgy';

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const epoch = '1970-01-01T00:00:00.000Z';

/** Imports public `codex exec --json` events, never private rollout logs. */
export function parseTraceImport(content: string, filename = 'Codex run'): ValidationResult {
  const fail = (message: string, line?: number): ValidationResult => ({ valid: false, errors: [{ path: line ? `line ${line}` : '', message, code: 'INVALID_IMPORT' }] });
  if (content.length > 10 * 1024 * 1024 || new TextEncoder().encode(content).byteLength > 10 * 1024 * 1024) return fail('Content exceeds the 10 MB import limit.');
  content = content.replace(/^\uFEFF/, '');
  try {
    const raw: unknown = JSON.parse(content);
    if (object(raw) && !('schemaVersion' in raw) && 'response' in raw && 'stats' in raw) return fail('Gemini single JSON output is not supported. Capture with --output-format stream-json and import the resulting JSONL file.');
    if (object(raw) && raw.type === 'result' && typeof raw.session_id === 'string' && typeof raw.subtype === 'string') return parseClaudeEvents([raw], filename, content);
    if (object(raw) && ('schemaVersion' in raw || (!('type' in raw) && !('event' in raw)))) return validateTraceLensJson(raw);
    if (!object(raw)) return fail('Unsupported format. Import TraceLens JSON or Codex exec JSONL.');
  } catch { /* A sequence of JSON objects is parsed line by line below. */ }
  const nonemptyLines = content.split(/\r?\n/);
  let first: unknown;
  try { first = JSON.parse(nonemptyLines.find(line => line.trim()) ?? 'null'); } catch { /* Codex parser reports the line below. */ }
  if (object(first) && (first.event === 'init' || first.type === 'init' || (first.type === 'system' && first.subtype === 'init'))) {
    const events: Record<string, unknown>[] = [];
    for (let i = 0; i < nonemptyLines.length; i++) {
      if (!nonemptyLines[i].trim()) continue;
      let event: unknown;
      try { event = JSON.parse(nonemptyLines[i]); } catch { return fail('Malformed JSON. Each JSONL line must contain one complete event.', i + 1); }
      if (!object(event)) return fail('Event must be an object.', i + 1);
      events.push(event);
    }
    return first.event === 'init' ? parseAgyEvents(events, filename, content) : first.type === 'init' ? parseGeminiEvents(events, filename, content) : parseClaudeEvents(events, filename, content);
  }
  const steps: TraceLensStep[] = [];
  const items = new Map<string, TraceLensStep>();
  const warnings: string[] = [];
  let thread: string | undefined;
  let activeTurn = false;
  let turns = 0;
  let closedTurns = 0;
  let usageTurns = 0;
  let failed = false;
  let recognized = false;
  let model = 'unknown';
  let firstTime: string | undefined;
  let lastTime: string | undefined;
  let allTimed = true;
  let cachedInputTokens = 0;
  let reasoningOutputTokens = 0;
  let cacheUsageTurns = 0;
  let reasoningUsageTurns = 0;
  const observed: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].trim()) continue;
    const line = index + 1;
    let event: unknown;
    try { event = JSON.parse(lines[index]); } catch { return fail('Malformed JSON. Each JSONL line must contain one complete event.', line); }
    if (!object(event) || typeof event.type !== 'string' || !event.type.trim()) return fail('Event must be an object with a string type.', line);
    if (['session_meta', 'response_item', 'event_msg', 'turn_context'].includes(event.type)) return fail('Unsupported rollout format. Export with codex exec --json; import one run per file.', line);
    const time = typeof event.timestamp === 'string' && Number.isFinite(Date.parse(event.timestamp)) ? new Date(event.timestamp).toISOString() : undefined;
    if (!time) allTimed = false;
    if (time) {
      if (lastTime && time < lastTime) return fail('Event timestamps must be chronological.', line);
      firstTime ??= time;
      lastTime = time;
    }
    if (typeof event.model === 'string' && event.model.trim()) model = event.model;
    switch (event.type) {
      case 'thread.started':
        recognized = true;
        if (typeof event.thread_id !== 'string' || !event.thread_id.trim()) return fail('thread.started requires a thread_id.', line);
        if (thread) return fail('Multiple threads are unsupported. Import one run per file.', line);
        thread = event.thread_id;
        break;
      case 'turn.started':
        recognized = true;
        if (activeTurn) return fail('A turn started before the previous turn ended.', line);
        activeTurn = true;
        turns++;
        break;
      case 'turn.completed':
      case 'turn.failed': {
        recognized = true;
        if (!activeTurn) return fail('Turn ended without turn.started.', line);
        activeTurn = false;
        closedTurns++;
        if (event.type === 'turn.failed') failed = true;
        if ('usage' in event) {
          const usage = event.usage;
          if (!object(usage) || !integer(usage.input_tokens) || !integer(usage.output_tokens)) return fail('Usage requires non-negative safe integer input_tokens and output_tokens.', line);
          for (const key of ['cached_input_tokens', 'reasoning_output_tokens']) {
            if (key in usage && !integer(usage[key])) return fail(`Invalid usage ${key}: expected a non-negative safe integer.`, line);
          }
          if ((usage.cached_input_tokens as number || 0) > usage.input_tokens || (usage.reasoning_output_tokens as number || 0) > usage.output_tokens) return fail('Cached and reasoning tokens must be subsets of input and output tokens.', line);
          observed.promptTokens += usage.input_tokens;
          observed.completionTokens += usage.output_tokens;
          observed.totalTokens = observed.promptTokens + observed.completionTokens;
          cachedInputTokens += usage.cached_input_tokens as number || 0;
          reasoningOutputTokens += usage.reasoning_output_tokens as number || 0;
          if ('cached_input_tokens' in usage) cacheUsageTurns++;
          if ('reasoning_output_tokens' in usage) reasoningUsageTurns++;
          if (![observed.promptTokens, observed.completionTokens, observed.totalTokens, cachedInputTokens, reasoningOutputTokens].every(integer)) return fail('Accumulated usage exceeds the safe integer limit.', line);
          usageTurns++;
        }
        if (event.type === 'turn.completed') break;
        // A failed turn carries its reported error as an inert system event.
        const message = object(event.error) && typeof event.error.message === 'string' ? event.error.message : 'Codex turn failed';
        steps.push({ stepId: `event-${line}`, stepIndex: steps.length, type: 'system_event', name: 'Turn failed', status: 'failed', startedAt: time ?? epoch, durationMs: 0, error: { message }, output: event.error });
        break;
      }
      case 'item.started':
      case 'item.updated':
      case 'item.completed': {
        recognized = true;
        if (!activeTurn) return fail('Item event requires an active turn.started.', line);
        const item = event.item;
        if (!object(item) || typeof item.id !== 'string' || !item.id.trim() || typeof item.type !== 'string' || !item.type.trim()) return fail('Item requires string id and type.', line);
        if ('exit_code' in item && item.exit_code !== null && (typeof item.exit_code !== 'number' || !Number.isSafeInteger(item.exit_code))) return fail('exit_code must be an integer or null.', line);
        for (const field of ['command', 'text', 'aggregated_output', 'status']) if (field in item && typeof item[field] !== 'string') return fail(`Item ${field} must be a string.`, line);
        const key = `${turns}:${item.id}`;
        let step = items.get(key);
        if (!step) {
          step = { stepId: key, stepIndex: steps.length, type: item.type === 'command_execution' || item.type === 'mcp_tool_call' ? 'tool_call' : 'system_event', name: typeof item.command === 'string' ? item.command : item.type.replace(/_/g, ' '), status: 'running', startedAt: time ?? epoch, durationMs: 0 };
          items.set(key, step);
          steps.push(step);
        }
        const bad = item.status === 'failed' || (typeof item.exit_code === 'number' && item.exit_code !== 0);
        step.status = bad ? 'failed' : event.type === 'item.completed' ? 'success' : 'running';
        step.metadata = { ...step.metadata, ...item, codexItemType: item.type };
        if ('aggregated_output' in item) step.output = item.aggregated_output;
        else if ('text' in item) step.output = item.text;
        else if (step.output === undefined) step.output = item;
        if (typeof item.command === 'string') step.input = item.command;
        if (bad) step.error = { message: typeof item.exit_code === 'number' ? `Command exited with code ${item.exit_code}` : 'Codex item failed', details: item.error };
        if (event.type === 'item.completed' && time) {
          step.completedAt = time;
          step.durationMs = step.startedAt === epoch ? 0 : Math.max(0, Date.parse(time) - Date.parse(step.startedAt));
        }
        break;
      }
      case 'error': {
        recognized = true;
        failed = true;
        if (typeof event.message !== 'string') return fail('Error event requires a message string.', line);
        steps.push({ stepId: `event-${line}`, stepIndex: steps.length, type: 'system_event', name: 'Codex error', status: 'failed', startedAt: time ?? epoch, durationMs: 0, error: { message: event.message } });
        break;
      }
      default:
        warnings.push(`Line ${line}: unsupported event ${event.type} was retained as metadata only.`);
        steps.push({ stepId: `event-${line}`, stepIndex: steps.length, type: 'system_event', name: event.type, status: 'success', startedAt: time ?? epoch, durationMs: 0, metadata: { event } });
    }
  }
  if (!recognized) return fail('Unsupported format. Import TraceLens JSON or Codex exec --json output.');
  const telemetryComplete = turns > 0 && !activeTurn && closedTurns === turns && usageTurns === turns;
  const timingKnown = allTimed && !!firstTime && !!lastTime;
  if (!timingKnown) for (const step of steps) { step.startedAt = epoch; delete step.completedAt; step.durationMs = 0; }
  if (!telemetryComplete) warnings.push('Token telemetry is incomplete; total tokens are unknown.');
  if (!timingKnown) warnings.push('Timestamps are unavailable; duration is unknown.');
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) hash = Math.imul(hash ^ content.charCodeAt(i), 16777619);
  return validateTraceLensJson({
    schemaVersion: 'tracelens-v1', runId: `codex-${thread ?? 'run'}-${(hash >>> 0).toString(16)}`,
    name: filename.replace(/\.(jsonl|json)$/i, '') || 'Codex run', agentName: 'Codex', model,
    status: failed ? 'failed' : turns > 0 && !activeTurn ? 'success' : 'running',
    startedAt: timingKnown ? firstTime! : epoch,
    ...(timingKnown && !activeTurn ? { completedAt: lastTime } : {}),
    totalDurationMs: timingKnown ? Date.parse(lastTime!) - Date.parse(firstTime!) : 0,
    ...(telemetryComplete ? { totalTokens: observed } : {}),
    metadata: { source: 'codex-exec-jsonl', import: { telemetryComplete, timingKnown, acceptance: 'unverified',
      ...(usageTurns > 0 && cacheUsageTurns === usageTurns ? { cachedInputTokens } : {}),
      ...(usageTurns > 0 && reasoningUsageTurns === usageTurns ? { reasoningOutputTokens } : {}),
      ...(usageTurns ? { observedTokens: observed } : {}), warnings } }, steps,
  });
}
