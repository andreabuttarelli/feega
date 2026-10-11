import { describe, it, expect, vi } from 'vitest';
import { DISMISS_STRATEGIES, ESCAPE_KEY, dismissOverlays, type Overlay, type OverlayTab } from './overlays';

function stack(overlays: Overlay[], closesOn: (action: string) => boolean): OverlayTab & { actions: string[] } {
  const actions: string[] = [];
  const close = (action: string) => {
    actions.push(action);
    if (closesOn(action)) {
      overlays.shift();
    }
  };
  return {
    actions,
    overlay: vi.fn(async () => overlays[0] ?? null),
    click: vi.fn(async (t) => close(t.selector ?? '')),
    press: vi.fn(async (key: string) => close(key))
  };
}

describe('blocking overlays: one table of dismiss strategies', () => {
  it('nothing open: nothing pressed, nothing reported', async () => {
    const tab = stack([], () => true);

    expect(await dismissOverlays(tab)).toEqual([]);
    expect(tab.actions).toEqual([]);
  });

  it('an onboarding tour with Skip is skipped, not closed by Escape', async () => {
    const tab = stack([{ buttons: ['Skip', 'Next'] }], () => true);

    expect(await dismissOverlays(tab)).toEqual(['skip']);
    expect(tab.actions).toEqual([expect.stringContaining('Skip')]);
  });

  it('a × close button is matched by its label', async () => {
    const tab = stack([{ buttons: ['Close'] }], () => true);

    expect(await dismissOverlays(tab)).toEqual(['close']);
  });

  it('a dialog without known buttons falls back to Escape', async () => {
    const tab = stack([{ buttons: ['Learn more'] }], (a) => a === ESCAPE_KEY);

    expect(await dismissOverlays(tab)).toEqual(['escape']);
  });

  it('two stacked dialogs are both dismissed, in order', async () => {
    const tab = stack([{ buttons: ['Got it'] }, { buttons: ['Not now'] }], () => true);

    expect(await dismissOverlays(tab)).toEqual(['got it', 'not now']);
  });

  it('a dialog nothing closes is left alone after every strategy was tried once', async () => {
    const tab = stack([{ buttons: ['Skip', 'Close'] }], () => false);

    expect(await dismissOverlays(tab)).toEqual([]);
    expect(tab.actions).toHaveLength(3);
  });

  it('every strategy is either a label list or a key', () => {
    expect(DISMISS_STRATEGIES.every((s) => ('labels' in s ? s.labels.length > 0 : s.key.length > 0))).toBe(true);
  });
});
