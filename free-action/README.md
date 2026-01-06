# Lint Autofix (Community)

## Example workflow
```yaml
name: Lint Autofix (Community)
on:
  pull_request:
permissions:
  contents: read
  pull-requests: write
  issues: write
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: owner/repo/free-action@v1
        with:
          max_files: "10"
          run_prettier: "true"
          run_eslint: "true"
          strict: "false"
          working_directory: "."
```

## Inputs
| Name | Default | Description |
| --- | --- | --- |
| max_files | "10" | Maximum number of files to list in the PR comment. |
| run_eslint | "true" | Whether to run ESLint --fix. |
| run_prettier | "true" | Whether to run Prettier --write. |
| strict | "false" | Fail the action on command errors. |
| working_directory | "." | Path to the working directory that contains the package.json. |

## Monorepo usage
Point the action at the package you want to lint:

```yaml
      - uses: owner/repo/free-action@v1
        with:
          working_directory: "packages/app"
```

## Troubleshooting

### Syntax/parsing errors
Syntax or parsing errors cannot be autofixed. Fix syntax errors first, then rerun
the action.

### Missing package-lock.json
The action uses `npm ci` when `package-lock.json` is present. If it is missing,
it falls back to `npm install --no-audit --no-fund`. Commit a lockfile for
faster, repeatable installs.

### ESLint v9 missing eslint.config.*
If no `eslint.config.js`/`mjs`/`cjs` is present in `working_directory`, ESLint is
skipped (or fails the action in `strict: "true"`). Add a flat config file to
enable ESLint fixes.

### Prettier not installed
If Prettier is not available in dependencies, the action will skip it and note
how to install it in the PR comment.

### Config files appear in the diff
Config files like `eslint.config.js` can appear in the suggested diff because
formatters/linters run to compute suggestions.

## Known limitations (Community)
- Comment-only suggestions (no commits)
- Cannot fix syntax errors
- Requires ESLint and/or Prettier installed in the target package

## Community vs Pro
- Community: comment-only suggestions, limited usage
- Pro: auto-commit fixes, unlimited runs, org-wide policy

Tag and pin releases with `@v1` for stability.
