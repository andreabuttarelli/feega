import { describe, expect, it } from 'vitest';
import type { GenNode } from './gen-node';
import type { RunQuote } from './run-quote';
import { genTileView, type GenTileExtras } from './gen-tile-view';

const node = (over: Partial<GenNode> = {}): GenNode => ({ id: 'n', medium: 'image', prompt: '', model: null, params: {}, refId: null, running: false, error: null, runs: [], ...over }) as GenNode;

const quote = (over: Partial<RunQuote> = {}): RunQuote => ({ label: 'Generate', credits: 4, variable: false, enabled: true, reason: null, tooLong: false, choice: undefined, cost: { medium: 'image', model: null, params: {} }, ...over });

const extras: GenTileExtras = { hasUpstreamText: false, variableTextInput: false, loopQueued: 0, loopVisible: false, loopCombinationCount: 0 };

describe('genTileView', () => {
  it('shows the hint and the placeholder of an empty image node', () => {
    const v = genTileView(node(), quote({ enabled: false, reason: 'Write what you want' }), extras);

    expect(v.state).toBe('empty');
    expect(v.hasBody).toBe(true);
    expect(v.hint).toBe('Write what you want');
    expect(v.placeholder).toBe('Describe what you want to see…');
    expect(v.warn).toEqual({ text: 'Write what you want', soft: true });
    expect(v.run).toEqual({ label: 'Generate', credits: '~0.04', variable: false, enabled: false });
  });

  it('drops the body of a text node that has nothing to show', () => {
    expect(genTileView(node({ medium: 'text', prompt: 'hi' }), quote(), extras).hasBody).toBe(false);
    expect(genTileView(node({ medium: 'text', running: true }), quote(), extras).hasBody).toBe(true);
  });

  it('labels the button Redo once the node has an output', () => {
    expect(genTileView(node({ refId: 'a' }), quote({ label: 'Redo' }), extras).run.label).toBe('Redo');
  });

  it('offers the loop with its own credits when visible', () => {
    const v = genTileView(node({ prompt: 'x' }), quote({ credits: 4 }), { ...extras, loopVisible: true, loopCombinationCount: 2 });

    expect(v.loop).toMatchObject({ label: 'Loop ×2', enabled: true, cancel: false });
  });

  it('turns the loop into a cancel while runs are queued', () => {
    expect(genTileView(node(), quote(), { ...extras, loopQueued: 3 }).loop).toEqual({ label: 'Annulla loop (3)', credits: null, variable: false, enabled: true, cancel: true });
  });

  it('carries the failure reason and the run history', () => {
    const runs = [{ id: 'a', mediaId: 'm1', prompt: 'p' }, { id: 'b', mediaId: 'm2', prompt: 'p' }] as GenNode['runs'];
    const v = genTileView(node({ error: 'boom', runs, refId: 'm2' }), quote(), extras);

    expect(v.state).toBe('failed');
    expect(v.error).toBe('boom');
    expect(v.runs).toBe(2);
    expect(v.shown).toBe(1);
  });

  it('carries the text of the run on show', () => {
    const runs = [{ id: 'a', mediaId: 'm1', prompt: 'p', text: 'hello' }] as GenNode['runs'];

    expect(genTileView(node({ medium: 'text', runs, refId: 'm1' }), quote(), extras).output).toBe('hello');
  });
});
