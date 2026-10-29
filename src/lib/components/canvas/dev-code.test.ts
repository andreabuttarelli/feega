import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import DevCode from './DevCode.svelte';
import { FrameProperties } from './frame-properties.svelte';

const panel = readFileSync('src/lib/components/canvas/FrameInspectorPanel.svelte', 'utf8');
const flow = readFileSync('src/lib/components/canvas/gpu/GpuFlow.svelte', 'utf8');

describe('frame code in coder mode', () => {
  it('shows the target picker, the code, copy and the full export', () => {
    const body = render(DevCode, { props: { doc: newMotionDoc(MotionFormat.Landscape), name: 'Hero', assets: {}, tokens: FEEGA_TOKENS, onopen: () => {} } }).body;

    expect(body).toContain('data-testid="dev-code-target-react"');
    expect(body).toContain('data-testid="dev-code-target-html"');
    expect(body).toContain('data-testid="dev-code-target-svelte"');
    expect(body).toContain('data-testid="dev-code-copy"');
    expect(body).toContain('data-testid="dev-code-open"');
  });

  it('replaces the empty hint when the frame itself is selected', () => {
    expect(panel).toMatch(/<DevInspector[\s\S]*\{:else if tokens\}[\s\S]*<DevCode[\s\S]*onopen=\{frameProperties\.openCode\}/);
  });

  it('the canvas opens the existing Export code dialog from it', () => {
    expect(flow).toMatch(/frameProperties\.openCode = \(\) => \(frameDialog = \{ nodeId: panelNodeId, dialog: FrameDialog\.Code \}\)/);
  });

  it('is dropped when the frame is cleared', () => {
    const props = new FrameProperties();
    props.openCode = () => {};
    props.clear();

    expect(props.openCode).toBeNull();
  });
});
