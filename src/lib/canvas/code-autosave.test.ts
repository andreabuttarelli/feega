import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTOSAVE_IDLE_MS, AutosaveState, codeAutosave, outcomeOf } from './code-autosave';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const setup = (answer: AutosaveState = AutosaveState.Saved) => {
  const saves: string[][] = [];
  const states: AutosaveState[] = [];
  const autosave = codeAutosave({
    save: async (ids) => {
      saves.push(ids);
      return answer;
    },
    onstate: (s) => states.push(s)
  });
  return { autosave, saves, states };
};

describe('autosave del codice', () => {
  it('molte modifiche di fila diventano un solo salvataggio dopo la pausa', async () => {
    const { autosave, saves } = setup();

    for (let i = 0; i < 30; i++) {
      autosave.touch('f1');
      await vi.advanceTimersByTimeAsync(100);
    }
    autosave.touch('f2');
    expect(saves).toEqual([]);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_IDLE_MS);

    expect(saves).toEqual([['f1', 'f2']]);
  });

  it('dice pending, saving, poi saved', async () => {
    const { autosave, states } = setup();

    autosave.touch('f1');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_IDLE_MS);

    expect(states).toEqual([AutosaveState.Pending, AutosaveState.Saving, AutosaveState.Saved]);
  });

  it('una modifica durante il salvataggio parte nel lotto dopo, mai in parallelo', async () => {
    let release: () => void = () => {};
    const saves: string[][] = [];
    const autosave = codeAutosave({
      save: (ids) => {
        saves.push(ids);
        return new Promise((done) => (release = () => done(AutosaveState.Saved)));
      },
      onstate: () => {}
    });

    autosave.touch('f1');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_IDLE_MS);
    autosave.touch('f2');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_IDLE_MS * 2);
    expect(saves).toEqual([['f1']]);

    release();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_IDLE_MS);

    expect(saves).toEqual([['f1'], ['f2']]);
  });

  it('un conflitto ferma l’autosave finché non lo si riprende', async () => {
    const { autosave, saves } = setup(AutosaveState.Conflict);

    autosave.touch('f1');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_IDLE_MS);
    autosave.touch('f1');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_IDLE_MS);

    expect(saves).toEqual([['f1']]);
    autosave.resume();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_IDLE_MS);
    expect(saves).toEqual([['f1'], ['f1']]);
  });

  it('senza ramo scelto le modifiche restano in attesa e partono quando lo si sceglie', async () => {
    let answer = AutosaveState.NeedsBranch;
    const saves: string[][] = [];
    const autosave = codeAutosave({
      save: async (ids) => {
        saves.push(ids);
        return answer;
      },
      onstate: () => {}
    });

    autosave.touch('f1');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_IDLE_MS);
    autosave.touch('f2');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_IDLE_MS);
    expect(saves).toEqual([['f1']]);

    answer = AutosaveState.Saved;
    autosave.resume();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_IDLE_MS);
    expect(saves).toEqual([['f1'], ['f1', 'f2']]);
  });

  it('la risposta del server diventa uno stato', () => {
    expect(outcomeOf({ ok: true })).toBe(AutosaveState.Saved);
    expect(outcomeOf({ ok: false, refusal: 'diverged' })).toBe(AutosaveState.Conflict);
    expect(outcomeOf({ ok: false, refusal: 'branch_gone' })).toBe(AutosaveState.Conflict);
    expect(outcomeOf({ ok: false, refusal: 'no_files' })).toBe(AutosaveState.Saved);
    expect(outcomeOf({ ok: false, refusal: 'needs_confirm' })).toBe(AutosaveState.Paused);
    expect(outcomeOf({ ok: false, refusal: 'no_branch' })).toBe(AutosaveState.NeedsBranch);
    expect(outcomeOf(null)).toBe(AutosaveState.Failed);
  });
});
