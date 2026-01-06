const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const srcFile = path.join(rootDir, 'src', 'index.js');
const distDir = path.join(rootDir, 'dist');
const distFile = path.join(distDir, 'index.js');

function buildWithNcc() {
  const nccCli = require.resolve('@vercel/ncc/dist/ncc/cli.js');
  execFileSync(process.execPath, [nccCli, 'build', srcFile, '-o', distDir, '--no-cache'], {
    stdio: 'inherit',
  });
}

function fallbackCopy() {
  fs.mkdirSync(distDir, { recursive: true });
  fs.copyFileSync(srcFile, distFile);
}

try {
  buildWithNcc();
} catch (error) {
  fallbackCopy();
}
