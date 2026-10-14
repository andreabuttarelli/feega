import { describe, expect, it } from 'vitest';
import { LineEdit, MarkedField, markedField, editLines, lineRows, markedPoster, photoAt, setPhoto, setPhotoLook, wordsOf } from './poster-lines';

const LINES = ['STUDIO', 'NAME [photo]', 'SPACE [photo]', 'SESSION', '01 [photo] ->'].join('\n');
const A = { assetId: 'a', kind: 'image' as const };
const B = { assetId: 'b', kind: 'image' as const };

describe('marked poster lines read as a structured list', () => {
  it('each line shows its words, its photos and its arrow, never the markers', () => {
    expect(lineRows(LINES)).toEqual([
      { text: 'STUDIO', photos: [], arrow: false },
      { text: 'NAME', photos: [0], arrow: false },
      { text: 'SPACE', photos: [1], arrow: false },
      { text: 'SESSION', photos: [], arrow: false },
      { text: '01', photos: [2], arrow: true }
    ]);
    expect(wordsOf('01 [photo] ->')).toBe('01');
  });

  it('only the type grid poster carries markers', () => {
    expect(markedPoster('TypeGridPoster')).toEqual({
      lines: 'lines',
      media: 'media'
    });
    expect(markedPoster('CheckerStepsPoster')).toBeNull();
  });

  it('the poster panel edits the lines as a list and the pictures only through their photo parts', () => {
    expect(markedField('TypeGridPoster', 'lines')).toBe(MarkedField.Lines);
    expect(markedField('TypeGridPoster', 'media')).toBe(MarkedField.Hidden);
    expect(markedField('TypeGridPoster', 'issue')).toBe(MarkedField.Plain);
    expect(markedField('CheckerStepsPoster', 'lines')).toBe(MarkedField.Plain);
  });
});

describe('editing a line keeps the storage format and the photos in step', () => {
  it('new text replaces the words and keeps photo and arrow in place', () => {
    const next = editLines({ lines: LINES, media: [A, B] }, 4, LineEdit.Text, 'TWO');
    expect(next.lines.split('\n')[4]).toBe('TWO [photo] ->');
  });

  it('typed markers are words, not photos', () => {
    const next = editLines({ lines: LINES, media: [] }, 0, LineEdit.Text, 'A [photo] -> B');
    expect(lineRows(next.lines)[0]).toEqual({
      text: 'A B',
      photos: [],
      arrow: false
    });
  });

  it('adding a photo opens an empty slot at its place in the media order', () => {
    const next = editLines({ lines: LINES, media: [A, B] }, 0, LineEdit.AddPhoto);
    expect(next.lines.split('\n')[0]).toBe('STUDIO [photo]');
    expect(next.media).toEqual([{ assetId: '', kind: 'image' }, A, B]);
  });

  it('a photo goes before the arrow', () => {
    const next = editLines({ lines: LINES, media: [] }, 4, LineEdit.AddPhoto);
    expect(next.lines.split('\n')[4]).toBe('01 [photo] [photo] ->');
  });

  it('removing a photo drops its picture so the later ones keep theirs', () => {
    const next = editLines({ lines: LINES, media: [A, B] }, 1, LineEdit.RemovePhoto);
    expect(next.lines.split('\n')[1]).toBe('NAME');
    expect(next.media).toEqual([B]);
  });

  it('the arrow toggles', () => {
    expect(editLines({ lines: LINES, media: [] }, 4, LineEdit.Arrow).lines.split('\n')[4]).toBe('01 [photo]');
    expect(editLines({ lines: LINES, media: [] }, 0, LineEdit.Arrow).lines.split('\n')[0]).toBe('STUDIO ->');
  });

  it('lines are added and removed', () => {
    expect(editLines({ lines: LINES, media: [] }, 4, LineEdit.AddLine).lines.split('\n')).toHaveLength(6);
    const gone = editLines({ lines: LINES, media: [A, B] }, 1, LineEdit.RemoveLine);
    expect(gone.lines.split('\n')).toEqual(['STUDIO', 'SPACE [photo]', 'SESSION', '01 [photo] ->']);
    expect(gone.media).toEqual([B]);
  });

  it('legacy comma lists become media items', () => {
    expect(editLines({ lines: LINES, media: 'a, b' }, 0, LineEdit.Arrow).media).toEqual([A, B]);
  });
});

describe('a photo slot', () => {
  it('is replaced in place, filling the empty slots before it', () => {
    expect(setPhoto([], 2, 'x')).toEqual([
      { assetId: '', kind: 'image' },
      { assetId: '', kind: 'image' },
      { assetId: 'x', kind: 'image' }
    ]);
    expect(setPhoto([A, B], 0, 'x')).toEqual([{ assetId: 'x', kind: 'image' }, B]);
  });

  it('keeps its fit and focus', () => {
    const fitted = setPhotoLook([A], 0, { fit: 'contain', focusX: 0.2 });
    expect(photoAt(fitted, 0)).toEqual({
      assetId: 'a',
      kind: 'image',
      fit: 'contain',
      focusX: 0.2
    });
    expect(photoAt(setPhoto(fitted, 0, 'z'), 0)).toEqual({
      assetId: 'z',
      kind: 'image',
      fit: 'contain',
      focusX: 0.2
    });
  });
});
