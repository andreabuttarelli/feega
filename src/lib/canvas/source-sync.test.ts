import { describe, expect, it } from 'vitest';
import { SourceSync } from './core/frame-header';
import { syncOf, linkedFrames } from './source-sync';

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
