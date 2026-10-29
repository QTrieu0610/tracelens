import { TraceLensV1Trace, ValidationIssue, ValidationResult, StepStatus, StepType, RunStatus } from '../types/trace';

const VALID_RUN_STATUSES: RunStatus[] = ["success", "failed", "running", "cancelled"];
const VALID_STEP_STATUSES: StepStatus[] = ["success", "failed", "running", "cancelled", "skipped"];
const VALID_STEP_TYPES: StepType[] = [
  "user_input",
  "agent_thought",
  "tool_call",
  "subagent_invocation",
  "plan_step",
  "system_event"
];

function isValidIsoDate(dateString: string): boolean {
  if (typeof dateString !== 'string') return false;
  const d = new Date(dateString);
  return !isNaN(d.getTime());
}

export function benchmarkMetadataIssues(raw: unknown): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const check = (valid: boolean, field: string) => {
    if (!valid) errors.push({ path: `metadata.benchmark${field ? `.${field}` : ''}`, message: 'Invalid or missing benchmark field', code: 'INVALID_BENCHMARK' });
  };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    check(false, '');
    return errors;
  }
  const b = raw as Record<string, unknown>;
  const nonempty = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
  check(nonempty(b.experimentId), 'experimentId');
  check(nonempty(b.taskId), 'taskId');
  check(b.mode === 'single' || b.mode === 'multi', 'mode');
  check(b.condition === 'clean' || b.condition === 'interrupted', 'condition');
  check(typeof b.repetition === 'number' && Number.isInteger(b.repetition) && b.repetition > 0, 'repetition');
  check(b.evidenceKind === 'real-agent' || b.evidenceKind === 'harness-self-check', 'evidenceKind');
  check(b.tokenTelemetry === 'unavailable' || b.tokenTelemetry === 'complete', 'tokenTelemetry');
  const model = b.modelConfig;
  if (!model || typeof model !== 'object' || Array.isArray(model)) check(false, 'modelConfig');
  else {
    const config = model as Record<string, unknown>;
    check(nonempty(config.model), 'modelConfig.model');
    check(nonempty(config.effort), 'modelConfig.effort');
    check(typeof config.verified === 'boolean', 'modelConfig.verified');
  }
  return errors;
}

export function validateTraceLensJson(raw: unknown): ValidationResult {
  const errors: ValidationIssue[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      valid: false,
      errors: [{ path: '', message: 'Trace payload must be a JSON object', code: 'INVALID_ROOT' }]
    };
  }

  const data = raw as Record<string, unknown>;
  const optionalObject = (value: unknown, path: string) => {
    if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value))) errors.push({ path, message: 'Expected an object', code: 'INVALID_FIELD' });
  };
  const optionalString = (value: unknown, path: string) => {
    if (value !== undefined && typeof value !== 'string') errors.push({ path, message: 'Expected a string', code: 'INVALID_FIELD' });
  };
  const tokens = (value: unknown, path: string) => {
    if (value === undefined) return;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push({ path, message: 'Token usage must be an object', code: 'INVALID_TOKENS' }); return;
    }
    const usage = value as Record<string, unknown>;
    if (!['promptTokens', 'completionTokens', 'totalTokens'].every(key => typeof usage[key] === 'number' && Number.isSafeInteger(usage[key]) && (usage[key] as number) >= 0)
      || (usage.promptTokens as number) + (usage.completionTokens as number) !== usage.totalTokens) {
      errors.push({ path, message: 'Tokens must be non-negative safe integers; total must equal prompt plus completion', code: 'INVALID_TOKENS' });
    }
  };
  tokens(data.totalTokens, 'totalTokens');
  optionalObject(data.metadata, 'metadata');
  optionalString(data.description, 'description');
  if (data.tags !== undefined && (!Array.isArray(data.tags) || !data.tags.every(tag => typeof tag === 'string'))) errors.push({ path: 'tags', message: 'Tags must be an array of strings', code: 'INVALID_FIELD' });
  if (data.metadata && typeof data.metadata === 'object' && 'benchmark' in data.metadata) {
    errors.push(...benchmarkMetadataIssues(data.metadata.benchmark));
  }

  // Schema version
  if (data.schemaVersion !== 'tracelens-v1') {
    errors.push({
      path: 'schemaVersion',
      message: `Invalid or missing schemaVersion. Expected "tracelens-v1", got "${String(data.schemaVersion)}"`,
      code: 'INVALID_SCHEMA_VERSION'
    });
  }

  // Required root fields
  if (typeof data.runId !== 'string' || !data.runId.trim()) {
    errors.push({ path: 'runId', message: 'runId is required and must be a non-empty string', code: 'MISSING_FIELD' });
  }

  if (typeof data.name !== 'string' || !data.name.trim()) {
    errors.push({ path: 'name', message: 'name is required and must be a non-empty string', code: 'MISSING_FIELD' });
  }

  if (typeof data.agentName !== 'string' || !data.agentName.trim()) {
    errors.push({ path: 'agentName', message: 'agentName is required and must be a non-empty string', code: 'MISSING_FIELD' });
  }

  if (typeof data.model !== 'string' || !data.model.trim()) {
    errors.push({ path: 'model', message: 'model is required and must be a non-empty string', code: 'MISSING_FIELD' });
  }

  if (!VALID_RUN_STATUSES.includes(data.status as RunStatus)) {
    errors.push({
      path: 'status',
      message: `status must be one of: ${VALID_RUN_STATUSES.join(', ')}. Got: "${String(data.status)}"`,
      code: 'INVALID_STATUS'
    });
  }

  if (!isValidIsoDate(data.startedAt as string)) {
    errors.push({ path: 'startedAt', message: 'startedAt must be a valid ISO 8601 date string', code: 'INVALID_DATE' });
  }

  if (typeof data.totalDurationMs !== 'number' || !Number.isFinite(data.totalDurationMs) || data.totalDurationMs < 0) {
    errors.push({ path: 'totalDurationMs', message: 'totalDurationMs must be a non-negative number', code: 'INVALID_DURATION' });
  }

  // Steps array
  if (!Array.isArray(data.steps)) {
    errors.push({ path: 'steps', message: 'steps is required and must be an array', code: 'MISSING_FIELD' });
  } else {
    let lastStartTime: number = new Date(data.startedAt as string).getTime() || 0;

    data.steps.forEach((stepRaw, idx) => {
      const stepPath = `steps[${idx}]`;
      if (!stepRaw || typeof stepRaw !== 'object' || Array.isArray(stepRaw)) {
        errors.push({ path: stepPath, message: 'Step must be a valid object', code: 'INVALID_STEP' });
        return;
      }

      const step = stepRaw as Record<string, unknown>;
      tokens(step.tokens, `${stepPath}.tokens`);
      optionalObject(step.metadata, `${stepPath}.metadata`);
      optionalObject(step.error, `${stepPath}.error`);
      optionalString(step.thought, `${stepPath}.thought`);
      optionalString(step.parentId, `${stepPath}.parentId`);
      if (step.error && typeof step.error === 'object') {
        const error = step.error as Record<string, unknown>;
        if (typeof error.message !== 'string') errors.push({ path: `${stepPath}.error.message`, message: 'Error message must be a string', code: 'INVALID_ERROR' });
        optionalString(error.code, `${stepPath}.error.code`);
        optionalString(error.stack, `${stepPath}.error.stack`);
      }
      if (step.metadata && typeof step.metadata === 'object') {
        const metadata = step.metadata as Record<string, unknown>;
        if ('milestoneId' in metadata && (typeof metadata.milestoneId !== 'string' || !metadata.milestoneId.trim())) {
          errors.push({ path: `${stepPath}.metadata.milestoneId`, message: 'milestoneId must be a non-empty string', code: 'INVALID_MILESTONE' });
        }
        if ('evaluator' in metadata && typeof metadata.evaluator !== 'boolean') {
          errors.push({ path: `${stepPath}.metadata.evaluator`, message: 'evaluator must be a boolean', code: 'INVALID_MILESTONE' });
        }
      }

      if (typeof step.stepId !== 'string' || !step.stepId.trim()) {
        errors.push({ path: `${stepPath}.stepId`, message: 'stepId is required', code: 'MISSING_FIELD' });
      }

      if (typeof step.stepIndex !== 'number' || !Number.isSafeInteger(step.stepIndex) || step.stepIndex < 0) {
        errors.push({ path: `${stepPath}.stepIndex`, message: 'stepIndex must be a non-negative integer', code: 'INVALID_INDEX' });
      }

      if (!VALID_STEP_TYPES.includes(step.type as StepType)) {
        errors.push({
          path: `${stepPath}.type`,
          message: `type must be one of: ${VALID_STEP_TYPES.join(', ')}. Got "${String(step.type)}"`,
          code: 'INVALID_STEP_TYPE'
        });
      }

      if (typeof step.name !== 'string' || !step.name.trim()) {
        errors.push({ path: `${stepPath}.name`, message: 'name is required', code: 'MISSING_FIELD' });
      }

      if (!VALID_STEP_STATUSES.includes(step.status as StepStatus)) {
        errors.push({
          path: `${stepPath}.status`,
          message: `status must be one of: ${VALID_STEP_STATUSES.join(', ')}. Got "${String(step.status)}"`,
          code: 'INVALID_STATUS'
        });
      }

      if (typeof step.durationMs !== 'number' || !Number.isFinite(step.durationMs) || step.durationMs < 0) {
        errors.push({ path: `${stepPath}.durationMs`, message: 'durationMs must be a non-negative number', code: 'INVALID_DURATION' });
      }

      if (!isValidIsoDate(step.startedAt as string)) {
        errors.push({ path: `${stepPath}.startedAt`, message: 'startedAt must be a valid ISO 8601 date string', code: 'INVALID_DATE' });
      } else {
        const stepTime = new Date(step.startedAt as string).getTime();
        // Check temporal regression within sequence (allow concurrent subagent starts, but flag backward jumps > 60s)
        if (stepTime < lastStartTime - 60000) {
          errors.push({
            path: `${stepPath}.startedAt`,
            message: `Event ordering anomaly: Step started before preceding steps (${step.startedAt} precedes parent sequence)`,
            code: 'TIME_ORDERING_VIOLATION'
          });
        }
        lastStartTime = Math.max(lastStartTime, stepTime);
      }

      // If status is failed, recommended to check error object
      if (step.status === 'failed' && (!step.error || typeof step.error !== 'object')) {
        errors.push({
          path: `${stepPath}.error`,
          message: 'Step marked as failed should include an error object with a message',
          code: 'MISSING_ERROR_DETAILS'
        });
      }
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    trace: raw as TraceLensV1Trace
  };
}
