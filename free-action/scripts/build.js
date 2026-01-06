const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const srcFile = path.join(rootDir, 'src', 'index.js');
const distDir = path.join(rootDir, 'dist');

function buildWithNcc() {
  const nccCli = require.resolve('@vercel/ncc/dist/ncc/cli.js');
  execFileSync(process.execPath, [nccCli, 'build', srcFile, '-o', distDir, '--no-cache'], {
    stdio: 'inherit',
  });
}

try {
  buildWithNcc();
} catch (error) {
  console.error('Failed to build with @vercel/ncc. Run `npm install` in free-action.');
  throw error;
}
