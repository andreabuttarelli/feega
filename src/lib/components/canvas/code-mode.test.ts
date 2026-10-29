import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { EditorMode } from '$lib/canvas/editor-mode.svelte';
import { FRAME_MODE_ACTIONS, FrameDialog } from '$lib/canvas/frame-dialogs';
import { CodeTarget, exportCode } from '@feega/motion-core/motion/codegen/index';
import { entryFile } from '$lib/components/motion/code-files';
import DevCode from './DevCode.svelte';

const panel = readFileSync('src/lib/components/canvas/FrameInspectorPanel.svelte', 'utf8');
const flow = readFileSync('src/lib/components/canvas/gpu/GpuFlow.svelte', 'utf8');
const segmented = readFileSync('src/lib/components/ui/shell/SegmentedControl.svelte', 'utf8');

describe('code mode', () => {
  it('picks framework and file from two dropdowns on one row', () => {
    const body = render(DevCode, { props: { doc: newMotionDoc(MotionFormat.Landscape), name: 'Hero', assets: {}, tokens: FEEGA_TOKENS } }).body;

    expect(body).toContain('data-testid="dev-code-target"');
    expect(body).toContain('data-testid="dev-code-file"');
    for (const label of ['React', 'HTML', 'Svelte']) {
      expect(body).toContain(`>${label}</option>`);
    }
    expect(body).not.toContain('role="tablist"');
    expect(body).not.toContain('data-slot="segmented-control"');
    expect(body).toContain('data-testid="dev-code-download"');
  });

  it('opens on the main entry file', () => {
    const react = ['index.html', 'package.json', 'src/main.tsx', 'src/pages/Hero.tsx'].map((path) => ({ path, content: '' }));
    const svelte = ['package.json', 'src/routes/+page.svelte'].map((path) => ({ path, content: '' }));

    expect(entryFile(react).path).toBe('src/pages/Hero.tsx');
    expect(entryFile(svelte).path).toBe('src/routes/+page.svelte');
  });

  it('keeps the frame export under the picked layer CSS', () => {
    const code = panel.slice(panel.indexOf('aria-label="Code mode"'), panel.indexOf('{:else if session && doc && tokens && !session.selection.length}'));

    expect(code).toMatch(/<DevInspector[\s\S]*<DevCode/);
    expect(code).not.toMatch(/\{:else if tokens\}/);
  });

  it('exports under the real frame name', () => {
    expect(panel).toContain('name={frameProperties.name}');
    expect(panel).not.toContain('name="Frame"');
  });

  it('titles the exported page after the frame', () => {
    const out = exportCode(newMotionDoc(MotionFormat.Landscape), { target: CodeTarget.Html, name: 'Landing page', assets: {}, brand: FEEGA_TOKENS });

    expect(out.files.find((f) => f.path === 'index.html')?.content).toContain('<title>Landing page</title>');
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
