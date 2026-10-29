# Stability and usefulness: release acceptance

Audience: developers inspecting CLI executions and researchers comparing workflows.

The shared TraceLens v1 schema remains the interchange format. Native adapters cover Codex exec JSONL, Antigravity (AGY), Claude Code public stream JSON, and Gemini CLI public stream JSON. Other CLIs require an explicit adapter or a producer that emits validated TraceLens v1; arbitrary terminal text is not accepted as telemetry.

Implementation choices: retain React, TypeScript and browser-local storage; no new dependencies, server, credentials or model calls. Preserve reported tool errors independently from CLI completion. Keep missing measurements unknown. Compare evaluator milestones only when benchmark metadata is compatible.

Acceptance checks:

- Corrupt stored data never reaches rendering or gets silently overwritten by an import. Offer the original data as a backup.
- Failed writes leave the displayed library unchanged. An empty library stays empty after reload. Reset requires a visible confirmation.
- Apply the 10 MB limit to files and pasted text.
- Native adapters have deterministic synthetic fixtures and tests for failure, truncation, usage and invalid input.
- A user can reach a late failed command and its output in a 1,000-command trace.
- Explorer searches names/input/output/errors, intersects status/type filters, and renders at most 100 matching steps per page. Selection and keyboard/failure navigation follow the visible results.
- Analytics excludes recognized demos by default and intersects explicit source/model/tag selections without inventing missing measurements. These local selections reset on leaving the view.
- Browser setup closes its own Vite instance through the API and leaves a reused user-owned server running.
- Reports preserve evidence caveats and exclude private raw data by default.
- Unit tests, desktop/mobile browser tests, typecheck, build and curated-release checks pass.

## How to establish usefulness with people

Use a participant's existing logs; running another agent is unnecessary. Keep raw logs local. Ask developers and researchers to perform the same tasks, once using their current log viewer and once using TraceLens; alternate the order between participants.

| Task | Checkable result | Measure |
| --- | --- | --- |
| Diagnose a run | Identify the first failed tool and show its recorded output | Correctness and time to evidence |
| Compare two runs | Report token delta and distinguish CLI completion from acceptance | Correctness and time to answer |
| Review research evidence | Identify compatible milestones and missing telemetry | Incorrect claims and omitted limitations |
| Share findings | Produce a reviewed report without raw private content | Time and privacy review failures |

Record CLI/version, trace size, step count, browser/device, task order, completion, time, assistance required, wrong conclusions, and whether the participant would use it again. Record unsuccessful sessions too. Start with five participants to discover usability problems; this is not a statistically powered efficacy study. Do not publish a claim of time savings from synthetic browser tests or one participant.

Automated tests establish repeatable behavior on the test machine. They cannot establish adoption, universal CLI compatibility, provider billing equivalence, trace authenticity, or reliability across untested hardware and versions.
