import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { EditorMode } from '$lib/canvas/editor-mode.svelte';
import { FRAME_MODE_ACTIONS, FrameDialog } from '$lib/canvas/frame-dialogs';
import DevCode from './DevCode.svelte';

const panel = readFileSync('src/lib/components/canvas/FrameInspectorPanel.svelte', 'utf8');
const flow = readFileSync('src/lib/components/canvas/gpu/GpuFlow.svelte', 'utf8');
const segmented = readFileSync('src/lib/components/ui/shell/SegmentedControl.svelte', 'utf8');

describe('code mode', () => {
  it('shows the targets, the code, copy and the full export inline', () => {
    const body = render(DevCode, { props: { doc: newMotionDoc(MotionFormat.Landscape), name: 'Hero', assets: {}, tokens: FEEGA_TOKENS } }).body;

    for (const id of ['react', 'html', 'svelte']) {
      expect(body).toContain(`data-testid="dev-code-target-${id}"`);
    }
    expect(body).toContain('data-testid="dev-code-copy"');
    expect(body).toContain('data-testid="dev-code-download"');
  });

  it('shows the frame code when no layer is picked', () => {
    expect(panel).toMatch(/<DevInspector[\s\S]*\{:else if tokens\}[\s\S]*<DevCode/);
  });

  it('Export code… opens Code mode instead of a dialog', () => {
    expect(FRAME_MODE_ACTIONS['frame-code']).toBe(EditorMode.Code);
    expect(Object.values(FrameDialog)).not.toContain('code');
  });

  it('locks canvas moves, resizes, links and frame edits', () => {
    expect(flow).toMatch(/const editable = \$derived\(spec\.flow\.nodesDraggable && editorMode\.spec\.access === DocAccess\.Write\)/);
    expect(flow).toMatch(/session\.access = editorMode\.spec\.access/);
    expect(flow).not.toMatch(/spec\.flow\.nodesDraggable(?! && editorMode)/);
  });

  it('the mode highlight moves with the mode, without fading', () => {
    expect(segmented).not.toContain('transition-colors');
  });
});
