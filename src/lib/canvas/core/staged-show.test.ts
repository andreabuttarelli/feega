import { describe, expect, it } from 'vitest';
import { Readiness } from '@feega/motion-core/motion/gpu-full/media';
import { OnScreen, RETRY_MS, Stage, VectorsSeen, showStaged, shownBefore } from './staged-show';

const pending = () => {
  let settle: (r: Readiness) => void = () => {};
  const ready = new Promise<Readiness>((resolve) => (settle = resolve));
  return { ready, settle };
};

describe('showStaged', () => {
  it('un frame vuoto mostra subito i vettori senza aspettare le immagini', () => {
    const shown: Readiness[] = [];
    const { ready } = pending();

    showStaged(() => ready, OnScreen.Nothing, (r) => shown.push(r));

    expect(shown).toEqual([Readiness.Partial]);
  });

  it('le immagini arrivate sostituiscono la versione senza immagini', async () => {
    const shown: Readiness[] = [];
    const { ready, settle } = pending();

    showStaged(() => ready, OnScreen.Nothing, (r) => shown.push(r));
    settle(Readiness.Whole);
    await ready;

    expect(shown).toEqual([Readiness.Partial, Readiness.Whole]);
  });

  it('a frame whose pictures only partly decode is shown again once they settle, so the ones that arrived replace their blocks', async () => {
    const shown: [Readiness, Stage][] = [];
    const { ready, settle } = pending();

    showStaged(() => ready, OnScreen.Nothing, (r, stage) => shown.push([r, stage]));
    settle(Readiness.Partial);
    await ready;

    expect(shown).toEqual([
      [Readiness.Partial, Stage.Vectors],
      [Readiness.Partial, Stage.Settled]
    ]);
  });

  it('pictures that failed are asked again at rest until they arrive', async () => {
    const shown: [Readiness, Stage][] = [];
    const answers = [Readiness.Partial, Readiness.Partial, Readiness.Whole];
    const waits: number[] = [];

    await showStaged(async () => answers.shift()!, OnScreen.Nothing, (r, stage) => shown.push([r, stage]), async (ms) => void waits.push(ms));

    expect(shown).toEqual([
      [Readiness.Partial, Stage.Vectors],
      [Readiness.Partial, Stage.Settled],
      [Readiness.Partial, Stage.Settled],
      [Readiness.Whole, Stage.Settled]
    ]);
    expect(waits.length).toBe(2);
  });

  it('gives up after a few attempts', async () => {
    const shown: Readiness[] = [];

    await showStaged(async () => Readiness.Partial, OnScreen.Thumb, (r) => shown.push(r), async () => {});

    expect(shown.length).toBe(1 + RETRY_MS.length);
  });

  it('una miniatura resta finché le immagini non sono pronte', async () => {
    const shown: Readiness[] = [];
    const { ready, settle } = pending();

    showStaged(() => ready, OnScreen.Thumb, (r) => shown.push(r));
    expect(shown).toEqual([]);

    settle(Readiness.Partial);
    await ready;

    expect(shown).toEqual([Readiness.Partial]);
  });
});

describe('VectorsSeen', () => {
  it('settles once, when every on-screen frame has shown its vectors', () => {
    const seen = new VectorsSeen();

    seen.presented('a');
    expect(seen.settle(['a', 'b'])).toBe(false);

    seen.presented('b');
    expect(seen.settle(['a', 'b'])).toBe(true);
    expect(seen.settle(['a', 'b'])).toBe(false);
  });
});

describe('shownBefore', () => {
  it('un frame già disegnato a un altro livello non ripassa dai soli vettori', () => {
    expect(shownBefore({ thumb: false, drawn: true })).toBe(OnScreen.Thumb);
  });

  it('un frame mai mostrato parte dai vettori', () => {
    expect(shownBefore({ thumb: false, drawn: false })).toBe(OnScreen.Nothing);
  });
});

describe('VectorsSeen.shownOf', () => {
  it('counts the given frames that already showed content', () => {
    const gate = new VectorsSeen();
    gate.presented('a');
    gate.presented('c');
    expect(gate.shownOf(['a', 'b', 'c'])).toBe(2);
  });
});
