import { describe, expect, it } from 'vitest';
import { SourceSync } from './core/frame-header';
import { syncOf, linkedFrames, pushOutcomeOf, PushOutcome, editedFilesText } from './source-sync';

describe('la risposta di una spinta', () => {
  it('ogni rifiuto che il pannello sa gestire ha il suo esito', () => {
    expect(pushOutcomeOf({ ok: true })).toBe(PushOutcome.Pushed);
    expect(pushOutcomeOf({ ok: false, refusal: 'needs_confirm' })).toBe(PushOutcome.NeedsConfirm);
    expect(pushOutcomeOf({ ok: false, refusal: 'read_only' })).toBe(PushOutcome.ReadOnly);
    expect(pushOutcomeOf({ ok: false, refusal: 'secret' })).toBe(PushOutcome.Failed);
    expect(pushOutcomeOf(null)).toBe(PushOutcome.Failed);
  });

  it('chi legge soltanto scarica i file modificati in un testo solo', () => {
    expect(editedFilesText([{ path: 'a.tsx', content: 'A' }, { path: 'b.tsx', content: 'B' }])).toBe('--- a.tsx\nA\n\n--- b.tsx\nB');
  });
});

describe('lo stato GitHub di un frame', () => {
  it('ogni stato del server ha un’icona, uno sconosciuto nessuna', () => {
    expect(syncOf('conflict')).toEqual([SourceSync.Conflict]);
    expect(syncOf('access_lost')).toEqual([SourceSync.ReadOnly]);
    expect(syncOf('newer_upstream')).toEqual([SourceSync.Upstream]);
    expect(syncOf('in_pull')).toEqual([SourceSync.InPr]);
    expect(syncOf('in_sync')).toEqual([SourceSync.InSync]);
    expect(syncOf('boh')).toEqual([]);
  });

  it('si interrogano solo i frame importati da GitHub o da una cartella', () => {
    const nodes = [
      { id: 'a', data: { code: { kind: 'github' } } },
      { id: 'b', data: { code: { kind: 'upload' } } },
      { id: 'c', data: { code: { kind: 'folder' } } },
      { id: 'd', data: {} }
    ];

    expect(linkedFrames(nodes)).toEqual(['a', 'c']);
  });
});
