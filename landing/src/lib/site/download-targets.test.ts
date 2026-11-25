import { describe, expect, it } from 'vitest';
import { DESKTOP_DMGS, DESKTOP_LINUX, DESKTOP_WINDOWS } from './links';
import { DOWNLOAD_PAGE } from './download';
import { downloadFor, Os } from './desktop-download';

const TARGETS = ['dmg_apple_silicon', 'dmg_intel', 'windows_exe', 'linux_appimage'];

describe('desktop download targets', () => {
  it('names every desktop file with one analytics target', () => {
    expect([...DESKTOP_DMGS.map((d) => d.target), DESKTOP_WINDOWS.target, DESKTOP_LINUX.target]).toEqual(TARGETS);
  });

  it('reports the same target from the page and the hero', () => {
    const { mac, windows, linux } = DOWNLOAD_PAGE.desktop;
    const page = [mac, windows, linux].flatMap((s) => s.files.map((f) => f.target));
    expect(page).toEqual(TARGETS);
    expect([Os.Mac, Os.Windows, Os.Linux].map((os) => downloadFor(os).target)).toEqual(['dmg_apple_silicon', 'windows_exe', 'linux_appimage']);
  });
});
