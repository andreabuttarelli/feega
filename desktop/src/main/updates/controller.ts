import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { UpdateState, type UpdateInfo } from '../types';
import { bundleIn, downloadTo, extractZip, fetchText, runPlan, signatureIdentifier } from './darwin-io';
import { matchesHash, sha512OfFile } from './hash';
import { fileFor, parseManifest, urlAllowed } from './manifest';
import { Strategy, updaterRow } from './strategy';
import { darwinSwapPlan } from './swap-plan';
import { isNewer } from './version';

export const MANIFEST_URL = 'https://github.com/andreabuttarelli/feega/releases/download/desktop-latest/latest-mac.json';
export const FEED_URL = 'https://github.com/andreabuttarelli/feega/releases/download/desktop-latest/';
export const BUNDLE_IDENTIFIER = 'app.feega.desktop';
export const OVERRIDE_ENV = 'FEEGA_UPDATE_MANIFEST_URL';

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 10_000;
const BUNDLE_DEPTH = 3;
const LOOPBACK = new Set(['127.0.0.1', 'localhost']);

export type UpdateHost = {
  platform: string;
  arch: string;
  version: string;
  userData: string;
  execPath: string;
  pid: number;
  isPackaged: boolean;
  env: NodeJS.ProcessEnv;
  enabled: () => boolean;
  changed: (info: UpdateInfo) => void;
  quit: () => void;
};

type Ready = { version: string; bundle: string };

export enum CheckMode {
  Manual = 'manual',
  Background = 'background',
  Detect = 'detect'
}

const loopbackOverride = (raw: string | undefined): string | null => {
  if (!raw || !urlAllowed(raw)) {
    return null;
  }
  return LOOPBACK.has(new URL(raw).hostname) ? raw : null;
};

const idle = (): UpdateInfo => ({ state: UpdateState.Idle, version: '', message: '' });

export function updateController(host: UpdateHost) {
  const strategy = updaterRow(host.platform).strategy;
  let info = idle();
  let ready: Ready | null = null;
  let busy = false;
  let wired = false;

  const set = (next: Partial<UpdateInfo> & { state: UpdateState }) => {
    info = { ...idle(), ...next };
    host.changed(info);
  };

  const fail = (error: unknown) => set({ state: UpdateState.Failed, message: error instanceof Error ? error.message : 'update failed' });

  const currentBundle = () => {
    let path = host.execPath;
    for (let i = 0; i < BUNDLE_DEPTH; i++) {
      path = dirname(path);
    }
    return path;
  };

  const checkDarwin = async (mode: CheckMode) => {
    const url = loopbackOverride(host.env[OVERRIDE_ENV]) ?? MANIFEST_URL;
    const manifest = parseManifest(JSON.parse(await fetchText(url)));
    const file = manifest ? fileFor(manifest, host.arch) : null;
    if (!manifest || !file || !isNewer(host.version, manifest.version)) {
      set({ state: mode === CheckMode.Manual ? UpdateState.UpToDate : UpdateState.Idle });
      return;
    }
    if (mode === CheckMode.Detect) {
      set({ state: UpdateState.Available, version: manifest.version });
      return;
    }
    set({ state: UpdateState.Downloading, version: manifest.version, message: `downloading ${manifest.version}` });
    const work = join(host.userData, 'updates', manifest.version);
    rmSync(work, { recursive: true, force: true });
    const zip = join(work, 'update.zip');
    await downloadTo(file.url, zip);
    if (!matchesHash(await sha512OfFile(zip), file.sha512)) {
      rmSync(work, { recursive: true, force: true });
      throw new Error('the download does not match its checksum');
    }
    const out = join(work, 'out');
    await extractZip(zip, out);
    const bundle = bundleIn(out);
    if (!bundle) {
      throw new Error('the download has no app inside');
    }
    if ((await signatureIdentifier(bundle)) !== BUNDLE_IDENTIFIER) {
      throw new Error('the downloaded app is not Feega');
    }
    ready = { version: manifest.version, bundle };
    set({ state: UpdateState.Ready, version: manifest.version, message: `restart to update to ${manifest.version}` });
  };

  const wireElectronUpdater = () => {
    const { autoUpdater } = require('electron-updater');
    if (!wired) {
      wired = true;
      autoUpdater.setFeedURL({ provider: 'generic', url: FEED_URL });
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.on('update-available', (found: { version: string }) => {
        if (!autoUpdater.autoDownload) {
          set({ state: UpdateState.Available, version: found.version });
          return;
        }
        set({ state: UpdateState.Downloading, version: found.version, message: `downloading ${found.version}` });
      });
      autoUpdater.on('update-not-available', () => set({ state: UpdateState.UpToDate }));
      autoUpdater.on('update-downloaded', (found: { version: string }) => set({ state: UpdateState.Ready, version: found.version, message: `restart to update to ${found.version}` }));
      autoUpdater.on('error', fail);
    }
    return autoUpdater;
  };

  const check = async (mode: CheckMode) => {
    if (busy || ready || strategy === Strategy.None || !host.isPackaged) {
      if (mode === CheckMode.Manual && !host.isPackaged) {
        set({ state: UpdateState.UpToDate, message: 'development build' });
      }
      return;
    }
    busy = true;
    if (mode === CheckMode.Manual) {
      set({ state: UpdateState.Checking, message: 'checking' });
    }
    try {
      if (strategy === Strategy.DarwinSwap) {
        await checkDarwin(mode);
      } else {
        const updater = wireElectronUpdater();
        updater.autoDownload = mode !== CheckMode.Detect;
        await updater.checkForUpdates();
      }
    } catch (error) {
      fail(error);
    } finally {
      busy = false;
    }
  };

  const swap = async (relaunch: boolean) => {
    if (!ready) {
      return;
    }
    const target = ready;
    mkdirSync(join(host.userData, 'updates', 'old'), { recursive: true });
    const plan = darwinSwapPlan({ current: currentBundle(), fresh: target.bundle, backup: join(host.userData, 'updates', 'old', 'Feega.app'), relaunch, pid: host.pid });
    try {
      await runPlan(plan);
      ready = null;
      if (relaunch) {
        host.quit();
      }
    } catch (error) {
      fail(error);
    }
  };

  return {
    info: () => info,
    check,
    install: async () => {
      if (info.state === UpdateState.Available) {
        await check(CheckMode.Background);
        return;
      }
      if (strategy === Strategy.DarwinSwap) {
        await swap(true);
        return;
      }
      wireElectronUpdater().quitAndInstall();
    },
    applyOnQuit: async () => {
      if (strategy === Strategy.DarwinSwap) {
        await swap(false);
      }
    },
    start: () => {
      const auto = () => void check(host.enabled() ? CheckMode.Background : CheckMode.Detect);
      setTimeout(auto, FIRST_CHECK_DELAY_MS).unref();
      setInterval(auto, CHECK_EVERY_MS).unref();
    }
  };
}
