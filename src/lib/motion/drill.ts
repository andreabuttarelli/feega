export enum Depth {
  Canvas = 'canvas',
  Frame = 'frame',
  Clip = 'clip',
  Part = 'part'
}

export enum Gesture {
  Click = 'click',
  Double = 'double',
  Deep = 'deep',
  Enter = 'enter',
  Leave = 'leave',
  Hover = 'hover'
}

export enum FramePress {
  Pick = 'pick',
  Move = 'move'
}

export enum Press {
  Pick = 'pick',
  MoveFrame = 'move-frame'
}

const PRESS: Record<Depth, Record<FramePress, Press>> = {
  [Depth.Canvas]: { [FramePress.Pick]: Press.Pick, [FramePress.Move]: Press.Pick },
  [Depth.Frame]: { [FramePress.Pick]: Press.Pick, [FramePress.Move]: Press.MoveFrame },
  [Depth.Clip]: { [FramePress.Pick]: Press.Pick, [FramePress.Move]: Press.Pick },
  [Depth.Part]: { [FramePress.Pick]: Press.Pick, [FramePress.Move]: Press.Pick }
};

export const pressOf = (depth: Depth, frame: FramePress): Press => PRESS[depth][frame];

export type Level = { depth: Depth; clip: string | null; part: string | null };

export type Probe = {
  top: string | null;
  picked: string | null;
  partOf: (clip: string) => string | null;
  firstClip: string | null;
  firstPart: (clip: string) => string | null;
  editable: (clip: string, part: string | null) => boolean;
};

export type Step = { level: Level; edit: boolean };

type Rule = (level: Level, probe: Probe) => Step;

const at = (depth: Depth, clip: string | null = null, part: string | null = null): Step => ({ level: { depth, clip, part }, edit: false });
const canvas = () => at(Depth.Canvas);
const frame = () => at(Depth.Frame);
const stay: Rule = (level) => ({ level, edit: false });
const clipOr = (clip: string | null) => (clip ? at(Depth.Clip, clip) : frame());

const childAt: Rule = (_level, p) => clipOr(p.top);
const pickedAt: Rule = (_level, p) => clipOr(p.picked);

const ownPart = (level: Level, p: Probe) => (level.clip && p.top === level.clip ? p.partOf(level.clip) : null);

const partOrPicked: Rule = (level, p) => {
  const part = ownPart(level, p);
  return part ? at(Depth.Part, level.clip, part) : pickedAt(level, p);
};

const innermost: Rule = (_level, p) => {
  const part = p.top ? p.partOf(p.top) : null;
  return part ? at(Depth.Part, p.top, part) : clipOr(p.top);
};

const editedText = (clip: string | null, p: Probe): Step | null => (clip && !p.firstPart(clip) && p.editable(clip, null) ? { level: { depth: Depth.Clip, clip, part: null }, edit: true } : null);

const innermostOrText: Rule = (level, p) => editedText(p.top, p) ?? innermost(level, p);

const editHere: Rule = (level, p) => ({ level, edit: !!level.clip && p.editable(level.clip, level.part) });

const intoPart: Rule = (level, p) => {
  if (p.top && p.top !== level.clip) {
    return childAt(level, p);
  }
  const part = ownPart(level, p);
  return part ? at(Depth.Part, level.clip, part) : editHere(level, p);
};

const pointed = (rule: Rule): Rule => (level, p) => (p.top ? rule(level, p) : stay(level, p));

const firstChild: Rule = (level, p) => (p.firstClip ? at(Depth.Clip, p.firstClip) : stay(level, p));

const firstPart: Rule = (level, p) => {
  const part = level.clip ? p.firstPart(level.clip) : null;
  return part ? at(Depth.Part, level.clip, part) : (editedText(level.clip, p) ?? stay(level, p));
};

const toClip: Rule = (level) => at(Depth.Clip, level.clip);

const CLICK: Record<Depth, Rule> = { [Depth.Canvas]: pickedAt, [Depth.Frame]: pickedAt, [Depth.Clip]: pickedAt, [Depth.Part]: partOrPicked };

export const DRILL: Record<Gesture, Record<Depth, Rule>> = {
  [Gesture.Click]: CLICK,
  [Gesture.Double]: { [Depth.Canvas]: pointed(innermostOrText), [Depth.Frame]: pointed(innermostOrText), [Depth.Clip]: pointed(intoPart), [Depth.Part]: editHere },
  [Gesture.Deep]: { [Depth.Canvas]: innermost, [Depth.Frame]: innermost, [Depth.Clip]: innermost, [Depth.Part]: innermost },
  [Gesture.Enter]: { [Depth.Canvas]: frame, [Depth.Frame]: firstChild, [Depth.Clip]: firstPart, [Depth.Part]: editHere },
  [Gesture.Leave]: { [Depth.Canvas]: canvas, [Depth.Frame]: canvas, [Depth.Clip]: frame, [Depth.Part]: toClip },
  [Gesture.Hover]: CLICK
};

export const drill = (level: Level, gesture: Gesture, probe: Probe): Step => DRILL[gesture][level.depth](level, probe);

export function depthOf(state: { open: boolean; clip: string | null; part: string | null }): Depth {
  if (!state.open) {
    return Depth.Canvas;
  }
  if (!state.clip) {
    return Depth.Frame;
  }
  return state.part ? Depth.Part : Depth.Clip;
}

export const levelOf = (state: { open: boolean; clip: string | null; part: string | null }): Level => ({ depth: depthOf(state), clip: state.clip, part: state.part });
