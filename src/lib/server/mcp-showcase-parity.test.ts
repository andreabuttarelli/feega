import { describe, it, expect } from 'vitest';
import { CANVAS_OPS } from '$lib/server/canvas/canvas-ops';
import { motionToolList } from '$lib/server/motion/tool-run';
import { SHOWCASE_CANVAS_OPS, SHOWCASE_MOTION_TOOLS } from './mcp-showcase-parity';

describe('the surface the design showcase was built with is the one MCP reaches', () => {
  it('every canvas op the showcase scripts called is a canvas_tool op', () => {
    expect(Object.keys(CANVAS_OPS)).toEqual(expect.arrayContaining([...SHOWCASE_CANVAS_OPS]));
  });

  it('every motion tool the showcase scripts called is a motion_tool tool', () => {
    expect(motionToolList().map((t) => t.name)).toEqual(expect.arrayContaining([...SHOWCASE_MOTION_TOOLS]));
  });
});
