"""Deterministic, instrumented form-fill regression experiment; no LLM calls."""
import argparse
from dataclasses import asdict
from datetime import datetime, timezone
from hashlib import sha256
from importlib.metadata import version
import json
from pathlib import Path

import logfire
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from pydantic_evals import Case, Dataset
from pydantic_evals.evaluators import EqualsExpected, MaxToolCalls, TrajectoryMatch
from pydantic_evals.reporting import EvaluationReportAdapter

from pydantic_evals_export import export_report

TOOLS = ['extract_data', 'analyze_form', 'validate_mapping', 'fill_form']


def tool(name, arguments, operation):
    with logfire.span('execute_tool ' + name, **{
        'gen_ai.tool.name': name,
        'gen_ai.tool.call.arguments': json.dumps(arguments),
    }) as span:
        result = operation()
        span.set_attribute('tracelens.tool.result', result)
        return result


def form_agent(inputs, *, regressed=False):
    data = tool('extract_data', inputs['record'], lambda: dict(inputs['record']))
    fields = tool('analyze_form', {'form': 'contact'}, lambda: ['name', 'email'])
    if regressed and inputs['scenario'] == 'budget':
        for _ in range(4):
            tool('analyze_form', {'form': 'contact'}, lambda: ['name', 'email'])
    mapping = {key: data[key] for key in fields}

    def validate():
        if not mapping['name'] or '@' not in mapping['email']:
            raise ValueError('Invalid contact data')
        return mapping

    def fill():
        return dict(mapping)

    if regressed and inputs['scenario'] == 'order':
        output = tool('fill_form', mapping, fill)
        tool('validate_mapping', mapping, validate)
    else:
        tool('validate_mapping', mapping, validate)
        output = tool('fill_form', mapping, fill)
    if regressed and inputs['scenario'] == 'output':
        output['email'] = 'wrong@example.test'
    return output


def run_experiment(output_dir):
    memory = InMemorySpanExporter()
    logfire.configure(send_to_logfire=False, console=False, metrics=False,
                      additional_span_processors=[SimpleSpanProcessor(memory)])
    cases = [Case(name=f'{scenario}-{i}', inputs={
        'scenario': scenario,
        'record': {'name': f'Contact {i}', 'email': f'contact{i}@example.test'},
    }, expected_output={'name': f'Contact {i}', 'email': f'contact{i}@example.test'})
        for scenario in ['clean', 'output', 'order', 'budget'] for i in range(1, 6)]
    evaluators = [EqualsExpected(), TrajectoryMatch(expected_trajectory=TOOLS, order='exact'), MaxToolCalls(max_calls=4)]
    dataset = Dataset(name='form-fill-integration', cases=cases, evaluators=evaluators)
    thresholds = {'TrajectoryMatch': 1.0}
    contract = {'cases': [asdict(c) for c in cases], 'tools': TOOLS, 'order': 'exact',
                'maxToolCalls': 4, 'thresholds': thresholds, 'output': 'EqualsExpected',
                'pydanticEvals': version('pydantic-evals')}
    revision = sha256(json.dumps(contract, sort_keys=True, default=str).encode()).hexdigest()
    output_dir.mkdir(parents=True, exist_ok=True)
    traces = {}
    summary = {'generatedAt': datetime.now(timezone.utc).isoformat(), 'synthetic': True,
               'pydanticEvals': version('pydantic-evals'), 'logfire': version('logfire'),
               'datasetRevision': revision, 'caseCount': 20, 'runs': {}}
    for label in ['baseline', 'regressed']:
        memory.clear()
        report = dataset.evaluate_sync(lambda inputs: form_agent(inputs, regressed=label == 'regressed'),
                                       name=f'Pydantic Evals {label} (synthetic)', progress=False, max_concurrency=1)
        trace = export_report(report, memory.get_finished_spans(), dataset_id=dataset.name,
                              dataset_revision=revision, agent_name=f'form-agent-{label}', model='deterministic-no-llm',
                              score_thresholds=thresholds, synthetic=True)
        traces[label] = trace
        (output_dir / f'{label}.json').write_text(json.dumps(trace, indent=2) + '\n', encoding='utf-8')
        (output_dir / f'{label}-report.json').write_bytes(EvaluationReportAdapter.dump_json(report, indent=2))
        checks = [s for s in trace['steps'] if s['metadata'].get('evaluator')]
        summary['runs'][label] = {
            'executionStatus': trace['status'], 'checksPassed': sum(s['status'] == 'success' for s in checks),
            'checksTotal': len(checks), 'casesPassed': sum(all(s['status'] == 'success' for s in checks if s['metadata']['caseId'] == c.name) for c in cases),
            'toolCalls': sum(s['type'] == 'tool_call' for s in trace['steps']), 'durationMs': trace['totalDurationMs'],
            'criteria': {name: sum(s['status'] == 'success' and s['name'].endswith(' / ' + name) for s in checks)
                         for name in ['EqualsExpected', 'TrajectoryMatch', 'MaxToolCalls']},
        }
    before = {s['metadata']['milestoneId']: s for s in traces['baseline']['steps'] if s['metadata'].get('evaluator')}
    regressions = [s for s in traces['regressed']['steps'] if s['metadata'].get('evaluator')
                   and before.get(s['metadata']['milestoneId'], {}).get('status') == 'success' and s['status'] == 'failed']
    summary['regressions'] = {'output': sum(s['name'].endswith(' / EqualsExpected') for s in regressions),
                              'behavioralChecks': sum(not s['name'].endswith(' / EqualsExpected') for s in regressions),
                              'behavioralCases': len({s['metadata']['caseId'] for s in regressions if not s['name'].endswith(' / EqualsExpected')})}
    (output_dir / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path('.tracelens/evals'))
    args = parser.parse_args()
    print(json.dumps(run_experiment(args.output), indent=2))
