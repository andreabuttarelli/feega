// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { anchoredTo, inlineStage } from './inline-stage.svelte';

describe('inline stage', () => {
  it('a node offers its body as the stage of its own editor only, and takes it back', () => {
    const body = document.createElement('div');
    const take = inlineStage.offer('m1', body);

    expect(inlineStage.of('m1')).toBe(body);
    expect(inlineStage.editing).toBe(true);
    expect(inlineStage.of('m2')).toBeNull();

    take();
    expect(inlineStage.of('m1')).toBeNull();
    expect(inlineStage.editing).toBe(false);
  });

  it('the editor stage is laid over the node body without leaving its parent: moving an iframe reloads it blank', () => {
    const layer = document.createElement('section');
    const stage = document.createElement('div');
    const body = document.createElement('div');
    layer.append(stage);
    document.body.append(layer, body);
    const rect = (r: Partial<DOMRect>) => () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}), ...r }) as DOMRect;
    layer.getBoundingClientRect = rect({ left: 40, top: 50 });
    body.getBoundingClientRect = rect({ left: 140, top: 250, width: 400, height: 225 });

    const anchor = anchoredTo(stage, body);
    anchor.place();

    expect(stage.parentElement).toBe(layer);
    expect([stage.style.left, stage.style.top, stage.style.width, stage.style.height]).toEqual(['100px', '200px', '400px', '225px']);
    anchor.destroy();
  });

  it('hides the stage while there is no node body to cover', () => {
    const stage = document.createElement('div');
    document.body.append(stage);

    const anchor = anchoredTo(stage, null);
    anchor.place();

    expect(stage.style.visibility).toBe('hidden');
    anchor.destroy();
  });

});
