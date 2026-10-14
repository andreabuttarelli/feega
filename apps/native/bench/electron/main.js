const { app, BrowserWindow } = require('electron');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1440, height: 900, useContentSize: true, webPreferences: { backgroundThrottling: false } });
  await win.loadURL('http://localhost:5191/changelog');
  await win.webContents.executeJavaScript(`window.__benchLabel='electron-${process.versions.electron}';var s=document.createElement('script');s.src='http://localhost:5199/bench.js';document.head.appendChild(s);`);
  const start = Date.now();
  const poll = setInterval(async () => {
    const title = win.webContents.getTitle();
    if (title === 'BENCH_DONE' || Date.now() - start > 90000) {
      clearInterval(poll);
      const metrics = app.getAppMetrics().reduce((sum, p) => sum + p.memory.workingSetSize, 0);
      console.log('ELECTRON_RSS_MB', Math.round(metrics / 1024));
      setTimeout(() => app.quit(), 500);
    }
  }, 500);
});
