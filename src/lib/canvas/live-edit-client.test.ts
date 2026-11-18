import { describe, expect, it } from 'vitest';
import { LIVE_FIELDS, pickOf } from './live-fields';
import { editLive, type LiveApi } from './live-edit-client';

const pick = pickOf({ source: { file: 'app/Hero.tsx', line: 6, col: 7 }, styles: { color: 'rgb(0, 0, 0)' }, text: 'Ship faster' })!;
const colour = LIVE_FIELDS.find((f) => f.key === 'color')!;

function api(fail = false) {
  const calls: string[] = [];
  const gate: { open: () => void } = { open: () => undefined };
  const held = new Promise<void>((resolve) => (gate.open = resolve));
  const fake: LiveApi = {
    edit: async (body) => {
      calls.push(`edit ${body.value}`);
      await held;
      return fail ? { ok: false, reason: 'class is not a literal' } : { ok: true, sha: 'abc' };
    },
    undo: async (sha) => {
      calls.push(`undo ${sha}`);
      return { ok: true, sha: 'def' };
    }
  };
  return { fake, calls, gate };
}

describe('editLive', () => {
  it('mostra il cambiamento prima che il server risponda', async () => {
    const { fake, gate } = api();
    const shown: unknown[] = [];

    const done = editLive(fake, pick, colour, '#ff0000', (p) => shown.push(p));

    expect(shown).toEqual([{ style: { color: '#ff0000' } }]);
    gate.open();
    expect((await done).ok).toBe(true);
  });

  it('se la scrittura fallisce torna al valore di prima e dice perché', async () => {
    const { fake, gate } = api(true);
    const shown: unknown[] = [];

    const done = editLive(fake, pick, colour, '#ff0000', (p) => shown.push(p));
    gate.open();
    const out = await done;

    expect(out).toMatchObject({ ok: false, reason: 'class is not a literal' });
    expect(shown.at(-1)).toEqual({ style: { color: 'rgb(0, 0, 0)' } });
  });

  it('il passo di undo annulla il commit e rifà la modifica', async () => {
    const { fake, calls, gate } = api();
    gate.open();
    const shown: unknown[] = [];

    const out = await editLive(fake, pick, colour, '#ff0000', (p) => shown.push(p));
    if (!out.ok) {
      throw new Error('refused');
    }
    out.step.back();
    await Promise.resolve();
    out.step.forward();
    await new Promise((r) => setTimeout(r));

    expect(calls).toEqual(['edit #ff0000', 'undo abc', 'edit #ff0000']);
    expect(shown).toEqual([{ style: { color: '#ff0000' } }, { style: { color: 'rgb(0, 0, 0)' } }, { style: { color: '#ff0000' } }]);
  });
});
