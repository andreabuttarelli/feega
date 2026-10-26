const MAC = 'darwin';

function frameless(platform) {
  return platform === MAC ? { titleBarStyle: 'hidden' } : { frame: false };
}

module.exports = { frameless };
