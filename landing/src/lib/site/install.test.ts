import { describe, expect, it } from 'vitest';
import { follow, primaryCta, starCta, secondaryCtas, type Env } from './install';
import { GITHUB_URL, MARKETPLACE_URL } from './links';

const DEEP_LINK = 'vscode:extension/andreabuttarelli.feega-inspect';

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
    expect(starCta).toEqual({ label: 'Star us on GitHub', href: GITHUB_URL });
    expect(secondaryCtas(false).map((c) => c.label)).toEqual(['Support with a coffee']);
  });

  it('published: deep link with marketplace fallback, other editors listed', () => {
    const cta = primaryCta(true);
    expect(cta.deepLink).toBe(DEEP_LINK);
    expect(cta.href).toBe(MARKETPLACE_URL);
    expect(secondaryCtas(true).map((c) => c.label)).toEqual(['Cursor', 'Windsurf', 'VSCodium / Open VSX']);
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
