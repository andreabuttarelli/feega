// ponytail: throwaway spike main process. --web runs the wasm engine instead of the native one.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { start, BENCH } = require('./server.cjs');

const WEB = process.argv.includes('--web');
const BENCH_RUN = process.argv.includes('--bench');
const SHOTS = process.argv.includes('--shots');
const fs = require('node:fs');
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

let canvas = null;
let samples = [];
let marks = [];
let sampler = null;

let lastGpu = null;
function gpuUtil() {
  require('node:child_process').execFile('ioreg', ['-r', '-d', '1', '-w', '0', '-c', 'IOAccelerator'], { encoding: 'utf8' }, (_e, out) => {
    const m = out?.match(/"Device Utilization %"=(\d+)/);
    lastGpu = m ? Number(m[1]) : null;
  });
  return lastGpu;
}

function sample() {
  const metrics = app.getAppMetrics();
  samples.push({ t: Date.now(), cpu: +metrics.reduce((a, m) => a + m.cpu.percentCPUUsage, 0).toFixed(1), memMB: Math.round(metrics.reduce((a, m) => a + m.memory.workingSetSize, 0) / 1024), byType: Object.fromEntries(metrics.map((m) => [m.type + ':' + m.pid, Math.round(m.memory.workingSetSize / 1024)])), gpu: gpuUtil() });
}

app.whenReady().then(async () => {
  const { port } = await start();
  const win = new BrowserWindow({ width: 1600, height: 1000, transparent: !WEB, backgroundColor: WEB ? '#f6f6f7' : '#00000000', titleBarStyle: 'hiddenInset', webPreferences: { preload: WEB ? undefined : path.join(__dirname, 'preload.cjs'), backgroundThrottling: false, sandbox: false } });
  const preloadWeb = path.join(__dirname, 'preload-web.cjs');
  if (WEB) win.webContents.session.setPreloads([preloadWeb]);

  ipcMain.handle('start', (_e, r) => {
    const { NativeCanvas } = require('./feega_native.node');
    canvas = new NativeCanvas(win.getNativeWindowHandle(), r.x, r.y, r.w, r.h, win.webContents.getZoomFactor() * require('electron').screen.getPrimaryDisplay().scaleFactor, path.join(BENCH, 'scene.json'));
    return true;
  });
  ipcMain.on('camera', (_e, x, y, z) => canvas?.setCamera(x, y, z));
  ipcMain.on('motion', (_e, on) => canvas?.setMotion(on));
  ipcMain.on('resize', (_e, r) => canvas?.resize(r.x, r.y, r.w, r.h));
  ipcMain.on('noop', () => {});
  ipcMain.on('stats', (e) => (e.returnValue = canvas ? canvas.stats() : '{"presents":[],"work":[]}'));
  ipcMain.on('mark', (_e, name, what) => {
    marks.push({ name, what, t: Date.now() });
    if (what === 'start' && !sampler) {
      samples = [];
      sampler = setInterval(sample, 500);
    }
  });
  ipcMain.handle('system', () => {
    clearInterval(sampler);
    sampler = null;
    const phases = marks.filter((m) => m.what === 'start').map((s) => {
      const end = marks.find((m) => m.name === s.name && m.what === 'end' && m.t > s.t)?.t ?? Date.now();
      const inside = samples.filter((x) => x.t >= s.t && x.t <= end);
      const avg = (k) => +(inside.reduce((a, x) => a + (x[k] ?? 0), 0) / Math.max(1, inside.length)).toFixed(1);
      return { name: s.name, cpuPct: avg('cpu'), memMB: avg('memMB'), gpuUtilPct: avg('gpu'), peakMemMB: Math.max(...inside.map((x) => x.memMB)) };
    });
    const last = samples[samples.length - 1];
    marks = [];
    return { phases, lastByProcessMB: last?.byType };
  });

  if (SHOTS) win.webContents.once('did-finish-load', () => setTimeout(() => shots(win).catch((e) => console.error(e)), WEB ? 15000 : 8000));
  win.webContents.on('console-message', (e) => console.log('[page]', e.message));
  win.loadURL(`http://127.0.0.1:${port}/?${BENCH_RUN ? 'bench=1&quit=1&' : ''}log=1&label=${WEB ? 'electron-web' : 'electron-native'}`);
});
app.on('window-all-closed', () => app.quit());

// ponytail: screenshots/video by readback (no screen-recording permission needed).
// native: canvas PNG from the addon + transparent UI from capturePage, composited by shots.py.
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function grab(win, dir, name) {
  await win.webContents.executeJavaScript('new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))');
  const ui = await win.webContents.capturePage();
  fs.writeFileSync(path.join(dir, name + '.ui.png'), ui.toPNG());
  if (!canvas) return;
  canvas.snapshot(path.join(dir, name + '.canvas.png'));
  while (canvas.snapPending()) await wait(5);
}
async function shots(win) {
  const dir = path.join(BENCH, 'electron', 'raw-' + (WEB ? 'web' : 'native'));
  fs.mkdirSync(dir, { recursive: true });
  const rect = await win.webContents.executeJavaScript('JSON.stringify(document.getElementById("stage").getBoundingClientRect())');
  fs.writeFileSync(path.join(dir, 'stage.json'), rect);
  for (const z of [0.25, 1, 4]) {
    await win.webContents.executeJavaScript(`shot(560, 330, ${z})`);
    await wait(2500);
    await grab(win, dir, 'zoom-' + z);
  }
  await win.webContents.executeJavaScript('document.getElementById("tFit").click()');
  await wait(2500);
  await grab(win, dir, 'ui');
  const N = 180;
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const zoom = 0.06 * Math.pow(30, Math.sin(t * Math.PI));
    const x = 720 + t * 9000;
    await win.webContents.executeJavaScript(`shot(${x}, ${600 + 400 * Math.sin(t * 6)}, ${zoom})`);
    await wait(60);
    await grab(win, dir, 'v' + String(i).padStart(4, '0'));
  }
  console.log('SHOTS DONE', dir);
  app.quit();
}
