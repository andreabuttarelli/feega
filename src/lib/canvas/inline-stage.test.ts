// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { LEAVE_CAP_MS, anchoredTo, inlineStage, stageOver } from './inline-stage.svelte';
import { Paint } from './inline-motion';

describe('the stage over a turned node', () => {
  it('takes the node size and angle, centred on its on-screen box, not the box itself', () => {
    const quarter = stageOver({ left: 0, top: 0, width: 50, height: 100 }, { width: 100, height: 50 }, 90);
    expect(quarter).toEqual({ left: -25, top: 25, width: 100, height: 50, rotate: 90 });
  });

  it('scales with the zoom the box shows', () => {
    const turned = stageOver({ left: 10, top: 10, width: 200, height: 100 }, { width: 100, height: 50 }, 0);
    expect(turned).toEqual({ left: 10, top: 10, width: 200, height: 100, rotate: 0 });
  });
});

describe('inline stage', () => {
  it('the editor shows only once its player has drawn, and the node keeps its picture a beat longer', async () => {
    vi.useFakeTimers();
    const take = inlineStage.offer('m1', document.createElement('div'));
    expect(inlineStage.paintOf('m1')).toBe(Paint.Pending);

    inlineStage.ready('m2');
    inlineStage.ready('m1');
    expect(inlineStage.paintOf('m1')).toBe(Paint.Pending);

    await vi.advanceTimersByTimeAsync(40);
    expect(inlineStage.paintOf('m1')).toBe(Paint.Shown);

    await vi.runAllTimersAsync();
    expect(inlineStage.paintOf('m1')).toBe(Paint.Swapped);
    expect(inlineStage.paintOf('m2')).toBe(Paint.Pending);

    take();
    expect(inlineStage.paintOf('m1')).toBe(Paint.Pending);
    inlineStage.offer('m1', document.createElement('div'))();
    expect(inlineStage.paintOf('m1'), 'a reopened editor waits for its own first frame').toBe(Paint.Pending);
    vi.useRealTimers();
  });

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

  it('follows the canvas in the same frame it moves, not the frame after: a lag of one frame is a picture sliding off its node', async () => {
    const viewport = document.createElement('div');
    const node = document.createElement('div');
    const body = document.createElement('div');
    const stage = document.createElement('div');
    stage.style.position = 'fixed';
    viewport.append(node);
    node.append(body);
    document.body.append(viewport, stage);
    let at = { left: 100, top: 100, width: 400, height: 225 };
    body.getBoundingClientRect = () => ({ ...at, right: at.left + at.width, bottom: at.top + at.height, x: at.left, y: at.top, toJSON: () => ({}) }) as DOMRect;
    const anchor = anchoredTo(stage, body);
    anchor.place();

    at = { left: 40, top: 30, width: 800, height: 450 };
    viewport.style.transform = 'translate(-60px, -70px) scale(2)';
    await Promise.resolve();

    expect([stage.style.left, stage.style.top, stage.style.width, stage.style.height]).toEqual(['40px', '30px', '800px', '450px']);
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

  it('leaves a stage alone when it is not meant to float: the dedicated page keeps its own preview', () => {
    const stage = document.createElement('div');
    document.body.append(stage);

    const anchor = anchoredTo(stage, undefined);
    anchor.place();

    expect([stage.style.visibility, stage.style.left, stage.style.width]).toEqual(['', '', '']);
    anchor.destroy();
  });
  it('a fixed element is placed in window coordinates: the editor bar laid into the canvas top bar', () => {
    const bar = document.createElement('header');
    bar.style.position = 'fixed';
    const slot = document.createElement('div');
    document.body.append(bar, slot);
    slot.getBoundingClientRect = () => ({ left: 300, top: 0, width: 600, height: 52, right: 900, bottom: 52, x: 300, y: 0, toJSON: () => ({}) }) as DOMRect;

    const anchor = anchoredTo(bar, slot);
    anchor.place();

    expect([bar.style.left, bar.style.top, bar.style.width, bar.style.height]).toEqual(['300px', '0px', '600px', '52px']);
    anchor.destroy();
  });

  it('a closing frame is let go once its tile has drawn, or after a cap', async () => {
    vi.useFakeTimers();
    inlineStage.leave('m1');
    expect(inlineStage.leaving).toBe('m1');
    inlineStage.landed('m2');
    expect(inlineStage.leaving).toBe('m1');
    inlineStage.landed('m1');
    expect(inlineStage.leaving).toBeNull();

    inlineStage.leave('m1');
    await vi.advanceTimersByTimeAsync(LEAVE_CAP_MS);
    expect(inlineStage.leaving).toBeNull();
    vi.useRealTimers();
  });
});

