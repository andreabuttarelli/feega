const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;
const RESTART = 0;
const BUTTONS = ['Restart now', 'Later'];

function check(updater) {
  updater.checkForUpdates().catch(() => {});
}

function watchUpdates({ updater, ask, every }) {
  updater.on('error', () => {});

  updater.on('update-downloaded', async ({ version }) => {
    const { response } = await ask({
      type: 'info',
      buttons: BUTTONS,
      defaultId: RESTART,
      cancelId: BUTTONS.length - 1,
      message: `feega ${version} is ready`,
      detail: 'Restart to update. Your work is saved.'
    });
    if (response !== RESTART) {
      return;
    }
    updater.quitAndInstall();
  });

  check(updater);
  every(() => check(updater), CHECK_EVERY_MS);
}

module.exports = { watchUpdates, CHECK_EVERY_MS, RESTART };
