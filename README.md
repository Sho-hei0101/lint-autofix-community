# Lint Autofix (Community)

Comment-only ESLint/Prettier autofix suggestions for pull requests.
- Runs Prettier and/or ESLint in PRs
- Posts a single PR comment with a diff
- Never pushes commits

## Install

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
      - name: Install dependencies
        run: |
          npm --prefix demo install
          ln -sfn demo/node_modules node_modules
      - name: Run Lint Autofix
        uses: Sho-hei0101/lint-autofix-community/free-action@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

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

Pro adds auto-commit and org-wide policy.
