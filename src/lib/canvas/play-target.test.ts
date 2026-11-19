import { describe, expect, it } from 'vitest';
import { PageHost, PageState, PlayKind, pageHostOf, pageStateOf, playKindOf, playWidth } from './play-target';

describe('play target', () => {
  it('a live frame plays the real page, a drawn frame the canvas renderer', () => {
    const drawn = new Set(['a']);
    const live = new Set(['b']);

    expect(playKindOf('a', drawn, live)).toBe(PlayKind.Drawn);
    expect(playKindOf('b', drawn, live)).toBe(PlayKind.Live);
    expect(playKindOf('c', drawn, live)).toBeNull();
  });

  it('the desktop shell hosts the page in a webview, the browser in an iframe', () => {
    expect(pageHostOf('Mozilla/5.0 FeegaNative/1 Electron/38')).toBe(PageHost.Webview);
    expect(pageHostOf('Mozilla/5.0 Chrome/140')).toBe(PageHost.Iframe);
  });

  it('a page with no dev server shows its snapshot', () => {
    expect(pageStateOf('http://localhost:5174')).toBe(PageState.Running);
    expect(pageStateOf(null)).toBe(PageState.Down);
  });

  it('the play width starts at the frame width and stays in range', () => {
    expect(playWidth(390)).toBe(390);
    expect(playWidth(20)).toBe(120);
    expect(playWidth(Number.NaN)).toBe(1440);
  });
});
