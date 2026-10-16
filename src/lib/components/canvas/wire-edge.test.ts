import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import WireEdge from './WireEdge.svelte';
import { wireEdge } from '$lib/canvas-edges';

function html(mode: 'fixed' | 'iterate' | undefined): string {
  const props = {
    id: 'e1',
    source: 'a',
    target: 'b',
    sourceX: 0,
    sourceY: 0,
    targetX: 200,
    targetY: 100,
    sourcePosition: 'right',
    targetPosition: 'left',
    data: wireEdge({ id: 'e1', source: 'a', target: 'b', kind: 'derives_from', mode }).data
  };
  return render(WireEdge, { props: props as never }).body;
}

describe('a wire on the canvas', () => {
  it('an iterate wire renders with the iterate class and the loop icon', () => {
    const body = html('iterate');

    expect(body).toContain('wire-iterate');
    expect(body).toContain('data-testid="wire-iterate-icon"');
  });

  it('a fixed wire has neither', () => {
    const body = html('fixed');

    expect(body).not.toContain('wire-iterate');
    expect(body).not.toContain('wire-iterate-icon');
  });

  it('a wire without a mode reads as fixed', () => {
    expect(html(undefined)).not.toContain('wire-iterate');
  });
});
