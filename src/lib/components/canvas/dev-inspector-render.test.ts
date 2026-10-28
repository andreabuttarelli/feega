import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import DevInspector from './DevInspector.svelte';

const seeded = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.25, height: 0.1, fill: 'brand.accent' } }, 'card');
const doc: MotionDoc = seeded.ok ? seeded.doc : newMotionDoc(MotionFormat.Landscape);

const panel = readFileSync('src/lib/components/canvas/FrameInspectorPanel.svelte', 'utf8');
const flow = readFileSync('src/lib/components/canvas/gpu/GpuFlow.svelte', 'utf8');

describe('the dev inspector', () => {
  it('shows the measures, the CSS, the Tailwind classes and the brand variable of a layer', () => {
    const body = render(DevInspector, { props: { doc, clipId: 'card', brand: FEEGA_TOKENS, onexport: () => {} } }).body;

    expect(body).toContain('data-testid="dev-measures"');
    expect(body).toContain('width: 480px;');
    expect(body).toContain('w-[480px]');
    expect(body).toContain('brand.accent');
    expect(body).toContain('data-testid="dev-export"');
  });

  it('renders nothing for a layer that is gone', () => {
    expect(render(DevInspector, { props: { doc, clipId: 'ghost', brand: null } }).body).not.toContain('dev-inspector');
  });

  it('replaces the editable properties while coder mode is on', () => {
    expect(panel).toMatch(/\{#if frameProperties\.dev && session && doc\}[\s\S]*<DevInspector[\s\S]*\{:else if session && doc && tokens && !session\.selection\.length\}/);
  });

  it('the frame turns hover measures on for coder mode and hands the panel its export', () => {
    expect(flow).toMatch(/\(altHeld \|\| shows\(frameViews, FrameView\.Dev\)\)/);
    expect(flow).toMatch(/frameProperties\.exportPicks = \(\) => props\.onExportElements\?\.\(panelNodeId, picks\)/);
  });
});
