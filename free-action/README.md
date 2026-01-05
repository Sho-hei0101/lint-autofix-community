# Lint Autofix (Community)

## Example workflow
```yaml
name: Lint Autofix (Community)
on:
  pull_request:
permissions:
  contents: read
  pull-requests: write
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
```

## Inputs
| Name | Default | Description |
| --- | --- | --- |
| max_files | "10" | Maximum number of files to list in the PR comment. |
| run_eslint | "true" | Run ESLint --fix. |
| run_prettier | "true" | Run Prettier --write. |
| strict | "false" | Fail the action on command errors. |

## Community vs Pro
- Community: comment-only suggestions, limited usage
- Pro: auto-commit fixes, unlimited runs, org-wide policy

Tag and pin releases with `@v1` for stability.
