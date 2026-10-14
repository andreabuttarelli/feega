export enum SegmentIcon {
  AlignLeft = 'align-left',
  AlignCenter = 'align-center',
  AlignRight = 'align-right'
}

export type Segment = { value: string; label: string; icon: SegmentIcon | null };

const SEGMENTS: Record<string, Record<string, Omit<Segment, 'value'>>> = {
  align: {
    left: { label: 'Align left', icon: SegmentIcon.AlignLeft },
    center: { label: 'Align centre', icon: SegmentIcon.AlignCenter },
    right: { label: 'Align right', icon: SegmentIcon.AlignRight }
  },
  fit: {
    cover: { label: 'Cover', icon: null },
    contain: { label: 'Contain', icon: null }
  },
  textCase: {
    'as-typed': { label: 'As typed', icon: null },
    upper: { label: 'AA', icon: null },
    lower: { label: 'aa', icon: null }
  }
};

export const hasSegments = (key: string): boolean => SEGMENTS[key] !== undefined;

export function segmentsOf(key: string, options: readonly string[]): Segment[] {
  const known = SEGMENTS[key] ?? {};
  return options.map((value) => ({ value, label: known[value]?.label ?? value, icon: known[value]?.icon ?? null }));
}

export enum Answer {
  Yes = 'yes',
  No = 'no'
}

export const YES_NO: Segment[] = [
  { value: Answer.Yes, label: 'Yes', icon: null },
  { value: Answer.No, label: 'No', icon: null }
];

export const answerOf = (value: unknown): Answer => (value === true ? Answer.Yes : Answer.No);
