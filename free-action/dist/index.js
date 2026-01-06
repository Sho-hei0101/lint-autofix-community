/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 317:
/***/ ((module) => {

"use strict";
module.exports = require("child_process");

/***/ }),

/***/ 896:
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ 928:
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
const fs = __nccwpck_require__(896);
const path = __nccwpck_require__(928);
const { spawn } = __nccwpck_require__(317);

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
const OUTPUT_LIMIT = 800;
const ESLINT_CONFIGS = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs'];

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

function resolveWorkingDirectory() {
  const input = core.getInput('working_directory') || '.';
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  return path.resolve(workspace, input);
}

function formatWorkingDirectory(workingDirectory) {
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const relative = path.relative(workspace, workingDirectory);
  return relative === '' ? '.' : relative;
}

function readPackageJson(workingDirectory) {
  const packagePath = path.join(workingDirectory, 'package.json');
  if (!fs.existsSync(packagePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch (error) {
    core.warning(`Failed to parse package.json in ${workingDirectory}: ${error.message}`);
    return null;
  }
}

function hasDependency(pkg, name) {
  if (!pkg) return false;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return Boolean(deps && deps[name]);
}

function findEslintConfig(workingDirectory) {
  return ESLINT_CONFIGS.find((config) =>
    fs.existsSync(path.join(workingDirectory, config))
  );
}

async function isNpxToolAvailable(tool, workingDirectory) {
  const result = await runCommand('npx', ['--no-install', tool, '--version'], {
    cwd: workingDirectory,
  });
  return result.exitCode === 0;
}

function buildDiffSection(diffText) {
  if (diffText.length <= DIFF_LIMIT) {
    return diffText;
  }
  return `${diffText.slice(0, DIFF_LIMIT)}\n...diff truncated...`;
}

function truncateOutput(text) {
  if (!text) return '';
  if (text.length <= OUTPUT_LIMIT) {
    return text.trim();
  }
  return `${text.slice(0, OUTPUT_LIMIT)}\n...output truncated...`.trim();
}

function logCommandOutput(name, result) {
  if (!result || result.exitCode === 0) return;
  const combined = truncateOutput(`${result.stdout}\n${result.stderr}`.trim());
  if (combined) {
    core.info(`${name} output:\n${combined}`);
  }
}

function formatCommandSummary(result) {
  if (result.skipped) {
    return [`- ${result.name}: skipped${result.reason ? ` (${result.reason})` : ''}`];
  }

  if (result.exitCode === 0) {
    return [`- ${result.name}: succeeded${result.note ? ` (${result.note})` : ''}`];
  }

  if (result.missingTool) {
    return [`- ${result.name}: failed (missing tool)`];
  }

  const lines = [`- ${result.name}: failed (exit ${result.exitCode})`];
  const combined = truncateOutput(`${result.stdout}\n${result.stderr}`.trim());
  if (combined) {
    combined.split('\n').forEach((line) => {
      lines.push(`  - ${line}`);
    });
  }
  return lines;
}

function buildComment({
  files,
  diff,
  commandResults,
  maxFiles,
  whatHappened,
  howToFix,
  workingDirectory,
}) {
  const lines = [COMMENT_TAG, `## ${HEADER}`];

  lines.push('', `**Working directory:** \`${workingDirectory}\``);

  lines.push('', '### What happened');
  if (whatHappened.length > 0) {
    lines.push(...whatHappened);
  } else {
    commandResults.forEach((result) => {
      lines.push(...formatCommandSummary(result));
    });
  }

  lines.push('', '### How to fix');
  if (howToFix.length > 0) {
    lines.push(...howToFix.map((item) => `- ${item}`));
  } else {
    lines.push('- No action required.');
  }

  lines.push('', `Changed files (showing up to ${maxFiles}):`);
  if (files.length > 0) {
    lines.push(...files.map((file) => `- ${file}`));
  } else {
    lines.push('- (none)');
  }

  lines.push('', '```diff', diff || 'No changes produced.', '```');
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

  return comments.data.find((comment) =>
    comment.body && comment.body.includes(COMMENT_TAG)
  );
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
    const workingDirectory = resolveWorkingDirectory();
    const workingDirectoryLabel = formatWorkingDirectory(workingDirectory);
    const repoRoot = process.env.GITHUB_WORKSPACE || process.cwd();

    const commandResults = [];
    const whatHappened = [];
    const howToFixSet = new Set();
    const failures = [];
    let installFailed = false;

    const packageJson = readPackageJson(workingDirectory);
    const hasPackageJson = Boolean(packageJson);
    if (!hasPackageJson) {
      const message = `No package.json found in ${workingDirectoryLabel}.`;
      whatHappened.push(`- ${message} Skipping npm install and lint.`);
      howToFixSet.add(
        'Set `working_directory` to the folder that contains your package.json.'
      );
      commandResults.push({
        name: 'npm install',
        skipped: true,
        reason: 'package.json missing',
      });
      if (strict) {
        failures.push(message);
      }
    } else {
      const lockfilePath = path.join(workingDirectory, 'package-lock.json');
      const hasLockfile = fs.existsSync(lockfilePath);
      const npmArgs = hasLockfile
        ? ['ci']
        : ['install', '--no-audit', '--no-fund'];
      const npmLabel = hasLockfile ? 'npm ci' : 'npm install';
      const note = hasLockfile
        ? 'using package-lock.json'
        : 'no package-lock.json found; used npm install --no-audit --no-fund';
      const result = await runCommand('npm', npmArgs, { cwd: workingDirectory });
      const missingTool = result.exitCode !== 0 && looksMissingTool(result.stderr + result.stdout);
      logCommandOutput(npmLabel, result);
      commandResults.push({ name: npmLabel, ...result, missingTool, note });
      whatHappened.push(...formatCommandSummary(commandResults[commandResults.length - 1]));
      if (!hasLockfile) {
        howToFixSet.add('Commit a package-lock.json to enable faster, repeatable npm ci installs.');
      }
      if (result.exitCode !== 0) {
        installFailed = true;
        failures.push('npm install failed');
        howToFixSet.add('Fix the npm install errors shown in the logs for your project.');
      }
    }

    if (runPrettier) {
      if (!hasPackageJson) {
        commandResults.push({
          name: 'prettier',
          skipped: true,
          reason: 'package.json missing',
        });
        whatHappened.push('- prettier: skipped (package.json missing)');
      } else if (installFailed) {
        commandResults.push({
          name: 'prettier',
          skipped: true,
          reason: 'npm install failed',
        });
        whatHappened.push('- prettier: skipped (npm install failed)');
      } else if (
        hasDependency(packageJson, 'prettier') ||
        (await isNpxToolAvailable('prettier', workingDirectory))
      ) {
        const result = await runCommand('npx', ['--no-install', 'prettier', '--write', '.'], {
          cwd: workingDirectory,
        });
        const missingTool =
          result.exitCode !== 0 && looksMissingTool(result.stderr + result.stdout);
        logCommandOutput('prettier', result);
        if (missingTool) {
          howToFixSet.add('Install Prettier (e.g., `npm i -D prettier`) before running this action.');
        }
        commandResults.push({ name: 'prettier', ...result, missingTool });
        whatHappened.push(...formatCommandSummary(commandResults[commandResults.length - 1]));
        if (result.exitCode !== 0) {
          failures.push('prettier failed');
        }
      } else {
        commandResults.push({
          name: 'prettier',
          skipped: true,
          reason: 'prettier not installed',
        });
        whatHappened.push('- prettier: skipped (prettier not installed)');
        howToFixSet.add('Add Prettier to devDependencies to enable formatting fixes.');
      }
    } else {
      commandResults.push({ name: 'prettier', skipped: true, reason: 'disabled by input' });
      whatHappened.push('- prettier: skipped (disabled by input)');
    }

    if (runEslint) {
      if (!hasPackageJson) {
        commandResults.push({
          name: 'eslint',
          skipped: true,
          reason: 'package.json missing',
        });
        whatHappened.push('- eslint: skipped (package.json missing)');
      } else if (installFailed) {
        commandResults.push({
          name: 'eslint',
          skipped: true,
          reason: 'npm install failed',
        });
        whatHappened.push('- eslint: skipped (npm install failed)');
      } else {
        const eslintConfig = findEslintConfig(workingDirectory);
        if (!eslintConfig) {
          const message = `eslint.config.(js|mjs|cjs) not found in ${workingDirectoryLabel}.`;
          commandResults.push({
            name: 'eslint',
            skipped: true,
            reason: 'eslint config missing',
          });
          whatHappened.push(`- eslint: skipped (${message})`);
          howToFixSet.add(
            'Add an eslint.config.js/mjs/cjs file (ESLint v9 flat config) in your working directory.'
          );
          if (strict) {
            failures.push(message);
          }
        } else {
          const result = await runCommand('npx', ['--no-install', 'eslint', '--fix', '.'], {
            cwd: workingDirectory,
          });
          const missingTool =
            result.exitCode !== 0 && looksMissingTool(result.stderr + result.stdout);
          logCommandOutput('eslint', result);
          if (missingTool) {
            howToFixSet.add('Install ESLint (e.g., `npm i -D eslint`) before running this action.');
          }
          commandResults.push({ name: 'eslint', ...result, missingTool });
          whatHappened.push(...formatCommandSummary(commandResults[commandResults.length - 1]));
          if (result.exitCode !== 0) {
            failures.push('eslint failed');
          }
        }
      }
    } else {
      commandResults.push({ name: 'eslint', skipped: true, reason: 'disabled by input' });
      whatHappened.push('- eslint: skipped (disabled by input)');
    }

    const diffResult = await runCommand('git', ['diff'], { cwd: repoRoot });
    const diffText = diffResult.stdout.trim();
    const hasDiff = diffText.length > 0;

    const diffFilesResult = await runCommand('git', ['diff', '--name-only'], {
      cwd: repoRoot,
    });
    const allFiles = diffFilesResult.stdout
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean);

    const files = allFiles.slice(0, maxFiles);

    const octokit = github.getOctokit(token);
    const repo = github.context.repo;
    const issueNumber = github.context.payload.pull_request.number;

    const diffSection = hasDiff ? buildDiffSection(diffText) : '';
    const body = buildComment({
      files,
      diff: diffSection,
      commandResults,
      maxFiles,
      whatHappened,
      howToFix: Array.from(howToFixSet),
      workingDirectory: workingDirectoryLabel,
    });

    await upsertComment(octokit, repo, issueNumber, body);

    if (strict && failures.length > 0) {
      core.setFailed(`Strict mode enabled: ${failures.join('; ')}`);
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

module.exports = __webpack_exports__;
/******/ })()
;