# Pydantic Evals + TraceLens

TraceLens can view Pydantic Evals results alongside the actual local tool spans used by the evaluators. Python runs the evaluations; the existing browser viewer imports `tracelens-v1` JSON. No Python server, Logfire account, model key or cloud telemetry is needed for the deterministic demo.

In Dashboard, click **Try Pydantic Evals comparison** to load the two recorded synthetic runs. The comparison aligns by case/criterion ID. To inspect evidence, open the regressed run in Trace Explorer, search for `order-1 / TrajectoryMatch`, select that check and open **Output** or **Error**. Its output contains the score, threshold, evaluator reason and IDs of that case's tool steps. Search `order-1` to inspect the actual tool arguments and recorded results.

## One-command demo (recommended)

Start the viewer with `npm start`. In a second terminal, run `npm run evals`. Requires Python 3.11+; the command prepares and reuses an isolated environment and installs dependencies on first use. When it finishes, choose **Dashboard → Local evaluations → Open comparison**. You do not need to locate/import files manually. The summary shows acceptance totals, newly failed checks and missing checks. **View candidate evidence** opens the matching check, and **Back to comparison** restores the pair.

The installed-app command is `tracelens eval demo`. Results are saved under `~/.tracelens/evals/<unique-id>/`, alongside separate original reports and `summary.json`. Use matching `--data-dir` options on the viewer and eval command if you customize storage. Manual script/export integration remains available below.

## Reproduce on Windows PowerShell

Requires Python 3.11+ (the pinned Pydantic Evals requirement; verified with 3.12.7); the viewer still requires only Node.js.

```powershell
python -m venv .venv-evals
./.venv-evals/Scripts/python.exe -m pip install -r scripts/requirements-evals.txt
./.venv-evals/Scripts/python.exe -m unittest discover -s scripts -p test_pydantic_evals.py
./.venv-evals/Scripts/python.exe scripts/pydantic_evals_demo.py
npm start
```

Import `.tracelens/evals/baseline.json` and `.tracelens/evals/regressed.json` to inspect your new run. The directory also contains the original Pydantic reports and `summary.json`. The shipped examples are snapshots from the recorded run in `docs/pydantic-evals-results.json`. On Linux/macOS use `.venv-evals/bin/python` for the Python commands.

## Recorded experiment — 2026-10-30

Pydantic Evals 2.63.0, Logfire 5.4.0. Twenty synthetic contact-form cases: five clean, five output-corruption, five wrong-order and five repeated-tool scenarios. Both implementations run the same cases with the same evaluators. The baseline ignores fault scenarios; the regressed implementation deliberately injects their named faults.

| Measurement | Baseline | Regressed |
| --- | ---: | ---: |
| Cases meeting all three checks | 20/20 | 5/20 |
| EqualsExpected | 20/20 | 15/20 |
| TrajectoryMatch, exact, minimum 1.0 | 20/20 | 10/20 |
| MaxToolCalls, maximum 4 | 20/20 | 15/20 |
| Total checks passed | 60/60 | 40/60 |
| Recorded tool calls | 80 | 100 |
| Execution status | success | success |

Detected five output regressions and ten behavioral regression cases. Those ten cases produce fifteen failed behavioral checks: repeated calls fail both the exact-trajectory criterion and the call budget. Every failed check includes evidence. Task functions really execute and emit spans; agent/model behavior is simulated and no LLM is called. Millisecond timings in the result file are measurements of this local experiment, not evidence of model latency or a performance ranking. Tokens remain unknown.

## Use with your own Python agent

Use `export_report` in `scripts/pydantic_evals_export.py` with the result of `Dataset.evaluate_sync` (or awaited `Dataset.evaluate`) and your in-memory exporter's completed spans. See the demo for configuring Logfire with `send_to_logfire=False`, `metrics=False` and a `SimpleSpanProcessor`. Supply a dataset ID, revision, agent name and model. When using Pydantic AI, instrument its agent so evaluators can observe its local tools. The demo emits the documented `execute_tool …` and `gen_ai.tool.name` convention around its own deterministic functions.

Scores are retained as observations unless their evaluator name has an explicit minimum in `score_thresholds`. Boolean assertions become checks directly. Labels remain observations. Task/evaluator exceptions are visible failures. Run status describes execution, while **Evaluator reports … checks passed** describes acceptance. Exports with no span timing are marked unknown; token totals are never fabricated.

Structured Pydantic inputs/outputs and dates are converted with Pydantic's JSON serializer. The honesty audit stays **Unverified** for these exports because judge observations do not establish what an agent claimed in its final report.

Set `metadata.evaluation` to `{ "datasetId": "your-suite", "datasetRevision": "your-contract-hash" }`. Comparison requires the same non-empty ID and revision on both runs. Change the revision when cases, expectations, evaluator configuration, thresholds or evaluator version change. The demo hashes these together. Evaluator steps use stable IDs for case + criterion; raw tool positions do not need to match. This identity is source-declared, not an authenticity guarantee. Do not combine evaluation identity with the separate benchmark identity.

## Limits

- This is an offline Python exporter and a working integration example, not a generic raw Pydantic-report or OTLP importer.
- The exporter supports case assertions, scores, labels, task errors and evaluator errors. Report-level analysis charts are retained only in the original Pydantic report.
- Keep the supplied in-memory span collector for the complete evaluation. Only tools actually producing matching local spans are visible. Native provider tools and CLI logs do not automatically become local spans.
- Repeated case names are rejected; export repetitions separately with unique case names.
- Exported JSON contains raw inputs, outputs and span attributes. Review it before sharing. The included examples contain only synthetic contact data.
- These checks demonstrate detection of deliberately inserted faults. They do not validate a production agent, arbitrary workflows or LLM judges.

Official references: [Pydantic Evals](https://pydantic.dev/docs/ai/evals/evals/), [agentic evaluators](https://pydantic.dev/docs/ai/evals/evaluators/agentic/), [Logfire integration](https://pydantic.dev/docs/ai/evals/how-to/logfire-integration/).

## Integration verification

Verified with 171 viewer unit tests, six Python exporter tests, twelve relevant browser checks across desktop/mobile, seven local-product checks, the curated-source release check and a production build. Browser coverage includes loading the comparison, inspecting failed trajectory evidence, report preview/export and existing benchmark/Codex onboarding. Python coverage includes actual spans, explicit score thresholds, task/judge exceptions, missing timing, duplicate names and structured BaseModel/date serialization. Python 3.12 emits an upstream asyncio event-loop DeprecationWarning during tests; all checks pass. No authenticated live LLM/CLI evaluation was performed.
