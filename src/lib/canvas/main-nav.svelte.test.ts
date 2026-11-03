import { describe, expect, it, vi } from 'vitest';
import { mainNav } from './main-nav.svelte';
import type { CanvasComponents } from './project-components';

const listed: CanvasComponents[] = [{ canvasId: 'c1', canvasName: 'Components', components: [{ key: 'k', frameId: 'set', home: 'set', frameName: 'Button', name: 'Button', variants: [], thumb: null, revision: 1 }] }];

describe('where a main lives, read only when asked', () => {
  it('opening a canvas lists nothing; the first question loads the list once', async () => {
    const load = vi.fn(async () => listed);
    const stop = mainNav.serve({ navigate: () => {}, here: () => null, load });

    expect(load).not.toHaveBeenCalled();

    mainNav.where({ compId: 'b', home: 'set' });
    mainNav.where({ compId: 'b', home: 'set' });
    await vi.waitFor(() => expect(mainNav.where({ compId: 'b', home: 'set' })?.label).toBe('Components › Button'));

    expect(load).toHaveBeenCalledTimes(1);
    stop();
  });
});
