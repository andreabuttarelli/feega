import { codePoints, rangeValues, shiftRuns, styledRange, type Range, type RangeValues, type RunEdit, type RunStyle, type TextRun } from '$lib/motion/text-runs';

export type RangeOpen = { clipId: string; text: string; runs: TextRun[]; base: RunStyle };

export class TextRange {
  clipId = $state<string | null>(null);
  text = $state('');
  runs = $state<TextRun[]>([]);
  range = $state<Range>({ start: 0, end: 0 });
  base = $state<RunStyle>({});

  get values(): RangeValues | null {
    return this.clipId && this.range.end > this.range.start ? rangeValues(this.runs, this.range, this.base, codePoints(this.text).length) : null;
  }

  open(at: RangeOpen) {
    this.clipId = at.clipId;
    this.text = at.text;
    this.runs = at.runs;
    this.base = at.base;
    this.range = { start: 0, end: 0 };
  }

  retype(text: string) {
    this.runs = shiftRuns(this.runs, this.text, text);
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

  close() {
    this.clipId = null;
  }
}

export const textRange = new TextRange();
