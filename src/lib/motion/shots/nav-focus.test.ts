import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { writeComponent } from '../custom/ops';
import { vectorPiece } from '../vector-ui/piece';
import type { VectorUi } from '../vector-ui/model';
import { ShotId } from './library';
import { ShotFocus, addShot } from './ops';
import FEEGA_APP from './fixtures/feega-app-vector.json';

const UI = FEEGA_APP as unknown as VectorUi;

function withUi(): MotionDoc {
  const piece = vectorPiece('UiApp', UI);
  const r = writeComponent(newMotionDoc(MotionFormat.Vertical), piece.name, { source: { html: piece.html, css: piece.css, js: piece.js }, propsSchema: { type: 'object', properties: {} } });
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

describe('a ui shot zooms on what matters', () => {
  it('refuses a ui-morph between sidebar links: v2 zoomed on "Motion editor" and "New video"', () => {
    const made = addShot(withUi(), { shot: ShotId.UiMorph, slots: { from_id: 'link-3', to_id: 'link-1' }, ui: 'UiApp', at: 0 }, 's1');

    expect(made.ok).toBe(false);
    expect(made.ok ? '' : made.error).toMatch(/navigation.*input-0/s);
  });

  it('allows the sidebar when the line is about navigating', () => {
    const made = addShot(withUi(), { shot: ShotId.UiMorph, slots: { from_id: 'link-3', to_id: 'link-1' }, ui: 'UiApp', at: 0, focus: ShotFocus.Navigation }, 's1');

    expect(made.ok).toBe(true);
  });

  it('takes the prompt and the chips', () => {
    const made = addShot(withUi(), { shot: ShotId.UiFocus, slots: { field_id: 'input-0', button_id: 'button-5', type_text: 'a launch film' }, ui: 'UiApp', at: 0 }, 's1');

    expect(made.ok).toBe(true);
  });
});
