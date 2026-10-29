# Current beta verification — 2026-10-23

## Local product update: 2026-10-29

`npm start` now builds and opens the local production viewer. The installable tarball exposes `tracelens` and `tracelens run codex|claude|gemini|agy -- ...`. Captures are saved separately from browser imports, and the Dashboard lists local captures without manual file selection. See [local setup and storage](local-use.md).

Verified on this Windows machine:

- Unit suite: 157/157 passed. Local process/HTTP/CLI checks: 7/7 passed. Curated-release check, typecheck and production build passed.
- Full browser suite: 69 passed, one intentional desktop-screenshot-on-mobile skip; includes production static server to synthetic subprocess log to browser import on desktop/mobile.
- Built package installed offline into an isolated workspace prefix: one package, zero runtime dependencies. Runtime scripts matched the source byte-for-byte. Headless Chrome opened its installed production UI and imported the actual Codex smoke capture without page errors.
- Actual wrapped Codex response `TRACELENS_CAPTURE_OK`, process exit 0, 16,300 input + 10 output = 16,310 tokens; cache-read 12,416 is a subset of input. Wrapper elapsed 8.652 s is separate; source event timing remains unknown. Two earlier failed setup/sandbox attempts were retained.
- Curated source copy: 144 unit checks passed, three explicit private-fixture skips; seven local checks, release validation and typecheck passed. Those source checks resolved installed development tools from the enclosing workspace, not a clean network install.
- Review found a symlink-entry startup defect. A Windows directory-junction test reproduced the silent exit before the realpath fix, then passed. Native Linux/macOS execution was unavailable.

No authenticated Claude/Gemini/AGY call was made through the new wrapper in this update. Fixture checks are not live-provider evidence. No npm publication, global install, deployment or external-user study was performed. Raw captures are unencrypted, may contain secrets, and remain separate from browser storage.

## Earlier beta verification: 2026-10-23

The beta expansion adds searchable long traces, bounded step rendering, failure navigation and explicit analytics selection. Existing storage protections, CLI importers and report privacy rules remain in place.

## Verified locally

- 143 unit tests passed, including source adapters, parser limits, storage errors, search/filter selection, cohort intersection and three real HTTP server lifecycle checks.
- Full desktop/mobile browser suite: 63 passed, 1 intentionally skipped (desktop-only screenshot on mobile), normal exit code 0 in 50.0 seconds.
- Explorer acceptance uses a synthetic 1,000-step trace: at most 100 steps render at a time; output/error/input searches, combined filters, page/keyboard transitions, failure navigation and run changes were exercised.
- Analytics excludes recognized demos by default; tests cover explicit inclusion/reset, intersecting source/model/tag selections, missing usage and empty libraries.
- TypeScript, production build and curated-release allowlist checks passed. A separate read-only review found no high/medium issue in selection or server ownership.
- The Windows browser-test cleanup hang was reproduced at Playwright's npm/shell server-termination boundary. Global setup now owns Vite directly through its Node API. Tests prove owned shutdown, non-owning reuse and refusal of an unrelated application on the port. The complete browser suite then exited normally.

Verification used available local dependencies. It is not evidence of a fresh network install, hosted GitHub CI or a deployed site. Browser mobile projects emulate a viewport, not low-memory phone hardware.

## Actual CLI evidence

Separate authenticated user-terminal captures were checked locally:

| Capture | Verified usage | Timing evidence |
| --- | --- | --- |
| Codex smoke | 16,990 input + 9 output = 16,999 | Runner elapsed 9.205 s; log timestamps absent |
| AGY smoke | 18,062 input + 218 output = 18,280; thinking 213 already included in output | Source-reported elapsed 8.3705448 s; absolute timestamps absent |

The actual AGY file passed browser import. Earlier actual Codex logs also matched their recorded totals. These are smoke/import checks, not matched model-quality or reliability studies. The changed paired Codex + AGY command has not yet been rerun in the user's terminal. No real multi-step AGY tool task or authenticated Claude/Gemini run has been verified.

## Publication and remaining limits

Private raw logs and research workspaces stay outside the curated source allowlist. Public examples and browser screenshots are synthetic. The allowlist and SHA256 manifest reduce accidental inclusion; they are not an automated secret scanner for arbitrary future edits.

No repository has been created/pushed and no demo has been deployed. Unverified: external user usefulness/adoption, large logs on weak hardware, complete compatibility across CLI versions, independent authenticity of trace/evaluator declarations and general task recovery/reliability.

Use the [participant tasks and measures](product-stability.md) to test usefulness with developers and researchers. Test counts do not establish time savings or user retention.
