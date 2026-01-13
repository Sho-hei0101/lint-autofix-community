##Lint Autofix (Community)

Comment-only ESLint / Prettier autofix suggestions for public repositories.

This GitHub Action analyzes pull requests and posts suggested fixes as a single comment.
It never pushes commits and cannot operate on private repositories.

⸻

##What this Action does
	•	Runs ESLint and/or Prettier on pull requests
	•	Posts one PR comment with a suggested diff
	•	Never commits code
	•	Designed for public repositories only

This is the free Community edition of Lint Autofix Pro.

⸻

##Quickstart

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
        uses: shichifuku-dev/lint-autofix-community@v1
        with:
          working_directory: .
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}


          
⸻

##Requirements
	•	A package.json in the working directory (defaults to repository root)
	•	ESLint and/or Prettier installed (devDependencies recommended)
	•	Node.js 20
	•	GITHUB_TOKEN with:
	•	pull-requests: write
	•	issues: write
	•	contents: read

This action runs your local ESLint/Prettier via npx --no-install.

⸻

##Important limitation (by design)

🔒 Public repositories only
	•	This Community action does not run on private repositories
	•	If a repository is made private after using this action, it will stop working
	•	Switching a repository from public → private does NOT unlock Pro features

Private repository support is exclusive to Lint Autofix Pro (GitHub App).

⸻

##Community vs Pro

| Plan | Designed for | Key difference |
|------|-------------|----------------|
| Community (Action) | OSS / public repos | Comment-only suggestions (no write access) |
| Pro (GitHub App) | Teams / private code | Write access to repos (auto-commit fixes) |


What Pro adds (not available here)
	•	Works on private repositories
	•	Automatically commits fixes to PR branches
	•	Unlimited usage
	•	Organization-wide policies
	•	Centralized reporting and audit logs

👉 Pro is delivered as a GitHub App, not an Action.

⸻

##Strict mode (optional)

By default, the workflow stays green even if ESLint/Prettier fail.

To fail the workflow on errors:

- name: Run Lint Autofix
  uses: shichifuku-dev/lint-autofix-community@v1
  with:
    strict: "true"
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}


⸻

##Known limitations (Community)
	•	Comment-only suggestions (no commits)
	•	Cannot fix syntax/parsing errors
	•	Requires ESLint and/or Prettier installed in the target package
	•	Public repositories only

⸻

##When should you upgrade?

If any of the following are true, Community is intentionally insufficient:
	•	You use private repositories
	•	You want fixes automatically committed
	•	You manage multiple repositories or an organization
	•	You need usage tracking or enforcement

➡️ Use Lint Autofix Pro.

  
