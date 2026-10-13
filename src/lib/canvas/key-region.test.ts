// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { KEY_REGION_ATTR, Region, regionOf, keyRegion } from './key-region.svelte';

function tree() {
  document.body.innerHTML = `
    <div class="pane"><div id="node"><div ${KEY_REGION_ATTR}="${Region.Editor}"><canvas id="player"></canvas></div><button id="node-bar"></button></div></div>
    <section ${KEY_REGION_ATTR}="${Region.Editor}"><div id="timeline"></div></section>`;
  return (id: string) => document.getElementById(id);
}

describe('key region', () => {
  it('the player in the node and the timeline belong to the editor', () => {
    const $ = tree();

    expect(regionOf($('player'))).toBe(Region.Editor);
    expect(regionOf($('timeline'))).toBe(Region.Editor);
  });

  it('the node chrome and empty canvas belong to the canvas', () => {
    const $ = tree();

    expect(regionOf($('node-bar'))).toBe(Region.Canvas);
    expect(regionOf(document.body)).toBe(Region.Canvas);
    expect(regionOf(null)).toBe(Region.Canvas);
  });

  it('keys and undo go to the canvas again once the editor lets go', () => {
    const release = keyRegion.follow();
    tree()('timeline')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(keyRegion.current).toBe(Region.Editor);

    release();
    expect(keyRegion.current).toBe(Region.Canvas);
    document.getElementById('timeline')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(keyRegion.current).toBe(Region.Canvas);
  });
});
