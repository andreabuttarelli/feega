import { describe, expect, it } from 'vitest';
import { Readiness } from '@feega/motion-core/motion/gpu-full/media';
import { OnScreen, showStaged } from './staged-show';

const pending = () => {
  let settle: (r: Readiness) => void = () => {};
  const ready = new Promise<Readiness>((resolve) => (settle = resolve));
  return { ready, settle };
};

describe('showStaged', () => {
  it('un frame vuoto mostra subito i vettori senza aspettare le immagini', () => {
    const shown: Readiness[] = [];
    const { ready } = pending();

    showStaged(ready, OnScreen.Nothing, (r) => shown.push(r));

    expect(shown).toEqual([Readiness.Partial]);
  });

  it('le immagini arrivate sostituiscono la versione senza immagini', async () => {
    const shown: Readiness[] = [];
    const { ready, settle } = pending();

    showStaged(ready, OnScreen.Nothing, (r) => shown.push(r));
    settle(Readiness.Whole);
    await ready;

    expect(shown).toEqual([Readiness.Partial, Readiness.Whole]);
  });

  it('una miniatura resta finché le immagini non sono pronte', async () => {
    const shown: Readiness[] = [];
    const { ready, settle } = pending();

    showStaged(ready, OnScreen.Thumb, (r) => shown.push(r));
    expect(shown).toEqual([]);

    settle(Readiness.Partial);
    await ready;

    expect(shown).toEqual([Readiness.Partial]);
  });
});
