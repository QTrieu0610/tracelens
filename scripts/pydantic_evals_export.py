"""Convert a Pydantic Evals report and completed OTel spans to tracelens-v1.

Scores require explicit minimum thresholds to become acceptance checks.
Keep the dataset revision tied to cases AND evaluator configuration.
"""
from datetime import datetime, timezone
from math import isfinite
from urllib.parse import quote
from uuid import uuid4
from pydantic_core import to_jsonable_python


def export_report(report, spans, *, dataset_id, dataset_revision, agent_name, model,
                  score_thresholds=None, synthetic=False):
    thresholds = score_thresholds or {}
    if not all(isinstance(v, str) and v.strip() for v in [dataset_id, dataset_revision, agent_name, model]):
        raise ValueError('Dataset identity, revision, agent and model must be non-empty strings')
    if any(not isinstance(v, (int, float)) or isinstance(v, bool) or not isfinite(v) for v in thresholds.values()):
        raise ValueError('Score thresholds must be finite numbers')
    cases = [*report.cases, *report.failures]
    names = [c.name for c in cases]
    if len(set(names)) != len(names):
        raise ValueError('Case names must be unique; export repeated runs separately')

    spans = list(spans)
    by_id = {format(s.context.span_id, '016x'): s for s in spans}

    def belongs(span, case):
        # Match ancestry, not merely trace ID: concurrent cases can share a trace.
        visited = set()
        while span and span.context.span_id not in visited:
            visited.add(span.context.span_id)
            if (format(span.context.trace_id, '032x') == case.trace_id
                    and format(span.context.span_id, '016x') == case.span_id):
                return True
            span = by_id.get(format(span.parent.span_id, '016x')) if span.parent else None
        return False

    relevant = [s for s in spans if any(belongs(s, c) for c in cases)]
    start = min((s.start_time for s in relevant), default=0)
    end = max((s.end_time for s in relevant), default=0)

    def iso(ns):
        return datetime.fromtimestamp(ns / 1e9, timezone.utc).isoformat()

    steps = []

    def add(name, status, *, at=end, duration=0, output=None, metadata=None, error=None, **extra):
        step = dict(stepId=f'step-{len(steps)}', stepIndex=len(steps), type='system_event',
                    name=name, status=status, startedAt=iso(at), durationMs=duration,
                    output=output, metadata=metadata or {})
        if error:
            step['error'] = {'message': error}
        step.update(extra)
        steps.append(step)
        return step['stepId']

    execution_failed = bool(report.failures or report.report_evaluator_failures)
    for case in cases:
        case_spans = sorted((s for s in relevant if belongs(s, case)), key=lambda s: s.start_time)
        case_end = max((s.end_time for s in case_spans), default=end)
        tools = []
        for span in case_spans:
            attrs = dict(span.attributes or {})
            if not (span.name == 'running tool' or span.name.startswith('execute_tool ')):
                continue
            if ('gen_ai.tool.name' not in attrs or 'pydantic_ai.tool.deferral.name' in attrs
                    or str(attrs.get('logfire.msg', '')).startswith('running output function:')):
                continue
            failed = span.status.is_ok is False and span.status.status_code.name == 'ERROR'
            tools.append(add(str(attrs['gen_ai.tool.name']), 'failed' if failed else 'success',
                             at=span.start_time, duration=(span.end_time - span.start_time) / 1e6,
                             type='tool_call', input=attrs.get('gen_ai.tool.call.arguments'),
                             output=attrs, metadata={'caseId': case.name, 'spanId': format(span.context.span_id, '016x')},
                             error=(span.status.description or 'Tool execution failed') if failed else None))

        def check(name, status, output, *, evaluated=True, error=None):
            return add(f'{case.name} / {name}', status, at=case_end, output=output,
                       metadata={'caseId': case.name, 'evaluator': evaluated,
                                 'milestoneId': f'{quote(case.name, safe="")}/{quote(name, safe="")}'}, error=error)

        if hasattr(case, 'error_message'):
            check('task_execution', 'failed', {'inputs': case.inputs}, error=case.error_message)
            continue
        add(f'{case.name} / task output', 'success', at=case_end,
            output={'inputs': case.inputs, 'actual': case.output, 'expected': case.expected_output},
            metadata={'caseId': case.name, 'taskDurationMs': case.task_duration * 1000})
        for kind, results in [('assertion', case.assertions), ('score', case.scores), ('label', case.labels)]:
            for name, result in results.items():
                assessed = kind == 'assertion' or (kind == 'score' and name in thresholds)
                passed = result.value if kind == 'assertion' else result.value >= thresholds[name] if assessed else None
                reason = result.reason or f'{name}: observed {result.value!r}'
                evidence = {'value': result.value, 'reason': reason, 'kind': kind,
                            'source': result.source.name, 'evidenceStepIds': tools,
                            'actualOutput': case.output, 'expectedOutput': case.expected_output}
                if kind == 'score' and assessed:
                    evidence['minimumScore'] = thresholds[name]
                    reason += f'; required >= {thresholds[name]}'
                check(name, 'success' if passed else 'failed' if assessed else 'skipped', evidence,
                      evaluated=assessed, error=reason if assessed and not passed else None)
        for failure in case.evaluator_failures:
            execution_failed = True
            check(f'{failure.name} (evaluator error)', 'failed', {'evidenceStepIds': tools}, error=failure.error_message)

    for failure in report.report_evaluator_failures:
        add(f'Report evaluator error: {failure.name}', 'failed', error=failure.error_message)

    # Tools can be concurrent; sort for the viewer and retain IDs used by evidence links.
    steps.sort(key=lambda s: s['startedAt'])
    for index, step in enumerate(steps):
        step['stepIndex'] = index
    trace = dict(schemaVersion='tracelens-v1', runId=str(uuid4()), name=report.name,
                agentName=agent_name, model=model, status='failed' if execution_failed else 'success',
                startedAt=iso(start), completedAt=iso(end), totalDurationMs=(end - start) / 1e6,
                tags=['pydantic-evals', *(['demo'] if synthetic else [])],
                metadata={'source': 'pydantic-evals', 'syntheticDemo': synthetic,
                          'evaluation': {'datasetId': dataset_id, 'datasetRevision': dataset_revision},
                          'import': {'timingKnown': bool(relevant), 'telemetryComplete': False,
                                     'warnings': ['No model token telemetry exported.']},
                          'scoreThresholds': thresholds}, steps=steps)
    return to_jsonable_python(trace)
