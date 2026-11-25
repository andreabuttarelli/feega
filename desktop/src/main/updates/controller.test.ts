import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateState, type UpdateInfo } from '../types';

const io = vi.hoisted(() => ({ fetchText: vi.fn(), downloadTo: vi.fn() }));

vi.mock('./darwin-io', () => ({ fetchText: io.fetchText, downloadTo: io.downloadTo, extractZip: vi.fn(), bundleIn: vi.fn(), runPlan: vi.fn(), signatureIdentifier: vi.fn() }));

import { CheckMode, updateController, type UpdateHost } from './controller';

const HOUR_MS = 60 * 60 * 1000;
const CHECK_EVERY_HOURS = 6;
const FIRST_CHECK_MS = 10_000;

const manifest = (version: string) => JSON.stringify({ version, files: { arm64: { url: 'https://github.com/a.zip', sha512: 'abc' }, x64: { url: 'https://github.com/b.zip', sha512: 'def' } } });

const hostWith = (enabled: boolean, seen: UpdateInfo[]): UpdateHost => ({
  platform: 'darwin',
  arch: 'arm64',
  version: '0.1.0',
  userData: '/tmp/feega-controller-test',
  execPath: '/Applications/Feega.app/Contents/MacOS/Feega',
  pid: 1,
  isPackaged: true,
  env: {},
  enabled: () => enabled,
  changed: (info) => seen.push(info),
  quit: () => undefined
});

beforeEach(() => {
  vi.useFakeTimers();
  io.fetchText.mockReset();
  io.downloadTo.mockReset();
  io.fetchText.mockResolvedValue(manifest('0.2.0'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('background checks', () => {
  it('keep running every six hours through a long session', async () => {
    const controller = updateController(hostWith(true, []));
    io.downloadTo.mockRejectedValue(new Error('offline'));

    controller.start();
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_MS);
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_HOURS * HOUR_MS * 2);

    expect(io.fetchText).toHaveBeenCalledTimes(3);
  });

  it('only report a newer version when automatic updates are off', async () => {
    const seen: UpdateInfo[] = [];
    const controller = updateController(hostWith(false, seen));

    controller.start();
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_MS);

    expect(controller.info()).toEqual({ state: UpdateState.Available, version: '0.2.0', message: '' });
    expect(io.downloadTo).not.toHaveBeenCalled();
  });

  it('do not flash a checking state over a visible notice', async () => {
    const seen: UpdateInfo[] = [];
    const controller = updateController(hostWith(false, seen));

    controller.start();
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_MS + CHECK_EVERY_HOURS * HOUR_MS);

    expect(seen.map((info) => info.state)).toEqual([UpdateState.Available, UpdateState.Available]);
  });
});

describe('install', () => {
  it('starts the download of an available update', async () => {
    const controller = updateController(hostWith(false, []));
    io.downloadTo.mockRejectedValue(new Error('offline'));

    await controller.check(CheckMode.Detect);
    await controller.install();

    expect(io.downloadTo).toHaveBeenCalledTimes(1);
  });
});
