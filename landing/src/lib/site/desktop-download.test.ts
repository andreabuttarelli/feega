import { describe, expect, it } from 'vitest';
import { detectOs, downloadFor, Os } from './desktop-download';

const UA = {
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
};

describe('detectOs', () => {
  it('reads the three desktop systems', () => {
    expect(detectOs(UA.mac)).toBe(Os.Mac);
    expect(detectOs(UA.windows)).toBe(Os.Windows);
    expect(detectOs(UA.linux)).toBe(Os.Linux);
  });

  it('treats phones and an empty agent as unknown', () => {
    expect(detectOs(UA.android)).toBe(Os.Unknown);
    expect(detectOs(UA.iphone)).toBe(Os.Unknown);
    expect(detectOs('')).toBe(Os.Unknown);
  });
});

describe('downloadFor', () => {
  it('links straight to the asset on the desktop-latest release', () => {
    expect(downloadFor(Os.Mac).href).toBe('https://github.com/andreabuttarelli/feega/releases/download/desktop-latest/Feega-mac-arm64.dmg');
    expect(downloadFor(Os.Windows).href).toMatch(/\/desktop-latest\/Feega-win-x64\.exe$/);
    expect(downloadFor(Os.Linux).href).toMatch(/\/desktop-latest\/Feega-linux-x64\.AppImage$/);
  });

  it('offers a free download on every system', () => {
    expect(downloadFor(Os.Mac).label).toBe('download for free');
    expect(downloadFor(Os.Windows).label).toBe('download for free');
    expect(downloadFor(Os.Linux).label).toBe('download for free');
  });

  it('sends an unknown system to the download page', () => {
    expect(downloadFor(Os.Unknown)).toMatchObject({ label: 'download for free', href: '/download' });
  });
});
