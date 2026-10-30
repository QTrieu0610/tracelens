import { TraceLensV1Trace, StudioAnalytics, RunComparisonResult, StepDiffItem } from '../types/trace';
import { benchmarkMetadataIssues, evaluationMetadataIssues } from './validator';
import { getRunDuration } from './runEvidence';

export function computeStudioAnalytics(runs: TraceLensV1Trace[]): StudioAnalytics {
  if (!runs || runs.length === 0) {
    return {
      totalRuns: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      totalTokens: 0,
      avgDurationMs: 0,
      longestSteps: [],
      failureTypes: {}
    };
  }

  let successCount = 0;
  let failureCount = 0;
  let totalTokens = 0;
  let totalDuration = 0;
  const failureTypes: Record<string, number> = {};
  const allSteps: Array<{
    runId: string;
    runName: string;
    stepId: string;
    stepName: string;
    durationMs: number;
    status: TraceLensV1Trace['steps'][0]['status'];
  }> = [];

  for (const run of runs) {
    if (run.status === 'success') successCount++;
    if (run.status === 'failed') failureCount++;
    totalDuration += run.totalDurationMs || 0;

    if (run.totalTokens?.totalTokens) {
      totalTokens += run.totalTokens.totalTokens;
    }

    for (const step of run.steps || []) {
      if (getRunDuration(run) !== undefined) allSteps.push({
        runId: run.runId,
        runName: run.name,
        stepId: step.stepId,
        stepName: step.name,
        durationMs: step.durationMs,
        status: step.status
      });

      if (step.status === 'failed') {
        const errorCategory = step.error?.code || (step.error?.message ? step.error.message.split(':')[0] : 'UnspecifiedError');
        failureTypes[errorCategory] = (failureTypes[errorCategory] || 0) + 1;
      }
    }
  }

  allSteps.sort((a, b) => b.durationMs - a.durationMs);

  const totalRuns = runs.length;
  const successRate = totalRuns > 0 ? Math.round((successCount / totalRuns) * 100) : 0;
  const avgDurationMs = totalRuns > 0 ? Math.round(totalDuration / totalRuns) : 0;

  return {
    totalRuns,
    successCount,
    failureCount,
    successRate,
    totalTokens: runs.every(run => Number.isFinite(run.totalTokens?.totalTokens)) ? totalTokens : undefined,
    avgDurationMs: runs.every(run => getRunDuration(run) !== undefined) ? avgDurationMs : undefined,
    longestSteps: allSteps.slice(0, 5),
    failureTypes
  };
}

export function computeRunComparison(runA: TraceLensV1Trace, runB: TraceLensV1Trace): RunComparisonResult {
  const durationA = getRunDuration(runA), durationB = getRunDuration(runB);
  const durationDeltaMs = durationA !== undefined && durationB !== undefined ? durationB - durationA : undefined;
  const tokenA = runA.totalTokens?.totalTokens;
  const tokenB = runB.totalTokens?.totalTokens;
  const tokenDelta = typeof tokenA === 'number' && Number.isFinite(tokenA) && typeof tokenB === 'number' && Number.isFinite(tokenB) ? tokenB - tokenA : undefined;
  const stepCountDelta = (runB.steps?.length || 0) - (runA.steps?.length || 0);
  const statusChanged = runA.status !== runB.status;

  const benchmarkA = runA.metadata?.benchmark;
  const benchmarkB = runB.metadata?.benchmark;
  const hasBenchmark = (run: TraceLensV1Trace) => !!run.metadata && 'benchmark' in run.metadata;
  const evalA = runA.metadata?.evaluation, evalB = runB.metadata?.evaluation;
  const hasEvaluation = (run: TraceLensV1Trace) => !!run.metadata && 'evaluation' in run.metadata;
  const alignment: RunComparisonResult['alignment'] = hasEvaluation(runA) || hasEvaluation(runB)
    ? !hasBenchmark(runA) && !hasBenchmark(runB) && evalA && evalB
      && !evaluationMetadataIssues(evalA).length && !evaluationMetadataIssues(evalB).length
      && evalA.datasetId === evalB.datasetId && evalA.datasetRevision === evalB.datasetRevision ? 'milestone' : 'incompatible'
    : !hasBenchmark(runA) && !hasBenchmark(runB) ? 'sequence'
    : benchmarkA && benchmarkB && !benchmarkMetadataIssues(benchmarkA).length && !benchmarkMetadataIssues(benchmarkB).length
      && benchmarkA.experimentId === benchmarkB.experimentId && benchmarkA.taskId === benchmarkB.taskId ? 'milestone' : 'incompatible';
  const milestones = (run: TraceLensV1Trace) => {
    const result = new Map<string, TraceLensV1Trace['steps'][number]>();
    for (const step of run.steps) {
      if (step.metadata?.evaluator === true && typeof step.metadata.milestoneId === 'string') result.set(step.metadata.milestoneId, step);
    }
    return result;
  };
  const milestonesA = alignment === 'milestone' ? milestones(runA) : new Map<string, TraceLensV1Trace['steps'][number]>();
  const milestonesB = alignment === 'milestone' ? milestones(runB) : new Map<string, TraceLensV1Trace['steps'][number]>();
  const ids = [...new Set([...milestonesA.keys(), ...milestonesB.keys()])];
  const maxSteps = alignment === 'incompatible' ? 0 : alignment === 'milestone' ? ids.length : Math.max(runA.steps?.length || 0, runB.steps?.length || 0);
  const stepDiffs: StepDiffItem[] = [];

  for (let i = 0; i < maxSteps; i++) {
    const sA: TraceLensV1Trace['steps'][number] | undefined = alignment === 'milestone' ? milestonesA.get(ids[i]) : runA.steps?.[i];
    const sB: TraceLensV1Trace['steps'][number] | undefined = alignment === 'milestone' ? milestonesB.get(ids[i]) : runB.steps?.[i];

    const notes: string[] = [];
    const name = alignment === 'milestone' ? ids[i] : sA?.name || sB?.name || `Step ${i + 1}`;
    const statusMatch = sA?.status === sB?.status;

    let hasStructureDifference = false;

    if (!sA) {
      notes.push('Step added in Run B');
      hasStructureDifference = true;
    } else if (!sB) {
      notes.push('Step removed in Run B');
      hasStructureDifference = true;
    } else {
      if (sA.name !== sB.name) {
        notes.push(`Step name changed: "${sA.name}" → "${sB.name}"`);
        hasStructureDifference = true;
      }
      if (sA.type !== sB.type) {
        notes.push(`Step type changed: ${sA.type} → ${sB.type}`);
        hasStructureDifference = true;
      }
      if (!statusMatch) {
        notes.push(`Status changed: ${sA.status} → ${sB.status}`);
      }
    }

    const durationA = getRunDuration(runA) === undefined ? undefined : sA?.durationMs;
    const durationB = getRunDuration(runB) === undefined ? undefined : sB?.durationMs;
    const durationDiffMs = (durationB !== undefined && durationA !== undefined) ? durationB - durationA : undefined;

    stepDiffs.push({
      index: i,
      name,
      stepIdA: sA?.stepId,
      stepIdB: sB?.stepId,
      typeA: sA?.type,
      typeB: sB?.type,
      statusA: sA?.status,
      statusB: sB?.status,
      durationA,
      durationB,
      durationDiffMs,
      statusMatch: Boolean(statusMatch),
      tokensA: sA?.tokens?.totalTokens,
      tokensB: sB?.tokens?.totalTokens,
      hasStructureDifference,
      notes
    });
  }

  return {
    runA,
    runB,
    alignment,
    comparisonWarning: alignment === 'incompatible' ? 'Comparison requires matching valid evaluation dataset/revision or benchmark experiment/task metadata. No steps aligned.' : undefined,
    durationDeltaMs,
    tokenDelta,
    stepCountDelta,
    statusChanged,
    stepDiffs,
    evaluationSummary: alignment === 'milestone' ? {
      baselinePassed: [...milestonesA.values()].filter(s => s.status === 'success').length,
      baselineTotal: milestonesA.size,
      candidatePassed: [...milestonesB.values()].filter(s => s.status === 'success').length,
      candidateTotal: milestonesB.size,
      regressions: stepDiffs.filter(s => s.statusA === 'success' && s.statusB === 'failed').length,
      improvements: stepDiffs.filter(s => s.statusA === 'failed' && s.statusB === 'success').length,
      missing: stepDiffs.filter(s => s.statusB === undefined).length,
      added: stepDiffs.filter(s => s.statusA === undefined).length,
    } : undefined
  };
}
