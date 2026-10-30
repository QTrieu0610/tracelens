"""Run with the optional Python environment: python -m unittest discover -s scripts -p test_pydantic_evals.py."""
import unittest
import json
from datetime import date

import logfire
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from pydantic_evals import Case, Dataset
from pydantic_evals.evaluators import EqualsExpected, TrajectoryMatch, MaxToolCalls, Evaluator
from pydantic import BaseModel

from pydantic_evals_export import export_report


class ExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.spans = InMemorySpanExporter()
        logfire.configure(send_to_logfire=False, console=False, metrics=False,
                          additional_span_processors=[SimpleSpanProcessor(cls.spans)])

    def setUp(self):
        self.spans.clear()

    def evaluate(self, task, evaluators=None):
        return Dataset(name='test', cases=[Case(name='one', inputs='input', expected_output='OK')],
                       evaluators=evaluators or [EqualsExpected()]).evaluate_sync(task, progress=False)

    def export(self, report, **kwargs):
        return export_report(report, self.spans.get_finished_spans(), dataset_id='test',
                             dataset_revision='v1', agent_name='test', model='deterministic', **kwargs)

    def test_right_output_cannot_hide_wrong_tool_order(self):
        def task(_):
            for tool in ['fill', 'validate']:
                with logfire.span('execute_tool ' + tool, **{'gen_ai.tool.name': tool}):
                    pass
            return 'OK'
        report = self.evaluate(task, [EqualsExpected(), TrajectoryMatch(expected_trajectory=['validate', 'fill'], order='exact'), MaxToolCalls(max_calls=2)])
        trace = self.export(report, score_thresholds={'TrajectoryMatch': 1.0})
        tools = [s for s in trace['steps'] if s['type'] == 'tool_call']
        self.assertEqual([s['name'] for s in tools], ['fill', 'validate'])
        checks = {s['name']: s for s in trace['steps'] if s['metadata'].get('evaluator')}
        self.assertEqual(checks['one / EqualsExpected']['status'], 'success')
        failure = checks['one / TrajectoryMatch']
        self.assertEqual(failure['status'], 'failed')
        self.assertEqual(failure['output']['value'], 0.0)
        self.assertEqual(failure['output']['evidenceStepIds'], [s['stepId'] for s in tools])
        self.assertTrue(failure['error']['message'])
        self.assertEqual(trace['status'], 'success')  # execution completed; acceptance is separate

    def test_unthresholded_score_is_not_claimed_as_acceptance(self):
        report = self.evaluate(lambda _: 'OK', [TrajectoryMatch(expected_trajectory=[], order='exact')])
        trace = self.export(report)
        score = next(s for s in trace['steps'] if s['name'] == 'one / TrajectoryMatch')
        self.assertEqual(score['status'], 'skipped')
        self.assertFalse(score['metadata']['evaluator'])

    def test_task_and_evaluator_errors_are_visible(self):
        def broken(_):
            raise RuntimeError('task broke')
        trace = self.export(self.evaluate(broken))
        self.assertEqual(trace['status'], 'failed')
        self.assertTrue(any('task broke' in s.get('error', {}).get('message', '') for s in trace['steps']))

        class BrokenJudge(Evaluator):
            def evaluate(self, ctx):
                raise RuntimeError('judge broke')

        trace = self.export(self.evaluate(lambda _: 'OK', [EqualsExpected(), BrokenJudge()]))
        self.assertEqual(trace['status'], 'failed')
        self.assertTrue(any('judge broke' in s.get('error', {}).get('message', '') for s in trace['steps']))

    def test_unknown_timing_and_tokens_are_not_invented(self):
        report = self.evaluate(lambda _: 'OK')
        trace = export_report(report, [], dataset_id='test', dataset_revision='v1', agent_name='test', model='test')
        self.assertFalse(trace['metadata']['import']['timingKnown'])
        self.assertNotIn('totalTokens', trace)

    def test_rejects_ambiguous_case_ids_and_invalid_thresholds(self):
        report = self.evaluate(lambda _: 'OK')
        report.cases.append(report.cases[0])
        with self.assertRaises(ValueError):
            self.export(report)
        report.cases.pop()
        with self.assertRaises(ValueError):
            self.export(report, score_thresholds={'x': float('nan')})

    def test_structured_inputs_and_outputs_are_json_serializable(self):
        class Contact(BaseModel):
            email: str
            created: date

        value = Contact(email='test@example.test', created=date(2026, 10, 30))
        report = Dataset(name='structured', cases=[Case(name='structured', inputs=value, expected_output=value)],
                         evaluators=[EqualsExpected()]).evaluate_sync(lambda contact: contact, progress=False)
        trace = json.loads(json.dumps(self.export(report)))
        output = next(s['output'] for s in trace['steps'] if s['name'] == 'structured / task output')
        self.assertEqual(output['actual'], {'email': 'test@example.test', 'created': '2026-10-30'})
        self.assertEqual(output['inputs'], output['actual'])
        self.assertEqual(output['expected'], output['actual'])


if __name__ == '__main__':
    unittest.main()
