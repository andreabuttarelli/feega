import { describe, it, expect, vi } from 'vitest';
import { revealCanvas, onCanvasReveal } from './canvas-reveal';

function fakeDocument(state: DocumentVisibilityState) {
  const target = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState };
  target.visibilityState = state;
  return target;
}

describe('onCanvasReveal', () => {
  it('la tela si rilegge quando torna visibile dal tab Chat', () => {
    const refetch = vi.fn();
    const stop = onCanvasReveal(refetch, fakeDocument('visible'));

    revealCanvas();
    expect(refetch).toHaveBeenCalledTimes(1);
    stop();
  });

  it('la tela si rilegge quando la pagina torna in primo piano, non quando va in background', () => {
    const doc = fakeDocument('visible');
    const refetch = vi.fn();
    const stop = onCanvasReveal(refetch, doc);

    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(refetch).not.toHaveBeenCalled();

    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(refetch).toHaveBeenCalledTimes(1);
    stop();
  });

  it('dopo lo stop non rilegge più', () => {
    const refetch = vi.fn();
    const stop = onCanvasReveal(refetch, fakeDocument('visible'));
    stop();

    revealCanvas();
    expect(refetch).not.toHaveBeenCalled();
  });
});
