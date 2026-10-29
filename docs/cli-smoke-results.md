# CLI capture and import smoke check

Latest AGY user-terminal capture: 2026-10-23. The actual saved stream passed the shared parser and browser file import. It returned exactly `TELEMETRY_OK` and reported input 18,062, output 218, total 18,280 tokens. Thinking tokens 213 are already included in output; cache-read tokens were explicitly 0. Source-reported elapsed time was 8.3705448 s; absolute timestamps and model identity were absent. This is a separate smoke run, not a matched benchmark against Codex.

`npm run test:cli` now defaults to **Codex + AGY**, replacing Gemini for the requested workflow. The paired command has not yet been rerun from the user's authenticated terminal after this change; the individual Codex and AGY captures were both verified. Gemini import support remains available for existing logs.

Latest authenticated user-terminal run: 2026-10-23. The saved summary and original Codex stdout were checked locally.

| CLI | Result | Elapsed | Reported tokens | Telemetry |
| --- | --- | --- | --- | --- |
| Codex | Passed capture/import smoke check; exit 0 | 9.205 s | 16,999 | Complete |
| Gemini CLI | Unavailable: not found by the runner | Unknown | Unknown | Unknown |

This confirms a real Codex invocation and the shared import path. It does not establish task acceptance, model quality, reliability, or Gemini compatibility. The elapsed time comes from the runner; absent log timestamps, the imported trace still correctly displays timing as Unknown. Raw logs remain private under `.cli-smoke-runs/` and are excluded from the public release.

## Earlier sandbox attempt

Latest sandbox attempt: 2026-10-23. The test was actually invoked with `npm run test:cli`.

| CLI | Observed result | Model request verified? |
| --- | --- | --- |
| Codex 0.163.0 | Process exited 1: configured authentication/configuration directory could not be read due to OS permission restrictions | No |
| Gemini CLI | Not found on PATH or in the default Windows npm install directory | No |

An npm registry request to locate/install Gemini was also denied by this environment. No login credentials were read, copied or replaced. These are environment blocks, not passing live compatibility tests. Earlier actual Codex imports are documented in the project readiness notes; they are not a new Gemini or matched Codex/Gemini trial.

## Run on the user's machine

Use a normal terminal where the CLIs are authenticated. If Gemini is absent, follow [official installation](https://geminicli.com/docs/get-started/installation/) and [authentication](https://geminicli.com/docs/get-started/authentication/) instructions. The standard npm installation is `npm install -g @google/gemini-cli`; launching `gemini` opens the normal authentication flow. Do not put credentials into TraceLens or a bug report.

From the project folder, run `npm run test:cli`. The runner creates a fresh directory, starts a no-tools response run for Codex and AGY, writes raw stdout/stderr separately, imports stdout using the same parser as the browser, and saves `trace.json` when parsing succeeds. On Windows, it also checks the standard per-user AGY native executable location. CLI versions/configuration and account availability remain the caller's responsibility.

The summary reports `passed`, `unavailable`, `cli-error`, `timeout`, `output-limit`, `import-error` or `response-mismatch`. CLI exit 0 alone is not a pass. Usage is reported only when available; no dollar price, model equality or task acceptance is inferred. Keep raw files local. Import each successful `stdout.jsonl` or `trace.json` through **Import your logs** to inspect it in the browser.

The public synthetic fixtures and automated subprocess tests cover the mechanics while live runs are blocked. They must never be presented as authenticated provider executions or user-study evidence.
