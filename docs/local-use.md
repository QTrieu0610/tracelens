# Run TraceLens locally

Requires Node.js 22+ and npm. No agent or login is required to view existing logs or synthetic examples.

## From source

```sh
npm ci
npm start
```

`npm start` builds the viewer, starts a server bound to `127.0.0.1:5188`, and opens your browser. Use `npm start -- --no-open` on a headless machine, or `npm start -- --port 5189` if the default port is occupied. `npm run dev` is still available for development.

Keep that terminal open. In a second terminal in this checkout:

```sh
npm run capture -- codex -- --sandbox read-only "Explain this project. Do not modify files."
```

The agent runs in your current working directory with your existing settings/authentication. TraceLens adds structured output flags without disabling permission checks. It streams stdout to your terminal and a JSONL file, and saves stderr separately. The command returns the agent's nonzero exit code when one is available. Process success does not establish task correctness.

Go to Dashboard → **Local agent captures** → **Open trace**. The list refreshes every five seconds. An empty or oversized log cannot be opened; **View stderr** helps diagnose missing agents or authentication failures. A capture still marked in progress may have been interrupted: TraceLens never assumes it succeeded. Existing file/paste imports continue to work.

## Install for use in any project

The maintainer can create a portable npm package:

```sh
npm run pack:app
```

This builds the app and writes `.release/tracelens-1.0.0.tgz`. The package contains the built viewer and runtime scripts, not research artifacts, credentials, real logs or source-only development tools. Nothing is published to npm automatically. Send the reviewed tarball to another developer, who installs it with:

```sh
npm install --global /path/to/tracelens-1.0.0.tgz
tracelens
```

They can then run from **their own project directory**:

```sh
tracelens run codex -- --sandbox read-only "Review this project. Do not modify files."
tracelens run claude -- "Review this project"
tracelens run gemini -- "Review this project"
tracelens run agy -- "Review this project"
```

Install/authenticate each agent separately. Agent calls use the agent account's allowance. Codex and Claude arguments are passed through after the wrapper's structured-output flags. Gemini and AGY examples supply a single prompt; the wrapper inserts `-p`. When supplying extra Gemini/AGY options, explicitly include `-p`, for example `tracelens run gemini -- --model YOUR_MODEL -p "your task"`. Do not supply your own `--output-format`. On Windows, native `.exe` installations and standard npm shim locations are supported; custom shell aliases/functions are not executable programs.

The recommended Codex example uses read-only mode explicitly. For your normal implementation tasks, pass the same agent permissions and options you would use without TraceLens. The wrapper does not add permission-bypass flags.

## Storage and privacy

Default capture directory: `~/.tracelens/runs/<unique-id>/`, shared across project directories. Each run contains `stdout.jsonl`, `stderr.log` and `manifest.json` (provider, arguments, working directory, timestamps and process outcome). Raw logs, prompts, arguments and paths can contain private data. Unix directories/files are created with owner-only permissions where supported; Windows uses inherited filesystem ACLs. Storage is not encrypted.

To keep logs somewhere else, use the **same** directory for the viewer and capture command:

```sh
tracelens --data-dir /private/path/traces
tracelens --data-dir /private/path/traces run codex -- "your task"
```

The local server only serves the built UI and captured files. It has no endpoint to launch an agent and accepts no write requests. It rejects cross-origin API requests and unknown hosts; other processes under your OS account can still access your files. The browser fetches a capture only when you open it and stores the parsed run in localStorage. Deleting a run in the browser does not delete its raw capture on disk; remove reviewed capture folders yourself if needed. Reopening captures updates their existing browser entry.

The viewer accepts logs up to 10 MB. Larger captures remain intact on disk. Unknown token/time data stays unknown. Capture-process failure or unfinished status overrides a successful-looking log, and partial token observations are retained only as metadata, not advertised as complete totals.

Static hosting still supports manual file imports; local capture discovery is available only through the Node local server. Do not put captures under the public static assets directory. Review exports before sharing.

## Verify

```sh
npm test
npm run test:local
npm run test:release
npm run lint
npm run build
npm run test:e2e
```

Local subprocess tests use synthetic executable output without model calls. They test real file IO/process exits and HTTP requests. Live provider availability and smoke evidence are recorded separately; fixture tests do not attest to every installed CLI version.
