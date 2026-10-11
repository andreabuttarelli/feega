import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import VarsPanel from './VarsPanel.svelte';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { VarKind, declareVar, starterVar, type VarDecl } from '$lib/motion/interactive/vars';

function docWith(decls: VarDecl[]): MotionDoc {
  return decls.reduce((doc, decl) => {
    const r = declareVar(doc, decl);
    if (!r.ok) {
      throw new Error(r.error);
    }
    return r.doc;
  }, newMotionDoc(MotionFormat.Landscape));
}

const html = (doc: MotionDoc, values = {}) => render(VarsPanel, { props: { doc, values, clip: null, onchange: () => {} } }).body;

describe('the variables panel', () => {
  it('previews every kind with its own control', () => {
    const body = html(docWith(Object.values(VarKind).map((kind) => starterVar(kind, `v_${kind}`))));

    expect(body).toContain('data-testid="var-v_number"');
    expect(body).toContain('type="range"');
    expect(body).toContain('type="checkbox"');
    expect(body).toContain('<select');
    expect(body).toContain('type="color"');
    expect(body).toContain('type="text"');
  });

  it('shows the preview value, not the default, once the user moved it', () => {
    const body = html(docWith([{ name: 'speed', kind: VarKind.Number, default: 1, min: 0, max: 4 }]), { speed: 3 });

    expect(body).toContain('value="3"');
  });

  it('offers to declare one when there are none', () => {
    expect(html(newMotionDoc(MotionFormat.Landscape))).toContain('data-testid="var-add"');
  });
});
