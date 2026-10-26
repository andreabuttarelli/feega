import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(`src/lib/components/canvas/${path}`, 'utf8');

describe('the frame hover overlay', () => {
  it('stops above the frame bar, like the stage the core draws in', () => {
    expect(read('FrameHover.svelte')).toMatch(/inset:\s*0 0 var\(--bar-h,\s*0px\) 0/);
  });

  it('gets the bar height from the tile it sits in', () => {
    expect(read('gpu/GpuFlow.svelte')).toMatch(/data-box=[^\n]*\n\s*style=\{`[^`\n]*--bar-h:/);
  });
});
