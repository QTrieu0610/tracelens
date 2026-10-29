import { TokenUsage, TraceLensStep, ValidationResult } from '../types/trace';
import { validateTraceLensJson } from './validator';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const epoch = '1970-01-01T00:00:00.000Z';

/** AGY public event/step_update/result stream, verified against a saved CLI capture. */
export function parseAgyEvents(events: Record<string, unknown>[], filename: string, content: string): ValidationResult {
  const fail = (message: string): ValidationResult => ({ valid: false, errors: [{ path: '', message, code: 'INVALID_IMPORT' }] });
  const init = events[0];
  if (!init || init.event !== 'init' || typeof init.conversation_id !== 'string' || !init.conversation_id.trim()) return fail('AGY requires an initial conversation_id.');
  const steps: TraceLensStep[] = [];
  const byIndex = new Map<number, TraceLensStep>();
  const warnings = ['Absolute timestamps are unavailable; timing is unknown. CLI completion does not verify task acceptance.'];
  let final: Record<string, unknown> | undefined;
  for (let i = 1; i < events.length; i++) {
    const event = events[i];
    if (final) return fail('Events after the AGY result are unsupported. Import one conversation per file.');
    if (event.event === 'result') {
      if (!object(event.result) || event.result.conversation_id !== init.conversation_id || !['SUCCESS', 'ERROR', 'FAILED', 'CANCELLED'].includes(event.result.status as string)) return fail('Invalid AGY result or mixed conversations.');
      if ('response' in event.result && typeof event.result.response !== 'string') return fail('AGY response must be a string.');
      if ('duration_seconds' in event.result && (typeof event.result.duration_seconds !== 'number' || !Number.isFinite(event.result.duration_seconds * 1000) || event.result.duration_seconds < 0)) return fail('Invalid AGY duration_seconds.');
      if ('denied_actions' in event.result && !Array.isArray(event.result.denied_actions)) return fail('AGY denied_actions must be an array.');
      final = event.result;
    } else if (event.event === 'step_update') {
      const update = event.step_update;
      if (!object(update) || update.conversation_id !== init.conversation_id || !integer(update.step_index) || typeof update.step_type !== 'string' || !update.step_type.trim()
        || !['ACTIVE', 'PENDING', 'DONE', 'ERROR', 'FAILED', 'CANCELLED'].includes(update.state as string)) return fail('Invalid AGY step update or mixed conversations.');
      if ('text_delta' in update && typeof update.text_delta !== 'string') return fail('AGY text_delta must be a string.');
      if ('tool_info' in update && !object(update.tool_info)) return fail('AGY tool_info must be an object.');
      if ('tool_name' in update && (typeof update.tool_name !== 'string' || !update.tool_name.trim())) return fail('AGY tool_name must be a nonempty string.');
      let step = byIndex.get(update.step_index);
      if (!step) {
        const kind = update.step_type;
        step = { stepId: `step-${update.step_index}`, stepIndex: steps.length, type: kind === 'user_input' ? 'user_input' : kind === 'agent_response' ? 'system_event' : 'tool_call', name: kind === 'agent_response' ? 'Assistant message' : kind.replace(/_/g, ' '), status: 'running', startedAt: epoch, durationMs: 0, output: '', metadata: { agyStepType: kind, sourceStepIndex: update.step_index } };
        byIndex.set(update.step_index, step); steps.push(step);
      }
      if (step.metadata?.agyStepType !== update.step_type || (step.status !== 'running' && ['ACTIVE', 'PENDING'].includes(update.state as string))) return fail('AGY step type or state regressed.');
      if (typeof update.text_delta === 'string') step.output = (typeof step.output === 'string' ? step.output : '') + update.text_delta;
      const tool = object(update.tool_info) ? update.tool_info : undefined;
      if (step.type === 'tool_call') {
        const name = update.tool_name ?? tool?.name;
        if (typeof name === 'string' && name.trim()) step.name = name;
        if (tool && 'parameters' in tool) step.input = tool.parameters;
        if (tool && 'output' in tool) step.output = tool.output;
      }
      step.status = update.state === 'DONE' ? 'success' : update.state === 'CANCELLED' ? 'cancelled' : ['ERROR', 'FAILED'].includes(update.state as string) ? 'failed' : 'running';
      if (step.status === 'failed') step.error = { message: object(tool?.error) && typeof tool.error.message === 'string' ? tool.error.message : 'AGY step reported failure', details: update };
    } else return fail('Unsupported AGY event. Expected step_update or result.');
  }
  let totalTokens: TokenUsage | undefined;
  let cachedInputTokens: number | undefined, reasoningOutputTokens: number | undefined, providerTotalTokens: number | undefined;
  if (final?.usage !== undefined) {
    if (!object(final.usage)) return fail('AGY usage must be an object.');
    const usage = final.usage;
    for (const key of ['input_tokens', 'output_tokens', 'total_tokens', 'thinking_tokens', 'cache_read_tokens']) if (key in usage && !integer(usage[key])) return fail(`Invalid AGY usage ${key}.`);
    if (integer(usage.input_tokens) && integer(usage.output_tokens) && integer(usage.total_tokens)) {
      const sum = usage.input_tokens + usage.output_tokens;
      if (!integer(sum) || usage.total_tokens < sum || (integer(usage.thinking_tokens) && usage.thinking_tokens > usage.output_tokens)) return fail('Inconsistent AGY usage totals or subsets.');
      if (sum === usage.total_tokens) totalTokens = { promptTokens: usage.input_tokens, completionTokens: usage.output_tokens, totalTokens: sum };
      else { providerTotalTokens = usage.total_tokens; warnings.push('Provider total differs from input plus output; normalized tokens are unknown.'); }
      if (integer(usage.cache_read_tokens)) cachedInputTokens = usage.cache_read_tokens;
      if (integer(usage.thinking_tokens)) reasoningOutputTokens = usage.thinking_tokens;
    }
  }
  if (!totalTokens) warnings.push('Final token telemetry is incomplete or incompatible; normalized totals are unknown.');
  if (Array.isArray(final?.denied_actions) && final.denied_actions.length) warnings.push(`AGY reported ${final.denied_actions.length} denied action(s); task execution may be incomplete.`);
  if (final && !steps.some(step => step.metadata?.agyStepType === 'agent_response') && typeof final.response === 'string') steps.push({ stepId: 'final-response', stepIndex: steps.length, type: 'system_event', name: 'Assistant message', status: 'success', startedAt: epoch, durationMs: 0, output: final.response });
  if (final && final.status !== 'SUCCESS') steps.push({ stepId: 'result-error', stepIndex: steps.length, type: 'system_event', name: 'AGY result', status: 'failed', startedAt: epoch, durationMs: 0, error: { message: 'AGY CLI reported failure', details: final } });
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) hash = Math.imul(hash ^ content.charCodeAt(i), 16777619);
  return validateTraceLensJson({ schemaVersion: 'tracelens-v1', runId: `agy-${(hash >>> 0).toString(16)}`, name: filename.replace(/\.(jsonl|json)$/i, '') || 'AGY run', agentName: 'Antigravity CLI', model: object(init.init) && typeof init.init.model === 'string' && init.init.model.trim() ? init.init.model : 'unknown',
    status: !final ? 'running' : final.status === 'SUCCESS' ? 'success' : final.status === 'CANCELLED' ? 'cancelled' : 'failed', startedAt: epoch, totalDurationMs: 0, ...(totalTokens ? { totalTokens } : {}),
    metadata: { source: 'antigravity-stream-json', import: { telemetryComplete: !!totalTokens, timingKnown: false, acceptance: 'unverified', warnings,
      ...(final ? { finalResponse: final.response } : {}), ...(typeof final?.duration_seconds === 'number' ? { sourceDurationMs: final.duration_seconds * 1000 } : {}),
      ...(Array.isArray(final?.denied_actions) ? { deniedActions: final.denied_actions } : {}),
      ...(cachedInputTokens !== undefined ? { cachedInputTokens } : {}), ...(reasoningOutputTokens !== undefined ? { reasoningOutputTokens } : {}), ...(providerTotalTokens !== undefined ? { providerTotalTokens } : {}) } }, steps });
}
