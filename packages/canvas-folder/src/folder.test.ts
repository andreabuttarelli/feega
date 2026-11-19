import { describe, expect, it } from 'vitest';
import { assetPath, canonicalJson, emptyFolder, fromFiles, remoteOnly, toFiles, type FolderDoc } from './index';

const doc: FolderDoc = {
  canvas: { canvasName: 'Launch', source: { projectId: 'p1', canvasId: 'c1' } },
  collections: {
    nodes: { b: { id: 'b', version: 2, data: { text: 'hi', color: '#fff' } }, a: { id: 'a', version: 1, data: {} } },
    connections: { k: { id: 'k', sourceNodeId: 'a', targetNodeId: 'b' } },
    media: { m: { id: 'm', sha256: 'abc', ext: 'png' } },
    codeLinks: {}
  },
  events: [{ id: 2 }, { id: 1 }],
  conflicts: []
};

describe('canonicalJson', () => {
  it('sorts keys at every depth and ends with one newline', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [{ z: 1, y: 2 }] } })).toBe('{\n  "a": {\n    "c": [\n      {\n        "y": 2,\n        "z": 1\n      }\n    ],\n    "d": 2\n  },\n  "b": 1\n}\n');
  });
});

describe('the .feega folder', () => {
  it('writes one file per node, connection and media row', () => {
    expect([...toFiles(doc).keys()]).toEqual(['canvas.json', 'conflicts.json', 'connections/k.json', 'events.json', 'media/m.json', 'nodes/a.json', 'nodes/b.json']);
  });

  it('writes the same bytes for the same document whatever the key order', () => {
    const shuffled: FolderDoc = { ...doc, collections: { ...doc.collections, nodes: { a: doc.collections.nodes.a, b: { data: { color: '#fff', text: 'hi' }, version: 2, id: 'b' } } } };

    expect([...toFiles(shuffled)]).toEqual([...toFiles(doc)]);
  });

  it('sorts events by id', () => {
    expect(JSON.parse(toFiles(doc).get('events.json')!)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('reads back what it wrote', () => {
    const read = fromFiles(toFiles(doc));

    expect(read.collections).toEqual(doc.collections);
    expect(read.canvas).toEqual(doc.canvas);
    expect(read.events).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('ignores files it does not own', () => {
    const files = toFiles(doc);
    files.set('assets/abc.png', 'binary');
    files.set('.gitignore', '.base/\n');

    expect(fromFiles(files)).toEqual(fromFiles(toFiles(doc)));
  });

  it('reads an empty folder as an empty document', () => {
    expect(fromFiles(new Map())).toEqual(emptyFolder());
  });
});

describe('assets in the folder', () => {
  it('live under assets/ named by their sha256, so the same bytes are stored once', () => {
    expect(assetPath({ sha256: 'ab12', ext: 'png' })).toBe('assets/ab12.png');
    expect(assetPath({ sha256: 'ab12', ext: '' })).toBe('assets/ab12');
  });

  it('are referenced from a media row by hash', () => {
    const files = toFiles({ ...emptyFolder(), collections: { ...emptyFolder().collections, media: { m: { id: 'm', sha256: 'ab12', ext: 'mp4', url: null } } } });

    expect(JSON.parse(files.get('media/m.json')!)).toEqual({ ext: 'mp4', id: 'm', sha256: 'ab12', url: null });
    expect(remoteOnly(fromFiles(files))).toEqual([]);
  });

  it('list the media rows that still point only at a remote url', () => {
    const doc = { ...emptyFolder(), collections: { ...emptyFolder().collections, media: { m: { id: 'm', url: 'https://x/y.png' }, n: { id: 'n', sha256: 'a', url: 'https://x/z.png' }, t: { id: 't', url: null, content: 'hi' } } } };

    expect(remoteOnly(doc).map((m) => m.id)).toEqual(['m']);
  });
});
