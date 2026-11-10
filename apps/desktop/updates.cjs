const RELEASES_URL = 'https://api.github.com/repos/andreabuttarelli/feega/releases?per_page=50';
const TAG_PREFIX = 'desktop-v';
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;
const DOWNLOAD = 0;
const BUTTONS = ['Download', 'Later'];

const parts = (version) => version.split('.').map(Number);

function newer(a, b) {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0);
    if (diff !== 0) {
      return diff > 0;
    }
  }
  return false;
}

function latestRelease(releases) {
  let best = null;
  for (const release of releases) {
    if (release.draft || release.prerelease || !release.tag_name.startsWith(TAG_PREFIX)) {
      continue;
    }
    const version = release.tag_name.slice(TAG_PREFIX.length);
    if (!best || newer(version, best.version)) {
      best = { version, url: release.html_url };
    }
  }
  return best;
}

function watchUpdates({ fetch, current, ask, open, every }) {
  const offered = new Set();

  async function check() {
    const response = await fetch(RELEASES_URL).catch(() => null);
    if (!response?.ok) {
      return;
    }
    const release = latestRelease(await response.json());
    if (!release || !newer(release.version, current) || offered.has(release.version)) {
      return;
    }
    offered.add(release.version);
    const { response: choice } = await ask({
      type: 'info',
      buttons: BUTTONS,
      defaultId: DOWNLOAD,
      cancelId: BUTTONS.length - 1,
      message: `feega ${release.version} is available`,
      detail: `You have ${current}. Download the new version and drag it to Applications to replace this one. Your .feega files stay where they are.`
    });
    if (choice === DOWNLOAD) {
      open(release.url);
    }
  }

  check();
  every(check, CHECK_EVERY_MS);
}

module.exports = { watchUpdates, latestRelease, newer, CHECK_EVERY_MS, DOWNLOAD };
