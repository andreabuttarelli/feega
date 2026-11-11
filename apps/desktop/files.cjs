const { readFileSync, writeFileSync } = require('node:fs');

const EXTENSION = '.feega';

const fileIn = (argv) => argv.find((arg) => arg.endsWith(EXTENSION) && !arg.startsWith('-')) ?? null;

const withExtension = (path) => (path.endsWith(EXTENSION) ? path : `${path}${EXTENSION}`);

function savedBounds(state) {
  try {
    return JSON.parse(readFileSync(state, 'utf8')).bounds ?? null;
  } catch {
    return null;
  }
}

const saveBounds = (state, bounds) => writeFileSync(state, JSON.stringify({ bounds }));

module.exports = { EXTENSION, fileIn, withExtension, savedBounds, saveBounds };
