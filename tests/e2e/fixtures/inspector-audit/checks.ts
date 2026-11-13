export enum Check {
  Missing = 'missing',
  Reach = 'reach',
  Name = 'name',
  Size = 'size',
  Commit = 'commit',
  Canvas = 'canvas',
  Undo = 'undo',
  Mixed = 'mixed',
  Throws = 'throws'
}

export enum Severity {
  Blocker = 'blocker',
  Major = 'major',
  Minor = 'minor'
}

export type Checks = { mouse: Check[]; keyboard: Check[] };

export type Known = { mouse?: Check[]; keyboard?: Check[]; unstable?: Partial<Checks>; severity: Severity; why: string; ref: string };
