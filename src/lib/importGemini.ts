import { TokenUsage, TraceLensStep, ValidationResult } from '../types/trace';
import { validateTraceLensJson } from './validator';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const epoch = '1970-01-01T00:00:00.000Z';

/** Public Gemini CLI --output-format stream-json events only. */
export function parseGeminiEvents(events: Record<string, unknown>[], filename: string, content: string): ValidationResult {
  const fail = (message: string, index = 0): ValidationResult => ({ valid: false, errors: [{ path: `event ${index + 1}`, message, code: 'INVALID_IMPORT' }] });
  const init = events[0];
  if (!init || init.type !== 'init' || !text(init.session_id) || !text(init.model)) return fail('Gemini stream requires an initial init with session_id and model.');
  const steps: TraceLensStep[] = [];
  const tools = new Map<string, TraceLensStep>();
  const warnings: string[] = [];
  let terminal: Record<string, unknown> | undefined;
  let usage: TokenUsage | undefined;
  let providerTotalTokens: number | undefined;
  let cachedInputTokens: number | undefined;
  let allTimed = true;
  let firstTime: string | undefined;
  let lastTime: string | undefined;
  for (const [index, event] of events.entries()) {
    if (terminal) return fail('Events after the final result are unsupported. Import one session per file.', index);
    if ('session_id' in event && event.session_id !== init.session_id) return fail('Mixed Gemini sessions are unsupported.', index);
    const time = typeof event.timestamp === 'string' && Number.isFinite(Date.parse(event.timestamp)) ? new Date(event.timestamp).toISOString() : undefined;
    if (!time) allTimed = false;
    if (time) {
      if (lastTime && time < lastTime) return fail('Event timestamps must be chronological.', index);
      firstTime ??= time;
      lastTime = time;
    }
    const step: TraceLensStep = { stepId: `event-${index}`, stepIndex: steps.length, type: 'system_event', name: `Gemini ${event.type}`, status: 'success', startedAt: time ?? epoch, durationMs: 0, metadata: { event } };
    switch (event.type) {
      case 'init':
        if (index !== 0) return fail('Multiple init events are unsupported.', index);
        break;
      case 'message':
        if (!['user', 'assistant'].includes(event.role as string) || typeof event.content !== 'string' || ('delta' in event && typeof event.delta !== 'boolean')) return fail('Message requires a user/assistant role, string content, and optional boolean delta.', index);
        step.type = event.role === 'user' ? 'user_input' : 'system_event';
        step.name = event.role === 'user' ? 'User message' : 'Assistant message';
        step.output = event.content;
        steps.push(step);
        break;
      case 'tool_use':
        if (!text(event.tool_id) || !text(event.tool_name) || !object(event.parameters)) return fail('Tool use requires tool_id, tool_name and object parameters.', index);
        if (tools.has(event.tool_id)) return fail('Duplicate tool_id.', index);
        step.type = 'tool_call';
        step.name = event.tool_name;
        step.status = 'running';
        step.input = event.parameters;
        tools.set(event.tool_id, step);
        steps.push(step);
        break;
      case 'tool_result': {
        if (!text(event.tool_id) || !['success', 'error'].includes(event.status as string)) return fail('Tool result requires tool_id and success/error status.', index);
        const tool = tools.get(event.tool_id);
        if (!tool || tool.status !== 'running') return fail('Orphan or duplicate tool result.', index);
        if ('output' in event && typeof event.output !== 'string') return fail('Tool output must be a string.', index);
        if ('error' in event && (!object(event.error) || typeof event.error.message !== 'string' || !text(event.error.type))) return fail('Tool error requires type and message.', index);
        tool.status = event.status === 'error' ? 'failed' : 'success';
        tool.output = event.output;
        tool.metadata = { ...tool.metadata, result: event };
        if (tool.status === 'failed') tool.error = { message: object(event.error) ? event.error.message as string : 'Gemini tool failed', details: event.error };
        if (time) {
          tool.completedAt = time;
          tool.durationMs = tool.startedAt === epoch ? 0 : Date.parse(time) - Date.parse(tool.startedAt);
        }
        break;
      }
      case 'error':
        if (!['warning', 'error'].includes(event.severity as string) || typeof event.message !== 'string') return fail('Error requires severity warning/error and a string message.', index);
        step.name = `Gemini ${event.severity}`;
        step.output = event.message;
        if (event.severity === 'error') { step.status = 'failed'; step.error = { message: event.message }; }
        else warnings.push(event.message);
        steps.push(step);
        break;
      case 'result': {
        if (!['success', 'error'].includes(event.status as string)) return fail('Result requires success/error status.', index);
        if ('error' in event && (!object(event.error) || typeof event.error.message !== 'string' || !text(event.error.type))) return fail('Result error requires type and message.', index);
        terminal = event;
        if ('stats' in event) {
          const stats = event.stats;
          if (!object(stats)) return fail('Stats must be an object.', index);
          const validTokens = (value: Record<string, unknown>) => ['input_tokens', 'output_tokens', 'total_tokens'].every(key => integer(value[key]))
            && (value.input_tokens as number) + (value.output_tokens as number) <= (value.total_tokens as number)
            && (!('cached' in value) || integer(value.cached) && value.cached <= (value.input_tokens as number))
            && (!('input' in value) || integer(value.input) && value.input <= (value.input_tokens as number))
            && (!('cached' in value && 'input' in value) || (value.cached as number) + (value.input as number) === value.input_tokens);
          if (!validTokens(stats)) return fail('Stats require safe integer token counts with consistent totals and cached/input subsets.', index);
          if ('duration_ms' in stats && !integer(stats.duration_ms)) return fail('Stats duration_ms must be a non-negative safe integer.', index);
          if ('tool_calls' in stats && !integer(stats.tool_calls)) return fail('Stats tool_calls must be a non-negative safe integer.', index);
          if ('models' in stats && (!object(stats.models) || !Object.values(stats.models).every(model => object(model) && validTokens(model)))) return fail('Invalid per-model token statistics.', index);
          providerTotalTokens = stats.total_tokens as number;
          // Provider totals can include thoughts/tool tokens absent from stream output_tokens.
          if ((stats.input_tokens as number) + (stats.output_tokens as number) === providerTotalTokens) {
            usage = { promptTokens: stats.input_tokens as number, completionTokens: stats.output_tokens as number, totalTokens: providerTotalTokens };
          } else warnings.push('Provider total differs from input plus output tokens; comparable total tokens are unknown.');
          if ('cached' in stats) cachedInputTokens = stats.cached as number;
        }
        step.name = 'Gemini result';
        step.output = event;
        if (event.status === 'error') { step.status = 'failed'; step.error = { message: object(event.error) ? event.error.message as string : 'Gemini CLI failed', details: event.error }; }
        steps.push(step);
        break;
      }
      default:
        return fail(`Unsupported Gemini stream event: ${String(event.type)}.`, index);
    }
  }
  const timingKnown = !!terminal && allTimed;
  const telemetryComplete = !!terminal && !!usage;
  if (terminal && [...tools.values()].some(tool => tool.status === 'running')) warnings.push('Tool calls are missing a tool result at the final result.');
  if (!telemetryComplete) warnings.push('Token telemetry is incomplete; total tokens are unknown.');
  if (!timingKnown) warnings.push('Timing is incomplete; epoch timestamps and zero durations represent unknown timing.');
  if (!allTimed) for (const step of steps) { step.startedAt = epoch; delete step.completedAt; step.durationMs = 0; }
  let hash = 2166136261;
  for (let index = 0; index < content.length; index++) hash = Math.imul(hash ^ content.charCodeAt(index), 16777619);
  return validateTraceLensJson({
    schemaVersion: 'tracelens-v1', runId: `gemini-${(hash >>> 0).toString(16)}`, name: filename.replace(/\.(jsonl|json)$/i, '') || 'Gemini run',
    agentName: 'Gemini CLI', model: init.model, status: terminal ? terminal.status === 'error' ? 'failed' : 'success' : 'running',
    startedAt: allTimed ? firstTime! : epoch,
    ...(timingKnown ? { completedAt: lastTime } : {}), totalDurationMs: timingKnown ? Date.parse(lastTime!) - Date.parse(firstTime!) : 0,
    ...(usage ? { totalTokens: usage } : {}),
    metadata: { source: 'gemini-cli-stream-json', sessionId: init.session_id, import: { telemetryComplete, timingKnown, acceptance: 'unverified', warnings, ...(providerTotalTokens !== undefined ? { providerTotalTokens } : {}), ...(cachedInputTokens !== undefined ? { cachedInputTokens } : {}) } }, steps,
  });
}
