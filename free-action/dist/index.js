const fs = require('fs');
const { spawn } = require('child_process');

const core = {
  getInput(name, options = {}) {
    const key = `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
    const value = process.env[key] || '';
    if (options.required && !value) {
      throw new Error(`Input required and not supplied: ${name}`);
    }
    return value;
  },
  info(message) {
    console.log(message);
  },
  warning(message) {
    console.warn(message);
  },
  setFailed(message) {
    console.error(message);
    process.exitCode = 1;
  },
};

const exec = {
  exec(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd || process.cwd(),
        env: options.env || process.env,
        shell: options.shell || false,
      });

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          if (options.listeners && options.listeners.stdout) {
            options.listeners.stdout(data);
          }
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          if (options.listeners && options.listeners.stderr) {
            options.listeners.stderr(data);
          }
        });
      }

      child.on('error', (error) => {
        if (options.ignoreReturnCode) {
          resolve(1);
          return;
        }
        reject(error);
      });

      child.on('close', (code) => {
        resolve(code ?? 0);
      });
    });
  },
};

function readEventPayload() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return {};
  try {
    const raw = fs.readFileSync(eventPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    core.warning(`Failed to read GITHUB_EVENT_PATH: ${error.message}`);
    return {};
  }
}

function resolveRepo() {
  const repoEnv = process.env.GITHUB_REPOSITORY || '';
  const [owner, repo] = repoEnv.split('/');
  return { owner, repo };
}

async function requestGitHub({ token, method, url, body }) {
  const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
  const response = await fetch(`${apiUrl}${url}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'lint-autofix-community-action',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function createOctokit(token) {
  return {
    rest: {
      issues: {
        async listComments({ owner, repo, issue_number, per_page }) {
          const data = await requestGitHub({
            token,
            method: 'GET',
            url: `/repos/${owner}/${repo}/issues/${issue_number}/comments?per_page=${per_page}`,
          });
          return { data };
        },
        async updateComment({ owner, repo, comment_id, body }) {
          const data = await requestGitHub({
            token,
            method: 'PATCH',
            url: `/repos/${owner}/${repo}/issues/comments/${comment_id}`,
            body: { body },
          });
          return { data };
        },
        async createComment({ owner, repo, issue_number, body }) {
          const data = await requestGitHub({
            token,
            method: 'POST',
            url: `/repos/${owner}/${repo}/issues/${issue_number}/comments`,
            body: { body },
          });
          return { data };
        },
      },
    },
  };
}

const github = {
  context: {
    eventName: process.env.GITHUB_EVENT_NAME || '',
    repo: resolveRepo(),
    payload: readEventPayload(),
  },
  getOctokit(token) {
    return createOctokit(token);
  },
};

const HEADER = 'Lint Autofix (Community)';
const COMMENT_TAG = '<!-- lint-autofix-community -->';
const DIFF_LIMIT = 6000;

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true';
}

async function runCommand(command, args, options = {}) {
  let stdout = '';
  let stderr = '';
  const exitCode = await exec.exec(command, args, {
    ignoreReturnCode: true,
    listeners: {
      stdout: (data) => {
        stdout += data.toString();
      },
      stderr: (data) => {
        stderr += data.toString();
      },
    },
    ...options,
  });
  return { exitCode, stdout, stderr };
}

function looksMissingTool(output) {
  const lower = output.toLowerCase();
  return (
    lower.includes('not found') ||
    lower.includes('enoent') ||
    lower.includes('could not determine executable') ||
    lower.includes('command not found')
  );
}

async function findEslintConfig() {
  const result = await runCommand('git', ['ls-files']);
  if (result.exitCode !== 0) return null;
  const candidates = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) =>
      [
        'eslint.config.js',
        '.eslintrc',
        '.eslintrc.js',
        '.eslintrc.cjs',
        '.eslintrc.json',
        '.eslintrc.yaml',
        '.eslintrc.yml',
      ].includes(file)
    );

  if (candidates.length === 1) {
    return candidates[0];
  }
  return null;
}

function buildDiffSection(diffText) {
  if (diffText.length <= DIFF_LIMIT) {
    return diffText;
  }
  return `${diffText.slice(0, DIFF_LIMIT)}\n...diff truncated...`;
}

function buildComment({ files, diff, missingTools, errors, maxFiles, noDiff }) {
  const lines = [COMMENT_TAG, `## ${HEADER}`];

  if (missingTools.length > 0) {
    lines.push(
      '',
      `Missing tools: ${missingTools.join(', ')}`,
      'Install locally with: `npm i -D eslint prettier` (or your preferred package manager).'
    );
  }

  if (errors.length > 0) {
    lines.push('', 'Command issues:', ...errors.map((err) => `- ${err}`));
  }

  if (noDiff) {
    lines.push('', 'No fixes needed.');
    return lines.join('\n');
  }

  if (files.length > 0) {
    lines.push('', `Changed files (showing up to ${maxFiles}):`, ...files.map((file) => `- ${file}`));
  }

  lines.push('', '```diff', diff, '```');
  lines.push(
    '',
    '**Community vs Pro**',
    '- Community: comment-only suggestions, limited usage',
    '- Pro: auto-commit fixes, unlimited runs, org-wide policy'
  );

  return lines.join('\n');
}

async function findExistingComment(octokit, repo, issueNumber) {
  const comments = await octokit.rest.issues.listComments({
    ...repo,
    issue_number: issueNumber,
    per_page: 100,
  });

  return comments.data.find((comment) => comment.body && comment.body.includes(COMMENT_TAG));
}

async function upsertComment(octokit, repo, issueNumber, body) {
  const existing = await findExistingComment(octokit, repo, issueNumber);
  if (existing) {
    await octokit.rest.issues.updateComment({
      ...repo,
      comment_id: existing.id,
      body,
    });
    return;
  }

  await octokit.rest.issues.createComment({
    ...repo,
    issue_number: issueNumber,
    body,
  });
}

async function run() {
  try {
    if (github.context.eventName !== 'pull_request') {
      core.info('Skipping: only runs on pull_request events.');
      return;
    }

    const token = process.env.GITHUB_TOKEN || core.getInput('github_token');
    if (!token) {
      core.warning('GITHUB_TOKEN not available; skipping PR comment.');
      return;
    }

    const maxFiles = Number(core.getInput('max_files') || '10');
    const runEslint = parseBoolean(core.getInput('run_eslint'), true);
    const runPrettier = parseBoolean(core.getInput('run_prettier'), true);
    const strict = parseBoolean(core.getInput('strict'), false);

    const missingTools = [];
    const errors = [];

    if (runPrettier) {
      const result = await runCommand('npx', ['--no-install', 'prettier', '--write', '.']);
      if (result.exitCode !== 0) {
        if (looksMissingTool(result.stderr + result.stdout)) {
          missingTools.push('prettier');
        } else {
          errors.push('Prettier failed. Check logs.');
        }
      }
    }

    if (runEslint) {
      const eslintConfig = await findEslintConfig();
      const eslintArgs = ['--no-install', 'eslint', '--fix', '.'];
      if (eslintConfig) {
        eslintArgs.push('--config', eslintConfig);
      }
      const result = await runCommand('npx', eslintArgs);
      if (result.exitCode !== 0) {
        if (looksMissingTool(result.stderr + result.stdout)) {
          missingTools.push('eslint');
        } else {
          errors.push('ESLint failed. Check logs.');
        }
      }
    }

    const diffResult = await runCommand('git', ['diff']);
    const diffText = diffResult.stdout.trim();
    const hasDiff = diffText.length > 0;

    const diffFilesResult = await runCommand('git', ['diff', '--name-only']);
    const allFiles = diffFilesResult.stdout
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean);

    const files = allFiles.slice(0, maxFiles);

    const octokit = github.getOctokit(token);
    const repo = github.context.repo;
    const issueNumber = github.context.payload.pull_request.number;

    if (!hasDiff && missingTools.length === 0 && errors.length === 0) {
      const existing = await findExistingComment(octokit, repo, issueNumber);
      if (existing) {
        const body = buildComment({
          files: [],
          diff: '',
          missingTools: [],
          errors: [],
          maxFiles,
          noDiff: true,
        });
        await upsertComment(octokit, repo, issueNumber, body);
      }
      return;
    }

    const diffSection = hasDiff ? buildDiffSection(diffText) : '';
    const body = buildComment({
      files,
      diff: diffSection,
      missingTools,
      errors,
      maxFiles,
      noDiff: !hasDiff,
    });

    await upsertComment(octokit, repo, issueNumber, body);

    if (strict && (missingTools.length > 0 || errors.length > 0)) {
      core.setFailed('Strict mode enabled and lint commands reported issues.');
    }
  } catch (error) {
    if (parseBoolean(core.getInput('strict'), false)) {
      core.setFailed(error.message);
    } else {
      core.warning(error.message);
    }
  }
}

run();
