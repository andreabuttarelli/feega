import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip, type OpResult } from '$lib/motion/timeline';
import { addEffect, setEffect } from '$lib/motion/effects/ops';
import { EffectKind } from '$lib/motion/effects/registry';
import MotionInspector from './MotionInspector.svelte';

function ok(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

function inspect(kind: EffectKind, enabled = true) {
  const added = ok(addEffect(ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0 }, 'c1')), 'c1', kind, 'fx1'));
  const doc = ok(setEffect(added, 'c1', 'fx1', { enabled }));
  const clip = findClip(doc, 'c1')!.clip;
  return render(MotionInspector, { props: { doc, clip, tokens: FEEGA_TOKENS, assets: [], frame: 0, onchange: () => {} } }).body;
}

describe('the Effects section', () => {
  it('each effect has an eye that says what it does', () => {
    expect(inspect(EffectKind.InnerShadow)).toMatch(/data-testid="effect-eye"[^>]*aria-label="Hide Inner shadow"/);
    expect(inspect(EffectKind.InnerShadow, false)).toContain('aria-label="Show Inner shadow"');
    expect(inspect(EffectKind.InnerShadow)).not.toContain('aria-label="Enable Inner shadow"');
  });

  it('a collapsed effect row is its eye, its name to open it, and remove; params wait in the popover', () => {
    const html = inspect(EffectKind.DropShadow);
    expect(html).toMatch(/data-testid="effect-open"[^>]*>Drop shadow</);
    expect(html).not.toContain('data-prop="fx.fx1.distance"');
  });

  it('background blur is listed by name', () => {
    expect(inspect(EffectKind.BackgroundBlur)).toContain('Background blur');
  });
});
