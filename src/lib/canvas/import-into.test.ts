import { describe, expect, it, vi } from 'vitest';
import { clipsOf, type MotionDoc } from '@feega/motion-core/motion/doc';
import { importCodeAt } from '$lib/server/code-import/import-code';
import { askOf } from '$lib/server/code-import/code-import.testkit';
import { landImport, LandOutcome, type Landing } from './import-into';

async function imported(routes: string[]): Promise<MotionDoc> {
  const { ask, docs } = askOf({ routes });
  await importCodeAt(ask);
  return docs.get('frame-1')!.doc as MotionDoc;
}

const LOCAL = await imported(['/', '/settings']);
const PIECE = await imported(['/pricing']);
const MAP = { pages: [{ path: '/', state: 'imported' as never, boards: [{ cond: 'light@1280', clip: 'n2' }] }] };

function sessionOf(doc: MotionDoc) {
  const shown: MotionDoc[] = [];
  const session = {
    history: { present: doc },
    showPending: vi.fn((next: MotionDoc) => (shown.push(next), (session.history = { present: next }))),
    edit: vi.fn((next: MotionDoc) => (session.history = { present: next }))
  };
  return { session, shown };
}

const counter = () => {
  let n = 0;
  return () => `p${++n}`;
};

describe('landing an import into the open frame', () => {
  it('shows a placeholder board at once, before the server answers', async () => {
    const { session, shown } = sessionOf(LOCAL);
    let answer: (a: Landing) => void = () => {};
    const pending = landImport(session, { label: '/pricing', map: MAP, size: { width: 1280, height: 800 }, newId: counter(), fetch: () => new Promise((resolve) => (answer = resolve)) });

    expect(shown).toHaveLength(1);
    expect(clipsOf(shown[0]).some((c) => c.name === 'Importing /pricing…')).toBe(true);
    answer({ ok: false, error: 'failed' });
    await pending;
  });

  it('swaps the placeholder for the real board as one undo step whose before is the frame without it', async () => {
    const { session } = sessionOf(LOCAL);

    const out = await landImport(session, { label: '/pricing', map: MAP, size: { width: 1280, height: 800 }, newId: counter(), fetch: async () => ({ ok: true, piece: PIECE, boards: ['n1'], parent: 'n1' }) });

    expect(out.outcome).toBe(LandOutcome.Landed);
    expect(session.edit).toHaveBeenCalledTimes(1);
    expect(session.showPending.mock.calls.at(-1)![0]).toBe(LOCAL);
    expect(clipsOf(session.history.present).some((c) => c.name?.startsWith('Importing'))).toBe(false);
    expect(clipsOf(session.history.present).filter((c) => c.parent === 'n1')).toHaveLength(3);
  });

  it('takes the placeholder away and says why when the import fails, with no undo step', async () => {
    const { session } = sessionOf(LOCAL);

    const out = await landImport(session, { label: '/pricing', map: MAP, size: { width: 1280, height: 800 }, newId: counter(), fetch: async () => ({ ok: false, error: 'run_failed', detail: 'the dev server did not answer' }) });

    expect(out).toEqual({ outcome: LandOutcome.Failed, error: 'run_failed', detail: 'the dev server did not answer' });
    expect(session.history.present).toBe(LOCAL);
    expect(session.edit).not.toHaveBeenCalled();
  });

  it('keeps an edit made on another board while the import ran', async () => {
    const { session } = sessionOf(LOCAL);
    const fetch = async () => {
      const now = session.history.present;
      session.history = { present: { ...now, tracks: now.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'n17' ? { ...c, name: 'Settings (edited)' } : c)) })) } };
      return { ok: true as const, piece: PIECE, boards: ['n1'], parent: 'n1' };
    };

    await landImport(session, { label: '/pricing', map: MAP, size: { width: 1280, height: 800 }, newId: counter(), fetch });

    expect(clipsOf(session.history.present).find((c) => c.id === 'n17')?.name).toBe('Settings (edited)');
    expect(clipsOf(session.history.present).some((c) => c.name?.startsWith('Importing'))).toBe(false);
  });

  it('refuses at once, with no request, when the frame has no room for the placeholder', async () => {
    const { session } = sessionOf({ ...LOCAL, height: 16_300 });
    const fetch = vi.fn();

    const out = await landImport(session, { label: '/pricing', map: MAP, size: { width: 1280, height: 800 }, newId: counter(), fetch });

    expect(out.outcome).toBe(LandOutcome.Full);
    expect(fetch).not.toHaveBeenCalled();
  });
});
