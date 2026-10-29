import { TraceLensV1Trace } from '../types/trace';
import { isSyntheticDemo } from './runEvidence';

export interface RunSelection {
  includeExamples?: boolean;
  source?: string | null;
  model?: string | null;
  tag?: string | null;
}

export function getRunSelectionFields(run: TraceLensV1Trace) {
  return {
    source: typeof run.metadata?.source === 'string' && run.metadata.source.trim() ? run.metadata.source : null,
    model: run.model?.trim() ? run.model : null,
  };
}

export function selectAnalyticsRuns(runs: TraceLensV1Trace[], selection: RunSelection): TraceLensV1Trace[] {
  return runs.filter(run => {
    const fields = getRunSelectionFields(run);
    return (selection.includeExamples || !isSyntheticDemo(run))
      && (selection.source === undefined || fields.source === selection.source)
      && (selection.model === undefined || fields.model === selection.model)
      && (selection.tag === undefined || (selection.tag === null ? !run.tags?.length : run.tags?.includes(selection.tag)));
  });
}
