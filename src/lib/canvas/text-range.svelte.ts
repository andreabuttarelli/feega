import { indented, listedAt, listedParagraphs, shiftLists, touched, unlisted, type ListItem, type ListKind } from '@feega/motion-core/motion/text-lists';
import { codePoints, rangeValues, shiftRuns, styledRange, type Range, type RangeValues, type RunEdit, type RunStyle, type TextRun } from '@feega/motion-core/motion/text-runs';

export type RangeOpen = { clipId: string; text: string; runs: TextRun[]; lists?: ListItem[]; base: RunStyle };

export class TextRange {
  clipId = $state<string | null>(null);
  text = $state('');
  runs = $state<TextRun[]>([]);
  lists = $state<ListItem[]>([]);
  range = $state<Range>({ start: 0, end: 0 });
  base = $state<RunStyle>({});

  get values(): RangeValues | null {
    return this.clipId && this.range.end > this.range.start ? rangeValues(this.runs, this.range, this.base, codePoints(this.text).length) : null;
  }

  open(at: RangeOpen) {
    this.clipId = at.clipId;
    this.text = at.text;
    this.runs = at.runs;
    this.lists = at.lists ?? [];
    this.base = at.base;
    this.range = { start: 0, end: 0 };
  }

  retype(text: string) {
    this.runs = shiftRuns(this.runs, this.text, text);
    this.lists = shiftLists(this.lists, this.text, text);
    this.text = text;
  }

  select(range: Range) {
    this.range = range;
  }

  restyle(edit: RunEdit) {
    if (this.range.end <= this.range.start) {
      return;
    }
    this.runs = styledRange(this.runs, this.range, edit, codePoints(this.text).length);
  }

  get listed(): boolean {
    return listedAt(this.lists, touched(this.text, this.range)[0]) !== null;
  }

  get listKind(): ListKind | null {
    const kinds = new Set(touched(this.text, this.range).map((p) => listedAt(this.lists, p)?.kind ?? null));
    return kinds.size === 1 ? ([...kinds][0] ?? null) : null;
  }

  setList(kind: ListKind) {
    this.lists = listedParagraphs(this.lists, this.text, this.range, kind);
  }

  indent(by: 1 | -1) {
    this.lists = indented(this.lists, this.text, this.range, by);
  }

  unlist() {
    this.lists = unlisted(this.lists, this.text, this.range);
  }

  close() {
    this.clipId = null;
  }
}

export const textRange = new TextRange();
