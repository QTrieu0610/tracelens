export type SchemaVersion = "tracelens-v1";

export type RunStatus = "success" | "failed" | "running" | "cancelled";

export type StepType =
  | "user_input"
  | "agent_thought"
  | "tool_call"
  | "subagent_invocation"
  | "plan_step"
  | "system_event";

export type StepStatus = "success" | "failed" | "running" | "cancelled" | "skipped";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface StepError {
  code?: string;
  message: string;
  stack?: string;
  details?: unknown;
}

export interface TraceLensStep {
  stepId: string;
  stepIndex: number;
  parentId?: string;
  type: StepType;
  name: string;
  status: StepStatus;
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  tokens?: TokenUsage;
  input?: unknown;
  output?: unknown;
  thought?: string;
  error?: StepError;
  metadata?: Record<string, unknown> & { milestoneId?: string; evaluator?: boolean };
}

export interface BenchmarkMetadata {
  experimentId: string;
  taskId: string;
  mode: 'single' | 'multi';
  condition: 'clean' | 'interrupted';
  repetition: number;
  modelConfig: { model: string; effort: string; verified: boolean };
  evidenceKind: 'real-agent' | 'harness-self-check';
  tokenTelemetry: 'unavailable' | 'complete';
}

export interface TraceLensV1Trace {
  schemaVersion: SchemaVersion;
  runId: string;
  name: string;
  description?: string;
  agentName: string;
  model: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  totalDurationMs: number;
  totalTokens?: TokenUsage;
  tags?: string[];
  metadata?: Record<string, unknown> & { benchmark?: BenchmarkMetadata; evaluation?: { datasetId: string; datasetRevision: string } };
  steps: TraceLensStep[];
}

export interface ValidationIssue {
  path: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  trace?: TraceLensV1Trace;
}

export interface StudioAnalytics {
  totalRuns: number;
  successCount: number;
  failureCount: number;
  successRate: number; // 0 - 100
  totalTokens?: number;
  avgDurationMs?: number;
  longestSteps: Array<{
    runId: string;
    runName: string;
    stepId: string;
    stepName: string;
    durationMs: number;
    status: StepStatus;
  }>;
  failureTypes: Record<string, number>;
}

export interface StepDiffItem {
  index: number;
  name: string;
  stepIdA?: string;
  stepIdB?: string;
  typeA?: StepType;
  typeB?: StepType;
  statusA?: StepStatus;
  statusB?: StepStatus;
  durationA?: number;
  durationB?: number;
  durationDiffMs?: number;
  statusMatch: boolean;
  tokensA?: number;
  tokensB?: number;
  hasStructureDifference: boolean;
  notes: string[];
}

export interface RunComparisonResult {
  runA: TraceLensV1Trace;
  runB: TraceLensV1Trace;
  durationDeltaMs?: number;
  tokenDelta?: number;
  alignment: 'sequence' | 'milestone' | 'incompatible';
  comparisonWarning?: string;
  stepCountDelta: number;
  statusChanged: boolean;
  stepDiffs: StepDiffItem[];
  evaluationSummary?: {
    baselinePassed: number; baselineTotal: number; candidatePassed: number; candidateTotal: number;
    regressions: number; improvements: number; missing: number; added: number;
  };
}

export type HonestyVerdict =
  | 'HONEST_PASS'
  | 'HONEST_FAIL_DISCLOSED'
  | 'FALSE_COMPLETION_CLAIM'
  | 'UNSUPPORTED_METRIC_CLAIM'
  | 'UNVERIFIED';

export interface HonestyDiscrepancy {
  stepId: string;
  stepIndex: number;
  stepName: string;
  type: 'exit_code_ignored' | 'timeout_ignored' | 'metric_mismatch' | 'fabricated_evidence';
  evidence: string;
}

export interface HonestyAuditResult {
  verdict: HonestyVerdict;
  hasFalseCompletionClaim: boolean;
  failureDisclosed: boolean;
  unsupportedClaimsCount: number;
  discrepancies: HonestyDiscrepancy[];
  summary: string;
  aggregateSummary?: string;
}
