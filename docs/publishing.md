# Publish a curated GitHub source tree

For local distribution without publishing, use `npm run pack:app`. Give the reviewed `.release/tracelens-1.0.0.tgz` to another developer; installation and usage are described in [the local guide](local-use.md). The tarball contains built assets and Node runtime files with no runtime npm dependencies. `private: true` remains enabled; this workflow does not publish to the npm registry.

Run `npm run prepare:github`. It creates a new `.release/tracelens-<timestamp>/` folder and prints its path. It never deletes or modifies the original research data. Only product source, synthetic fixtures/examples, product tests, docs, license, scripts and GitHub configuration are copied. Tests requiring private pilot evidence and scripts for paid agent runs are excluded.

Inspect `release-manifest.json` and the files in that folder. This allowlist is protection against accidental artifact inclusion, not a guarantee that future source edits contain no secrets. Keep only synthetic screenshots and examples. Do not upload the whole original working folder: it contains real logs and research workspaces outside the curated tree.

From the curated folder, install dependencies with `npm ci`, run checks, and create/push a Git repository using your chosen account and repository. The working folder supplied to this session had no Git repository; no remote repository has been created or pushed.

The owner selected MIT. The license uses `TraceLens contributors`; update the copyright line if you prefer a specific owner identity.

CI runs product tests, typecheck, build and browser checks on pushes/PRs. For a hosted demo, configure GitHub Pages to use GitHub Actions in repository settings, then manually run **Publish demo (manual)**. The workflow publishes only `dist/`. Vite uses relative asset paths for repository subdirectories. No deployment has been performed by this local setup; add the resulting real URL to the README after deployment succeeds.

Before announcing the release, ask five developers to import their own logs without help. Observe whether they find a concrete issue, use a comparison to change their workflow and return with a new log. Stars alone do not validate usefulness.
