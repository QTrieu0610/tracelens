# Security and privacy

The viewer parses imported files in the browser and stores runs in that browser's localStorage. It does not upload trace content or call a model. Example loading fetches static synthetic files from the same site. Browser extensions, shared browser profiles and other scripts on the hosting origin may still access browser data; localStorage is not encrypted storage.

The optional local CLI saves raw agent stdout/stderr, command arguments and working directories under `~/.tracelens` (or `--data-dir`). These files may contain secrets. The loopback-only server makes captures available to its own browser UI; it does not expose an agent-execution API or upload logs. Raw captures and browser imports are separate copies: deleting a browser run does not remove disk files. Other processes running as your user can access the same files. See [local capture and storage](docs/local-use.md).

Trace contents are untrusted, inert data. Do not execute commands copied from a trace without inspecting them. A successful CLI turn or a claimed evaluator result is not proof of correctness or authenticity.

Markdown export includes allowlisted aggregate metrics by default. Raw command/output/error/prompt content and paths are excluded. Optional run names and manual edits may be sensitive: always inspect the preview. Full JSON export contains the original trace data and is not sanitized.

Do not put raw logs, auth.json, API keys or personal benchmark workspaces in a public repository. Use `npm run prepare:github` to produce the curated product source tree, then inspect its manifest and contents. The allowlist reduces accidental inclusion; it does not scan arbitrary code edits for secrets.

If you suspect a vulnerability, do not disclose credentials or private traces in a public issue. Use GitHub private vulnerability reporting if the repository owner has enabled it. Otherwise ask the maintainer for a private contact without including sensitive details. No private reporting endpoint has been configured by this local setup.
