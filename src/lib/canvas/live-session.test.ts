import { describe, expect, it, vi } from 'vitest';
import { setProps } from '@feega/motion-core/motion/timeline';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { LIVE_CLIP } from './live-doc';
import type { LiveApi } from './live-edit-client';
import { LiveProp, type LiveEditBody, type LivePick, type LivePreview } from './live-fields';
import { liveSession } from './live-session';

const TITLE: LivePick = {
  source: 'src/routes/+page.svelte:12:3',
  rect: { x: 0, y: 0, width: 400, height: 48 },
  classes: 'text-primary',
  text: 'Chi Siamo',
  rem: 16,
  viewport: null,
  styles: { color: 'rgb(29, 53, 87)', 'font-size': '36px', 'font-weight': '600' }
};

function harness(refuse = false) {
  const edits: LiveEditBody[] = [];
  const shown: LivePreview[] = [];
  const failed: string[] = [];
  const api: LiveApi = {
    edit: async (body) => {
      edits.push(body);
      return refuse ? { ok: false, reason: 'class is not a literal' } : { ok: true, sha: 'abc' };
    },
    undo: async () => ({ ok: true, sha: 'def' })
  };
  const session = liveSession(TITLE, { api, preview: (p) => shown.push(p), stepped: () => undefined, failed: (r) => failed.push(r) });
  return { session, edits, shown, failed };
}

const recoloured = (doc: MotionDoc, color: string) => {
  const out = setProps(doc, LIVE_CLIP, { color });
  if (!out.ok) {
    throw new Error(out.error);
  }
  return out.doc;
};

describe('liveSession', () => {
  it('una modifica nell inspector si vede subito nella pagina e poi arriva al file', async () => {
    vi.useFakeTimers();
    const { session, edits, shown } = harness();

    session.recordEdit(recoloured(session.history.present, '#2563eb'), 'Colour');
    expect(shown.at(-1)).toEqual({ style: { color: '#2563eb' } });
    expect(edits).toEqual([]);

    await vi.runAllTimersAsync();
    expect(edits).toMatchObject([{ at: TITLE.source, prop: LiveProp.Color, value: '#2563eb', was: '#1d3557' }]);
    vi.useRealTimers();
  });

  it('annulla riscrive nel file il valore di prima', async () => {
    vi.useFakeTimers();
    const { session, edits } = harness();
    session.recordEdit(recoloured(session.history.present, '#2563eb'), 'Colour');
    await vi.runAllTimersAsync();

    session.undo();
    await vi.runAllTimersAsync();

    expect(edits.at(-1)).toMatchObject({ prop: LiveProp.Color, value: '#1d3557', was: '#2563eb' });
    vi.useRealTimers();
  });

  it('una scrittura rifiutata lo dice e riporta la pagina com era', async () => {
    vi.useFakeTimers();
    const { session, shown, failed } = harness(true);

    session.recordEdit(recoloured(session.history.present, '#2563eb'), 'Colour');
    await vi.runAllTimersAsync();

    expect(failed).toEqual(['class is not a literal']);
    expect(shown.at(-1)).toEqual({ style: { color: '#1d3557' } });
    vi.useRealTimers();
  });
});
