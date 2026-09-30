import { describe, it, expect, vi } from 'vitest';
import { revealCanvas, onCanvasReveal } from './canvas-reveal';
import { Trigger } from './staleness';

function fakeDocument(state: DocumentVisibilityState) {
  const target = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState };
  target.visibilityState = state;
  return target;
}

describe('onCanvasReveal', () => {
  it('la tela si rilegge quando torna visibile dal tab Chat', () => {
    const refetch = vi.fn();
    const stop = onCanvasReveal(refetch, fakeDocument('visible'), new EventTarget());

    revealCanvas();
    expect(refetch).toHaveBeenCalledTimes(1);
    stop();
  });

  it('la tela si rilegge quando la pagina torna in primo piano, non quando va in background', () => {
    const doc = fakeDocument('visible');
    const refetch = vi.fn();
    const stop = onCanvasReveal(refetch, doc, new EventTarget());

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
    const stop = onCanvasReveal(refetch, fakeDocument('visible'), new EventTarget());
    stop();

    revealCanvas();
    expect(refetch).not.toHaveBeenCalled();
  });
});

describe('onCanvasReveal, ritorno su una scheda vecchia', () => {
  it('rilegge al focus della finestra', () => {
    const win = new EventTarget();
    const refetch = vi.fn();
    const stop = onCanvasReveal(refetch, fakeDocument('visible'), win);

    win.dispatchEvent(new Event('focus'));
    expect(refetch).toHaveBeenCalledWith(Trigger.Return);
    stop();
  });

  it('rilegge al ripristino dalla bfcache, non al primo pageshow', () => {
    const win = new EventTarget();
    const refetch = vi.fn();
    const stop = onCanvasReveal(refetch, fakeDocument('visible'), win);

    win.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false }));
    expect(refetch).not.toHaveBeenCalled();

    win.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    expect(refetch).toHaveBeenCalledWith(Trigger.Return);
    stop();
  });

  it('rilegge quando la rete torna, dicendo che era offline', () => {
    const win = new EventTarget();
    const refetch = vi.fn();
    const stop = onCanvasReveal(refetch, fakeDocument('visible'), win);

    win.dispatchEvent(new Event('online'));
    expect(refetch).toHaveBeenCalledWith(Trigger.Online);
    stop();

    win.dispatchEvent(new Event('online'));
    win.dispatchEvent(new Event('focus'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
