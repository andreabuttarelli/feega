import { describe, expect, it } from 'vitest';
import { follow, installOptions, primaryCta, starCta, secondaryCtas, type Env } from './install';
import { COFFEE_URL, GITHUB_URL, MARKETPLACE_URL } from './links';

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
  it('unpublished: coming soon points at GitHub, no fake install', () => {
    expect(primaryCta(false)).toEqual({ label: 'Download for free', href: GITHUB_URL });
    expect(starCta).toEqual({ label: 'Star on GitHub', href: GITHUB_URL });
    expect(secondaryCtas().map((c) => c.label)).toEqual(['Support with a coffee']);
  });

  it('published: deep link with marketplace fallback, other editors listed', () => {
    const cta = primaryCta(true);
    expect(cta.deepLink).toBe(DEEP_LINK);
    expect(cta.href).toBe(MARKETPLACE_URL);
    expect(secondaryCtas().map((c) => c.href)).toEqual([COFFEE_URL]);
  });

  it('falls back to the web URL when the protocol did not open', () => {
    const { opened, timers, env } = rig();
    follow(primaryCta(true), env);
    timers[0]();
    expect(opened).toEqual([DEEP_LINK, MARKETPLACE_URL]);
  });

  it('stays on the deep link when the page was hidden', () => {
    const { opened, timers, env } = rig({ hidden: () => true });
    follow(primaryCta(true), env);
    timers[0]();
    expect(opened).toEqual([DEEP_LINK]);
  });

  it('goes straight to the web URL on mobile', () => {
    const { opened, env } = rig({ userAgent: 'iPhone' });
    follow(primaryCta(true), env);
    expect(opened).toEqual([MARKETPLACE_URL]);
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
