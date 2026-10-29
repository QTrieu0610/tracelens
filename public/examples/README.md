# Synthetic CLI examples

`agy-synthetic.jsonl` is a hand-authored, non-private compatibility example based on the observed AGY event shape. It is not the real captured run.

These hand-authored examples contain no real user session data. Both deliberately omit timestamps, as ordinary `codex exec --json` output often does. The viewer must show elapsed time as Unknown. `before` includes a failed command even though the CLI turn completed; `after` has a successful command. Neither proves task acceptance, model equivalence, causality or dollar savings.

Use **Try sanitized Codex examples** on the dashboard or import either JSONL file manually. Never replace these examples with raw personal logs in a public release.

`claude-synthetic.jsonl` and `gemini-synthetic.jsonl` demonstrate a successful read followed by a failed test tool, with a successful CLI result. They are hand-authored compatibility examples, not real executions. Gemini includes synthetic timestamps; Claude does not. Dashboard buttons open each example directly in Trace Explorer.
