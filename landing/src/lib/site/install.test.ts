import { describe, expect, it } from 'vitest';
import { follow, installOptions, Outcome, primaryCta, runOption, starCta, secondaryCtas, type Env } from './install';
import { DOWNLOAD_PATH, GITHUB_URL, MARKETPLACE_URL } from './links';

const DEEP_LINK = 'vscode:extension/andreabuttarelli.feega';

const rig = (over: Partial<Env> = {}) => {
  const opened: string[] = [];
  const timers: Array<() => void> = [];
  const env: Env = {
    userAgent: 'Mac',
    open: (u) => opened.push(u),
    hidden: () => false,
    later: (fn) => timers.push(fn),
    ...over
  };
  return { opened, timers, env };
};

describe('install CTAs', () => {
  it('every download CTA is a plain link to the download page', () => {
    expect(primaryCta()).toEqual({ label: 'download for free', href: DOWNLOAD_PATH });
    expect(starCta).toEqual({ label: 'star on github', href: GITHUB_URL });
    expect(secondaryCtas().map((c) => c.label)).toEqual(['support with a coffee']);
  });
});

describe('follow', () => {
  const cta = { label: 'VS Code', href: MARKETPLACE_URL, deepLink: DEEP_LINK };

  it('opens the deep link, then the store if the editor did not take focus', () => {
    const { opened, timers, env } = rig();
    follow(cta, env);
    timers[0]();
    expect(opened).toEqual([DEEP_LINK, MARKETPLACE_URL]);
  });

  it('skips the store when the page lost focus', () => {
    const { opened, timers, env } = rig({ hidden: () => true });
    follow(cta, env);
    timers[0]();
    expect(opened).toEqual([DEEP_LINK]);
  });

  it('goes straight to the store on mobile', () => {
    const { opened, env } = rig({ userAgent: 'iPhone' });
    follow(cta, env);
    expect(opened).toEqual([MARKETPLACE_URL]);
  });
});

describe('runOption', () => {
  it('copies the npx command and opens nothing', () => {
    const { opened, env } = rig();
    const copied: string[] = [];
    const terminal = installOptions().find((o) => o.command)!;
    expect(runOption(terminal, env, (t) => copied.push(t))).toBe(Outcome.Copied);
    expect(copied).toEqual(['npx feega']);
    expect(opened).toEqual([]);
  });

  it('opens an editor through its deep link', () => {
    const { opened, env } = rig();
    expect(runOption(installOptions()[0], env, () => {})).toBe(Outcome.Opened);
    expect(opened).toEqual([DEEP_LINK]);
  });
});

describe('download options', () => {
  it('lists every editor plus npx, each opening its editor first and a web page as fallback', () => {
    const options = installOptions(true);
    expect(options.map((o) => o.label)).toEqual(['VS Code', 'Cursor', 'Windsurf', 'VSCodium / Open VSX', 'Terminal']);
    expect(options[0]).toMatchObject({ deepLink: DEEP_LINK, href: MARKETPLACE_URL });
    expect(options[1].deepLink).toBe('cursor:extension/andreabuttarelli.feega');
    expect(options[4]).toMatchObject({ command: 'npx feega' });
  });

  it('only targets already listed are live; the rest say soon', () => {
    const soon = Object.fromEntries(installOptions(true).map((o) => [o.label, o.soon]));
    expect(soon).toEqual({ 'VS Code': false, Cursor: false, Windsurf: false, 'VSCodium / Open VSX': false, Terminal: false });
  });
});
