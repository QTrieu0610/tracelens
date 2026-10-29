import { StepStatus, StepType, TraceLensStep } from '../types/trace';

export function indexSteps(steps: TraceLensStep[]) {
  return steps.map(step => ({ step, text: [step.name, step.input, step.output, step.error]
    .map(value => typeof value === 'string' ? value : JSON.stringify(value) ?? '').join('\n').toLowerCase() }));
}

export function filterSteps(index: ReturnType<typeof indexSteps>, query: string, status: StepStatus | 'all', type: StepType | 'all') {
  const text = query.trim().toLowerCase();
  return index.filter(entry => (status === 'all' || entry.step.status === status)
    && (type === 'all' || entry.step.type === type) && entry.text.includes(text)).map(entry => entry.step);
}
