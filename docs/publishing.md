# Publish a curated GitHub source tree

For local distribution without publishing, use `npm run pack:app`. Give the reviewed `.release/tracelens-1.0.0.tgz` to another developer; installation and usage are described in [the local guide](local-use.md). The tarball contains built assets and Node runtime files with no runtime npm dependencies. `private: true` remains enabled; this workflow does not publish to the npm registry.

Run `npm run prepare:github`. It creates a new `.release/tracelens-<timestamp>/` folder and prints its path. It never deletes or modifies the original research data. Only product source, synthetic fixtures/examples, product tests, docs, license, scripts and GitHub configuration are copied. Tests requiring private pilot evidence and scripts for paid agent runs are excluded.

Inspect `release-manifest.json` and the files in that folder. This allowlist is protection against accidental artifact inclusion, not a guarantee that future source edits contain no secrets. Keep only synthetic screenshots and examples. Do not upload the whole original working folder: it contains real logs and research workspaces outside the curated tree.

From the curated folder, install dependencies with `npm ci` and run checks before pushing. The public repository is [QTrieu0610/tracelens](https://github.com/QTrieu0610/tracelens). The original research workspace remains separate from the curated Git checkout.

The owner selected MIT. The license uses `TraceLens contributors`; update the copyright line if you prefer a specific owner identity.

CI runs product tests, typecheck, build and browser checks on pushes/PRs. GitHub Pages is configured to use GitHub Actions. To update the hosted demo, manually run **Publish demo (manual)** on the desired branch. The workflow publishes only `dist/`; pushing source alone does not redeploy the website. Vite uses relative asset paths for repository subdirectories.

Live demo: https://qtrieu0610.github.io/tracelens/. First deployed on 2026-10-30 from commit `ed500c7` using [deployment run 40996167728](https://github.com/QTrieu0610/tracelens/actions/runs/40996167728). Verified HTTP 200, loading the Pydantic Evals comparison, viewing failed-check evidence and returning to the comparison without JavaScript errors. The hosted viewer supports file imports and synthetic samples; running Python evaluations and discovering local files requires the local app.

Before announcing the release, ask five developers to import their own logs without help. Observe whether they find a concrete issue, use a comparison to change their workflow and return with a new log. Stars alone do not validate usefulness.
