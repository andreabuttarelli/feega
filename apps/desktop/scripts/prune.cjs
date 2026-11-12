const { readdirSync, rmSync, rmdirSync, statSync } = require('node:fs');
const { join, relative } = require('node:path');

const NEVER_LOADED = [/^build\/.*\.map$/, /^build\/.*\.(gz|br)$/];
const FOUND_BY_PATH = new Set(['node_modules/ffmpeg-static/ffmpeg']);
const MODULES = /^node_modules\//;
const ENTRIES = /^(build\/(?!client\/).*\.js|scripts\/.*\.mjs|src\/.*\.js)$/;

const unshipped = (files, traced) =>
  files.filter((file) => NEVER_LOADED.some((pattern) => pattern.test(file)) || (MODULES.test(file) && !traced.has(file) && !FOUND_BY_PATH.has(file)));

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });

function dropEmpty(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      dropEmpty(join(dir, entry.name));
    }
  }
  if (readdirSync(dir).length === 0) {
    rmdirSync(dir);
  }
}

async function prune(root) {
  const { nodeFileTrace } = await import('@vercel/nft');
  const files = walk(root).map((path) => relative(root, path));
  const entries = files.filter((file) => ENTRIES.test(file)).map((file) => join(root, file));
  const { fileList } = await nodeFileTrace(entries, { base: root, processCwd: root });

  const gone = unshipped(files, new Set(fileList));
  const bytes = gone.reduce((sum, file) => sum + statSync(join(root, file)).size, 0);
  for (const file of gone) {
    rmSync(join(root, file));
  }
  dropEmpty(join(root, 'node_modules'));
  console.log(`prune: removed ${gone.length} files, ${(bytes / 1e6).toFixed(0)} MB`);
}

module.exports = { unshipped, prune };
