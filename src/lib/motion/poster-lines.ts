import { firstImage, photoFills, type Fill } from './fill/model';

export const PHOTO_MARK = '[photo]';
export const ARROW_MARK = '->';
const MARKS = /(\[photo\]|->)/;
const MARKS_ALL = /\[photo\]|->/g;
const LINE_BREAK = '\n';
const IMAGE = 'image';

type Marked = { lines: string; media: string };

const MARKED_POSTERS: Record<string, Marked> = {
  TypeGridPoster: { lines: 'lines', media: 'media' }
};

export const markedPoster = (component: string): Marked | null => MARKED_POSTERS[component] ?? null;

export enum MarkedField {
  Lines = 'lines',
  Hidden = 'hidden',
  Plain = 'plain'
}

export function markedField(component: string, key: string): MarkedField {
  const marked = markedPoster(component);
  const role: Record<string, MarkedField> = marked ? { [marked.lines]: MarkedField.Lines, [marked.media]: MarkedField.Hidden } : {};
  return role[key] ?? MarkedField.Plain;
}

export type PhotoFit = 'cover' | 'contain';
export type PhotoLook = { fit?: PhotoFit; focusX?: number; focusY?: number };
export type MediaItem = {
  assetId: string;
  kind: 'image' | 'video';
  fills?: Fill[];
} & PhotoLook;
export type LineRow = { text: string; photos: number[]; arrow: boolean };

const bitsOf = (line: string) =>
  line
    .split(MARKS)
    .map((s) => s.trim())
    .filter(Boolean);

export const wordsOf = (line: string) =>
  bitsOf(line)
    .filter((b) => b !== PHOTO_MARK && b !== ARROW_MARK)
    .join(' ');

const photosIn = (line: string) => bitsOf(line).filter((b) => b === PHOTO_MARK).length;

export function lineRows(raw: string): LineRow[] {
  let next = 0;
  return raw.split(LINE_BREAK).map((line) => {
    const photos = Array.from({ length: photosIn(line) }, () => next++);
    return {
      text: wordsOf(line),
      photos,
      arrow: bitsOf(line).includes(ARROW_MARK)
    };
  });
}

const EMPTY_SLOT: MediaItem = { assetId: '', kind: IMAGE };

export function mediaItems(raw: unknown): MediaItem[] {
  if (Array.isArray(raw)) {
    return raw as MediaItem[];
  }
  return String(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((assetId) => ({ assetId, kind: IMAGE }));
}

function withWords(line: string, text: string): string {
  const words = text.replace(MARKS_ALL, ' ').replace(/\s+/g, ' ').trim();
  const bits = bitsOf(line);
  const first = bits.findIndex((b) => b !== PHOTO_MARK && b !== ARROW_MARK);
  const marks = bits.filter((b) => b === PHOTO_MARK || b === ARROW_MARK);
  const at = Math.max(first, 0);
  return [...marks.slice(0, at), words, ...marks.slice(at)].filter(Boolean).join(' ');
}

function withPhoto(line: string): string {
  const bits = bitsOf(line);
  const arrow = bits.lastIndexOf(ARROW_MARK);
  const at = arrow === bits.length - 1 ? arrow : bits.length;
  return [...bits.slice(0, at), PHOTO_MARK, ...bits.slice(at)].join(' ');
}

function withoutPhoto(line: string): string {
  const bits = bitsOf(line);
  const last = bits.lastIndexOf(PHOTO_MARK);
  return bits.filter((_, i) => i !== last).join(' ');
}

function withArrow(line: string): string {
  const bits = bitsOf(line);
  return bits.includes(ARROW_MARK) ? bits.filter((b) => b !== ARROW_MARK).join(' ') : [...bits, ARROW_MARK].join(' ');
}

export enum LineEdit {
  Text = 'text',
  AddPhoto = 'add-photo',
  RemovePhoto = 'remove-photo',
  Arrow = 'arrow',
  AddLine = 'add-line',
  RemoveLine = 'remove-line'
}

type Lines = { lines: string; media: MediaItem[] };
type LineOp = (lines: string[], i: number, rows: LineRow[], media: MediaItem[], text: string) => Lines;

const join = (lines: string[]) => lines.join(LINE_BREAK);
const replaced = (lines: string[], i: number, line: string) => lines.map((l, at) => (at === i ? line : l));
const firstPhotoAfter = (rows: LineRow[], i: number) => rows.slice(0, i + 1).reduce((n, r) => n + r.photos.length, 0);
const without = (media: MediaItem[], drop: readonly number[]) => media.filter((_, at) => !drop.includes(at));

const LINE_OPS: Record<LineEdit, LineOp> = {
  [LineEdit.Text]: (lines, i, _rows, media, text) => ({
    lines: join(replaced(lines, i, withWords(lines[i], text))),
    media
  }),
  [LineEdit.AddPhoto]: (lines, i, rows, media) => {
    const at = firstPhotoAfter(rows, i);
    return {
      lines: join(replaced(lines, i, withPhoto(lines[i]))),
      media: media.length > at ? [...media.slice(0, at), EMPTY_SLOT, ...media.slice(at)] : media
    };
  },
  [LineEdit.RemovePhoto]: (lines, i, rows, media) => ({
    lines: join(replaced(lines, i, withoutPhoto(lines[i]))),
    media: without(media, rows[i].photos.slice(-1))
  }),
  [LineEdit.Arrow]: (lines, i, _rows, media) => ({
    lines: join(replaced(lines, i, withArrow(lines[i]))),
    media
  }),
  [LineEdit.AddLine]: (lines, i, _rows, media) => ({
    lines: join([...lines.slice(0, i + 1), '', ...lines.slice(i + 1)]),
    media
  }),
  [LineEdit.RemoveLine]: (lines, i, rows, media) => ({
    lines: join(lines.filter((_, at) => at !== i)),
    media: without(media, rows[i].photos)
  })
};

export function editLines(current: { lines: string; media: unknown }, i: number, edit: LineEdit, text = ''): Lines {
  const lines = current.lines.split(LINE_BREAK);
  return LINE_OPS[edit](lines, i, lineRows(current.lines), mediaItems(current.media), text);
}

function withoutNthPhoto(line: string, nth: number): string {
  const bits = bitsOf(line);
  const at = bits.map((b, i) => (b === PHOTO_MARK ? i : -1)).filter((i) => i >= 0)[nth];
  return bits.filter((_, i) => i !== at).join(' ');
}

export function removePhoto(current: { lines: string; media: unknown }, n: number): Lines {
  const media = mediaItems(current.media);
  const lines = current.lines.split(LINE_BREAK);
  const owner = lineRows(current.lines).findIndex((r) => r.photos.includes(n));
  if (owner < 0) {
    return { lines: current.lines, media };
  }
  const nth = lineRows(current.lines)[owner].photos.indexOf(n);
  return { lines: join(replaced(lines, owner, withoutNthPhoto(lines[owner], nth))), media: without(media, [n]) };
}

const padded =(media: MediaItem[], n: number) => (media.length > n ? media : [...media, ...Array.from({ length: n + 1 - media.length }, () => EMPTY_SLOT)]);

export const photoAt = (media: unknown, n: number): MediaItem => mediaItems(media)[n] ?? EMPTY_SLOT;

export const setPhoto = (media: unknown, n: number, assetId: string): MediaItem[] => padded(mediaItems(media), n).map((m, at) => (at === n ? { ...m, assetId, kind: IMAGE } : m));

export const photoStack = (media: unknown, n: number): Fill[] => photoFills(photoAt(media, n));

export const setPhotoFills = (media: unknown, n: number, fills: Fill[]): MediaItem[] => padded(mediaItems(media), n).map((m, at) => (at === n ? { assetId: firstImage(fills)?.assetId ?? '', kind: IMAGE, fills } : m));

export const setPhotoLook = (media: unknown, n: number, look: PhotoLook): MediaItem[] => padded(mediaItems(media), n).map((m, at) => (at === n ? { ...m, ...look } : m));
