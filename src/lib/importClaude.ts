import { TokenUsage, TraceLensStep, ValidationResult } from '../types/trace';
import { validateTraceLensJson } from './validator';

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const nonempty = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const epoch = '1970-01-01T00:00:00.000Z';

/** Public Claude Code print output only; assistant partial usage is not final telemetry. */
export function parseClaudeEvents(events: Record<string, unknown>[], filename: string, content: string): ValidationResult {
  const fail = (message: string): ValidationResult => ({ valid: false, errors: [{ path: '', message, code: 'INVALID_IMPORT' }] });
  const steps: TraceLensStep[] = [];
  const tools = new Map<string, TraceLensStep>();
  const warnings = ['Timestamps are unavailable; duration is unknown.', 'CLI completion does not verify task acceptance.'];
  let session: string | undefined;
  let final: Record<string, unknown> | undefined;
  let initialized = false;
  let model = 'unknown';
  const addText = (text: string, name: string) => steps.push({ stepId: `event-${steps.length}`, stepIndex: steps.length, type: 'system_event', name, status: 'success', startedAt: epoch, durationMs: 0, output: text });
  for (const event of events) {
    if (final) return fail('Claude event appeared after the terminal result.');
    if ('session_id' in event) {
      if (!nonempty(event.session_id)) return fail('Claude events require a non-empty session_id.');
      if (session && session !== event.session_id) return fail('Multiple Claude sessions are unsupported. Import one run per file.');
      session = event.session_id;
    }
    if (event.type === 'system' && event.subtype === 'init') {
      if (initialized || !nonempty(event.session_id)) return fail('Expected one Claude init event with session_id.');
      initialized = true;
      if (nonempty(event.model)) model = event.model;
    } else if (event.type === 'result') {
      if (final || !nonempty(event.session_id) || !nonempty(event.subtype) || typeof event.is_error !== 'boolean') return fail('Expected one Claude result with session_id, subtype and boolean is_error.');
      final = event;
      if (typeof event.result === 'string') addText(event.result, 'Claude result');
      if (Array.isArray(event.errors)) addText(JSON.stringify(event.errors), 'Claude errors');
    } else if (event.type === 'assistant' || event.type === 'user') {
      if (!object(event.message)) return fail('Claude message must be an object.');
      const blocks = event.message.content;
      if (typeof blocks === 'string') { addText(blocks, `${event.type} message`); continue; }
      if (!Array.isArray(blocks)) return fail('Claude message content must be a string or block array.');
      for (const block of blocks) {
        if (!object(block) || typeof block.type !== 'string') return fail('Invalid Claude message block.');
        if (block.type === 'tool_use' && event.type === 'assistant') {
          if (!nonempty(block.id) || !nonempty(block.name) || !object(block.input) || tools.has(block.id)) return fail('Tool use requires a unique id, name and input object.');
          const step: TraceLensStep = { stepId: `tool-${block.id}`, stepIndex: steps.length, type: 'tool_call', name: block.name, status: 'running', startedAt: epoch, durationMs: 0, input: block.input };
          tools.set(block.id, step);
          steps.push(step);
        } else if (block.type === 'tool_result' && event.type === 'user') {
          const step = typeof block.tool_use_id === 'string' ? tools.get(block.tool_use_id) : undefined;
          if (!step || step.status !== 'running') return fail('Tool result requires one preceding unmatched tool_use_id.');
          if (block.is_error != null && typeof block.is_error !== 'boolean') return fail('Tool result is_error must be boolean or null.');
          if (block.content != null && typeof block.content !== 'string' && !Array.isArray(block.content)) return fail('Tool result content must be a string, block array or null.');
          step.output = block.content;
          step.status = block.is_error === true ? 'failed' : 'success';
          if (block.is_error === true) step.error = { message: typeof block.content === 'string' && block.content ? block.content : 'Claude tool failed', details: block.content };
        } else if (block.type === 'text') {
          if (typeof block.text !== 'string') return fail('Text block requires text.');
          addText(block.text, `${event.type} message`);
        }
        // Thinking blocks are deliberately omitted rather than presented as reasoning evidence.
      }
    } else {
      warnings.push(`Unsupported Claude event ${String(event.type)} was omitted.`);
    }
  }
  if (!session || (!initialized && !final)) return fail('Expected public Claude Code init or result output.');
  let totalTokens: TokenUsage | undefined;
  let cachedInputTokens: number | undefined;
  let cacheCreationInputTokens: number | undefined;
  if (final?.usage != null) {
    if (!object(final.usage)) return fail('Claude result usage must be an object.');
    const usage = final.usage;
    const keys = ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'output_tokens'];
    for (const key of keys) if (key in usage && !integer(usage[key])) return fail(`Invalid usage ${key}: expected a non-negative safe integer.`);
    if (keys.every(key => integer(usage[key]))) {
      cachedInputTokens = usage.cache_read_input_tokens as number;
      cacheCreationInputTokens = usage.cache_creation_input_tokens as number;
      const promptTokens = (usage.input_tokens as number) + cacheCreationInputTokens + cachedInputTokens;
      const completionTokens = usage.output_tokens as number;
      if (![cachedInputTokens, promptTokens, promptTokens + completionTokens].every(integer)) return fail('Claude usage exceeds the safe integer limit.');
      totalTokens = { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
    }
  }
  if (!totalTokens) warnings.push('Final token telemetry is incomplete; total tokens are unknown.');
  if ([...tools.values()].some(step => step.status === 'running')) warnings.push('Some tool calls have no result.');
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) hash = Math.imul(hash ^ content.charCodeAt(i), 16777619);
  return validateTraceLensJson({
    schemaVersion: 'tracelens-v1', runId: `claude-${session}-${(hash >>> 0).toString(16)}`,
    name: filename.replace(/\.(jsonl|json)$/i, '') || 'Claude run', agentName: 'Claude Code', model,
    status: final ? final.is_error || final.subtype !== 'success' ? 'failed' : 'success' : 'running',
    startedAt: epoch, totalDurationMs: 0, ...(totalTokens ? { totalTokens } : {}),
    metadata: { source: 'claude-code-stream-json', import: { telemetryComplete: !!totalTokens, timingKnown: false, acceptance: 'unverified', warnings,
      ...(cachedInputTokens !== undefined ? { cachedInputTokens } : {}),
      ...(cacheCreationInputTokens !== undefined ? { cacheCreationInputTokens } : {}),
      ...(integer(final?.duration_ms) ? { sourceDurationMs: final.duration_ms } : {}) } }, steps,
  });
}
