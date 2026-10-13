// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { hostedIn, inlineStage } from './inline-stage.svelte';

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

  it('the editor stage moves into the node body, so one player exists, and leaves with the editor', () => {
    const editor = document.createElement('section');
    const stage = document.createElement('div');
    const body = document.createElement('div');
    editor.append(stage);

    const hosted = hostedIn(stage, body);
    expect(stage.parentElement).toBe(body);

    hosted.destroy();
    expect(body.childElementCount).toBe(0);
  });
});
