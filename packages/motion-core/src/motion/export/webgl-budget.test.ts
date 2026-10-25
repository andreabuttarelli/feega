import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { composeHtml } from '../hyperframes/compose';
import { WEBGL_CONTEXT_BUDGET, WEBGL_PAGE_CONTEXTS, lanesWithin, webglPerLane } from './webgl-budget';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

function withShapes(count: number): MotionDoc {
  let doc = newMotionDoc(MotionFormat.Landscape);
  for (let i = 0; i < count; i += 1) {
    doc = must(addClip(doc, { component: 'Shape3D', from: 0, durationInFrames: 60, props: {} }, `s${i}`));
  }
  return doc;
}

const perLane = (doc: MotionDoc) => webglPerLane(composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} }));

describe('webgl budget', () => {
  it('conta un contesto per ogni livello 3D della composizione', () => {
    expect(perLane(withShapes(5))).toBe(5);
    expect(perLane(withShapes(0))).toBe(0);
  });

  it('una pagina senza conteggio non limita le corsie', () => {
    expect(webglPerLane('<html></html>')).toBe(0);
    expect(lanesWithin(4, 0)).toBe(4);
  });

  for (const shapes of [1, 3, 5, 8, 20]) {
    it(`con ${shapes} livelli 3D le corsie restano nel tetto di contesti WebGL della pagina`, () => {
      const lanes = lanesWithin(4, perLane(withShapes(shapes)));

      expect(lanes).toBeGreaterThanOrEqual(1);
      expect(lanes === 1 || lanes * shapes + WEBGL_PAGE_CONTEXTS <= WEBGL_CONTEXT_BUDGET).toBe(true);
    });
  }

  it('asteroids, 5 livelli 3D su 4 corsie: non supera i 16 contesti di Chromium', () => {
    expect(lanesWithin(4, 5) * 5 + WEBGL_PAGE_CONTEXTS).toBeLessThanOrEqual(16);
  });
});
