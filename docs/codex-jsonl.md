# Supported trace input

## Antigravity (AGY)

AGY public `--output-format stream-json` uses `event: init`, `step_update`, and `result`, rather than the other CLIs' `type` envelope. The initial adapter was verified by importing an actual user-terminal smoke capture through the browser. It merges response deltas by step index and reads usage only from the final result, avoiding duplicated per-step usage. Thinking and cache-read counts are subsets of output and input; they are not added again. Missing or incompatible usage remains Unknown. An advertised tools list does not establish tool execution.

The source's `duration_seconds` is displayed separately as source-reported elapsed time. Absolute timestamps and timestamp-derived comparison durations remain Unknown. Model identity remains unknown unless explicitly present. Only the observed public stream and synthetic edge cases are covered; a real multi-step AGY tool task has not been validated. Other step kinds are conservatively treated as actions for smoke validation.

## Other supported inputs

TraceLens accepts `tracelens-v1` JSON, Codex exec JSONL, AGY public stream JSON, Claude Code public stream JSON (or a final result JSON), and Gemini CLI public stream JSON. It does not read private session/rollout files, arbitrary terminal text or arbitrary JSONL. Import one session/run per file.

Choose a JSON/JSONL file, drag it onto the import dialog, or paste the content. File decoding supports UTF-8 (optional BOM) and UTF-16LE with a BOM, including Windows PowerShell `Tee-Object` output. Files are limited to 10 MB; available localStorage space can impose a smaller practical limit. An import that cannot be saved reports an error rather than pretending it persisted.

Recognized events: `thread.started`, `turn.started`, `item.started`, `item.updated`, `item.completed`, `turn.completed`, `turn.failed`, and `error`. Updates are merged by item ID within a turn. Failed commands remain visible even when the CLI completes its turn successfully. Import one thread per file. Unknown event kinds are preserved as metadata and produce a warning; malformed lines and known unsupported rollout envelopes produce diagnostics.

Token totals use reported input plus output usage, not visible message length. Cached input and reasoning output are subsets, never added again to the total. Missing usage or unfinished turns leave the total Unknown; observed partial usage remains in run metadata. This does not recover unreported in-flight token consumption or establish a dollar charge on a subscription.

Ordinary exec JSONL often has no timestamps. TraceLens keeps event order and displays timing as Unknown. The v1 representation uses placeholder dates/durations plus an explicit `metadata.import.timingKnown=false` marker; consumers must honor that marker. No wall-clock estimate is derived from file modification time or event count.

CLI execution status is distinct from task acceptance. Plain imports show **Unverified (no evaluator evidence)**. Evaluator observations in v1 traces are source-provided declarations, not cryptographic attestations. Positional comparison is not semantic alignment and does not prove a regression or causality.

The examples in `public/examples` are hand-authored, synthetic and safe to share. Real logs may contain private prompts, code, command output and paths. The full JSON export is not sanitized; use the default Markdown report and review it before sharing.

## Claude Code

Accepts public output from print mode with `--output-format stream-json --verbose`. The final `result` JSON is also accepted, but it cannot reconstruct tools absent from that object. Assistant tool-use blocks are paired with user tool-result blocks. Partial usage and thinking blocks are not interpreted as final telemetry or reasoning evidence. Source duration is retained in metadata; absent complete timestamps, displayed timing remains Unknown.

Final usage requires explicit input, output, cache creation and cache read counters. Normalized input includes input + cache creation + cache read; cached input displays reads only. Creation remains a separate metadata field. Missing counters leave total usage Unknown. CLI success and tool failure remain separate.

References: [official CLI streaming documentation](https://code.claude.com/docs/en/headless), [official SDK message schema](https://github.com/anthropics/claude-agent-sdk-python/blob/main/src/claude_agent_sdk/types.py).

## Gemini CLI

Accepts `init`, `message`, `tool_use`, `tool_result`, `error` and terminal `result` events from `--output-format stream-json`. Warning events do not mark the CLI as failed. Tool failures remain visible even if the terminal result succeeds. Complete chronological timestamps enable event timing; incomplete timing remains Unknown. The single-object `--output-format json` format is not supported.

Only final statistics establish usage. Gemini's provider total can include categories beyond its reported input and output. If that total differs from input + output, TraceLens retains it as `metadata.import.providerTotalTokens`, warns, and leaves the comparable normalized total Unknown. It does not invent a reasoning/output split to force the v1 token equation.

References: [official headless documentation](https://geminicli.com/docs/cli/headless/), [event schema](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/output/types.ts), [statistics formatter](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/output/stream-json-formatter.ts).

These adapters were checked against the linked schemas and synthetic fixtures, not live authenticated runs of every released CLI version. Do not use cross-provider token deltas as equivalent billing units or evidence of model quality.
