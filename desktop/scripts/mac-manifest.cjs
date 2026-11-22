const { createHash } = require('node:crypto');
const { readdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const BASE_URL = 'https://github.com/andreabuttarelli/feega/releases/download/desktop-latest/';
const FRAGMENT = /^latest-mac-(arm64|x64)\.json$/;
const ZIP = /^Feega-mac-(arm64|x64)\.zip$/;
const [mode, dir] = process.argv.slice(2);

const fragments = () => {
  const version = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')).version;
  for (const name of readdirSync(dir).filter((file) => ZIP.test(file))) {
    const arch = ZIP.exec(name)[1];
    const sha512 = createHash('sha512').update(readFileSync(join(dir, name))).digest('base64');
    writeFileSync(join(dir, `latest-mac-${arch}.json`), JSON.stringify({ version, arch, url: `${BASE_URL}${name}`, sha512 }));
  }
};

const merge = () => {
  const parts = readdirSync(dir).filter((file) => FRAGMENT.test(file)).map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')));
  const version = parts[0].version;
  const files = Object.fromEntries(parts.filter((part) => part.version === version).map((part) => [part.arch, { url: part.url, sha512: part.sha512 }]));
  writeFileSync(join(dir, 'latest-mac.json'), JSON.stringify({ version, files }, null, 2));
};

(mode === 'merge' ? merge : fragments)();
