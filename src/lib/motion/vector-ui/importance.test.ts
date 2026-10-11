import { describe, expect, it } from 'vitest';
import FEEGA_APP from '../shots/fixtures/feega-app-vector.json';
import type { VectorUi } from './model';
import { Zone, ranked, zoneOf } from './importance';

const UI = FEEGA_APP as unknown as VectorUi;
const node = (id: string) => UI.nodes.find((n) => n.id === id)!;

describe('which elements of a recreated screen matter', () => {
  it('puts the prompt input and its send button above the sidebar: v2 zoomed on "Motion editor"', () => {
    const top = ranked(UI).slice(0, 5).map((e) => e.id);

    expect(top).toContain('input-0');
    expect(top).toContain('button-5');
    expect(top).not.toContain('link-3');
    expect(top).not.toContain('link-1');
  });

  it('ranks the template chips over the nav links', () => {
    const order = ranked(UI).map((e) => e.id);

    expect(order.indexOf('button-7')).toBeLessThan(order.indexOf('link-3'));
  });

  it('reads the left column as navigation and the centre as the main content', () => {
    expect(zoneOf(UI, node('link-3'))).toBe(Zone.Nav);
    expect(zoneOf(UI, node('button-0'))).toBe(Zone.Nav);
    expect(zoneOf(UI, node('input-0'))).toBe(Zone.Main);
    expect(zoneOf(UI, node('heading-0'))).toBe(Zone.Main);
  });
});
