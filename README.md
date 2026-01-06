# Lint Autofix (Community)

Comment-only ESLint/Prettier autofix suggestions for pull requests.
- Runs Prettier and/or ESLint in PRs
- Posts a single PR comment with a diff
- Never pushes commits

## Quickstart

```yaml
name: Lint Autofix (Community)
on:
  pull_request:

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  lint-autofix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - name: Run Lint Autofix
        uses: Sho-hei0101/lint-autofix-community/free-action@v1
        with:
          working_directory: .
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Requirements
- A `package.json` in the working directory (defaults to the repo root).
- ESLint and/or Prettier installed in that package (devDependencies recommended).
- Node.js 20 (use `actions/setup-node`).
- `GITHUB_TOKEN` with `pull-requests: write` and `issues: write`.

This action runs your project’s local `eslint`/`prettier` via `npx --no-install`.
If the tools are missing, it will post a comment explaining what is needed.
It uses `npm ci` when a `package-lock.json` is present, otherwise it falls back to
`npm install --no-audit --no-fund`. Committing a lockfile is recommended for
repeatable installs.

Note: config files like `eslint.config.js` can appear in the suggested diff
because formatters/linters run to compute suggestions.

## Strict mode

By default (`strict: "false"`), the workflow stays green even if ESLint or
Prettier fail. To fail the workflow on command errors, set:

```yaml
      - name: Run Lint Autofix
        uses: Sho-hei0101/lint-autofix-community/free-action@v1
        with:
          strict: "true"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Troubleshooting

### Syntax/parsing errors
Syntax or parsing errors cannot be autofixed. Fix syntax errors first, then rerun
the action.

### Missing package-lock.json
If you do not commit a `package-lock.json`, the action will fall back to
`npm install --no-audit --no-fund`. For faster, repeatable installs, commit a
lockfile.

### ESLint v9 requires eslint.config.*
If you are on ESLint v9 and do not have `eslint.config.js`/`mjs`/`cjs` in the
working directory, ESLint will be skipped (or fail in `strict: "true"`). Add a
flat config file to enable ESLint fixes.

### Permissions errors
Ensure your workflow has:
- `contents: read`
- `pull-requests: write`
- `issues: write`

## Permissions

This action comments on pull requests, so it needs:
- `pull-requests: write`
- `issues: write`
- `contents: read`

## Version pinning

Use `@v1` for the latest v1 release. For stricter pinning, you can use a full tag
like `@v1.0.0`.

## Development

```bash
cd free-action
npm install
npm run build
# Commit free-action/dist after rebuilding
```

## Release

1. Ensure `free-action/dist` is rebuilt and committed.
2. Create/refresh the tag:
   - Update the major tag to point at the release commit: `git tag -f v1`
   - Optionally add a full version tag: `git tag v1.0.0`
3. Push tags: `git push origin v1 --force` and `git push origin v1.0.0`

## Community vs Pro

| Tier | Features |
| --- | --- |
| Community | Comment-only suggestions, limited usage. |
| Pro | Auto-commit fixes, unlimited runs, org-wide policy, reporting. |

## Known limitations (Community)

- Comment-only suggestions (no commits)
- Cannot fix syntax errors
- Requires ESLint and/or Prettier installed in the target package
