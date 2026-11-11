const { existsSync, readFileSync, writeFileSync } = require('node:fs');

const EXTENSION = '.feega';

const fileIn = (argv) => argv.find((arg) => arg.endsWith(EXTENSION) && !arg.startsWith('-')) ?? null;

const withExtension = (path) => (path.endsWith(EXTENSION) ? path : `${path}${EXTENSION}`);

function lastFile(state) {
  try {
    return JSON.parse(readFileSync(state, 'utf8')).file ?? null;
  } catch {
    return null;
  }
}

function startFile(state, fresh) {
  const last = lastFile(state);
  return last && existsSync(last) ? last : fresh;
}

const remember = (state, file) => writeFileSync(state, JSON.stringify({ file }));

module.exports = { EXTENSION, fileIn, withExtension, startFile, remember };
