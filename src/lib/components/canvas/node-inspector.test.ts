import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import FrameInspectorPanel from './FrameInspectorPanel.svelte';
import { selectionProperties, type NodeSummary } from './selection-properties.svelte';

const noop = () => undefined;

const panelOf = (summaries: NodeSummary[]) => ({ summaries, runQuote: null, onaction: noop, onpropertychange: noop, onview: noop, onalign: noop, ondistribute: noop });

const html = () => render(FrameInspectorPanel, { props: { session: null, tokens: null } }).body;

describe('right bar of a canvas selection', () => {
  afterEach(() => selectionProperties.clear());

  it('shows a generated image with its toolbar actions', () => {
    selectionProperties.publish(panelOf([{ id: 'i', type: 'image', data: { refId: 'r1' } }]));
    const body = html();

    expect(body).toContain('data-testid="node-inspector"');
    expect(body).toContain('data-testid="panel-remove-background"');
    expect(body).toContain('data-testid="panel-view-output"');
  });

  it('aligns and distributes several free elements', () => {
    selectionProperties.publish(panelOf([{ id: 'a', type: 'text', data: {} }, { id: 'b', type: 'text', data: {} }]));

    expect(html()).toContain('data-testid="align-bar"');
  });

  it('falls back to the hint when nothing is selected', () => {
    expect(html()).toContain('data-testid="properties-empty"');
  });
});
