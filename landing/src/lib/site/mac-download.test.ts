import { describe, expect, it } from 'vitest';
import { INSTALL_GUIDE_URL, isMobile, pickMacDownload, wantedArch, type ReleaseSummary } from './mac-download';

const release = (tag: string, names: string[], draft = false): ReleaseSummary => ({
  tag_name: tag,
  draft,
  prerelease: false,
  assets: names.map((name) => ({ name, browser_download_url: `https://dl/${tag}/${name}` }))
});

const CLI = release('cli-v1.0.0', ['feega-linux.tar.gz']);
const APP = release('app-v0.2.0', ['feega-0.2.0-mac-arm64.dmg', 'feega-0.2.0-mac-x64.dmg', 'SHA256SUMS.txt']);

describe('pickMacDownload', () => {
  it('ignores non app releases and returns the arm64 dmg by default', () => {
    expect(pickMacDownload([CLI, APP], { arch: 'arm64' })).toBe('https://dl/app-v0.2.0/feega-0.2.0-mac-arm64.dmg');
  });

  it('returns the x64 dmg when asked', () => {
    expect(pickMacDownload([APP], { arch: 'x64' })).toBe('https://dl/app-v0.2.0/feega-0.2.0-mac-x64.dmg');
  });

  it('falls back to the install guide when no app release exists', () => {
    expect(pickMacDownload([CLI], { arch: 'arm64' })).toBe(INSTALL_GUIDE_URL);
  });

  it('skips drafts and releases without the dmg', () => {
    const draft = release('app-v0.3.0', ['feega-0.3.0-mac-arm64.dmg'], true);
    const partial = release('app-v0.2.5', ['feega-0.2.5-mac-x64.dmg']);
    expect(pickMacDownload([draft, partial, APP], { arch: 'arm64' })).toBe('https://dl/app-v0.2.0/feega-0.2.0-mac-arm64.dmg');
  });
});

describe('wantedArch', () => {
  it('prefers the query, then the client hint, then arm64', () => {
    expect(wantedArch('x64', '"arm"')).toBe('x64');
    expect(wantedArch(null, '"x86"')).toBe('x64');
    expect(wantedArch(null, null)).toBe('arm64');
  });
});

describe('isMobile', () => {
  it('detects iOS and Android', () => {
    expect(isMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe(true);
    expect(isMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X)')).toBe(false);
  });
});
