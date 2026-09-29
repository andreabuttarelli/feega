import { describe, expect, it } from 'vitest';
import { TOOLBAR_GAP, toolbarAnchor, VIEWPORT_MARGIN } from './toolbar-position';

const viewport = { width: 1440, height: 900 };

describe('la barra resta dentro lo schermo', () => {
  it('centrata sulla selezione quando c\'è spazio', () => {
    expect(toolbarAnchor({ x: 600, y: 300, width: 200 }, { width: 400, height: 40 }, viewport)).toEqual({ x: 700, y: 300 });
  });

  it('una selezione mezza fuori a sinistra non porta la barra fuori', () => {
    expect(toolbarAnchor({ x: -300, y: 300, width: 200 }, { width: 400, height: 40 }, viewport).x).toBe(200 + VIEWPORT_MARGIN);
  });

  it('né a destra', () => {
    expect(toolbarAnchor({ x: 1400, y: 300, width: 200 }, { width: 400, height: 40 }, viewport).x).toBe(1440 - 200 - VIEWPORT_MARGIN);
  });

  it('una selezione in cima non spinge la barra sopra il bordo', () => {
    expect(toolbarAnchor({ x: 600, y: 10, width: 200 }, { width: 400, height: 40 }, viewport).y).toBe(40 + TOOLBAR_GAP + VIEWPORT_MARGIN);
  });
});
