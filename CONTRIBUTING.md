# Contributing to TraceLens

Start with `npm ci`, `npm run dev`, then use **Try sanitized Codex examples**. No account, API key or model call is needed to develop the viewer.

Before opening a change, run `npm test`, `npm run lint`, `npm run build`, and relevant `npm run test:e2e` checks. Tests use Chrome locally; CI installs Playwright Chromium. Keep source traces inert, missing measurements explicit, and CLI status separate from acceptance. Prefer existing helpers and components; no dependency is needed for small format adapters.

Useful contributions include a minimal synthetic event showing an import bug, support for a documented Codex exec event, a clearer failure diagnostic, accessibility fixes, or a test for incomplete telemetry. Explain what changed and how you verified it.

Never attach a raw personal trace to an issue or PR. Logs may contain prompts, source code, commands, paths and secrets. Replace the content with a small synthetic reproduction while preserving the event structure. You can export a default Markdown comparison, review it and remove any sensitive edits or opt-in names before sharing.

Contributions are provided under the project's MIT license.
