import type { ComponentId } from './components';
import type { MotionDoc } from './doc';
import { BuiltinFont, FontCategory } from './fonts/model';
import { FontClass, LetterCase, LookMiss, TypeRole, type ReferenceLook, type TypeSpec } from './reference-look-model';

export type TypeProblem = { miss: LookMiss; detail: string };

type Clip = MotionDoc['tracks'][number]['clips'][number];

const TEXTS: ReadonlySet<ComponentId> = new Set(['Title', 'Text', 'Kicker', 'Caption'] as ComponentId[]);
const WEIGHT_SLACK = 100;
const WEIGHT_GROSS = 300;
const TRACKING_SLACK = 0.02;
const LEADING_SLACK = 0.1;
const CONDENSED_WIDTH = 85;
const THIN_RULE = 0.012;
const DEFAULT_WEIGHT: Partial<Record<ComponentId, number>> = { Title: 600 };
const CONDENSED = /condensed|narrow|compressed|bebas|anton|oswald|league gothic|fjalla|teko|big shoulders|six caps|antonio/i;

const CATEGORY_CLASS: Record<FontCategory, FontClass> = {
  [FontCategory.Sans]: FontClass.Grotesk,
  [FontCategory.Serif]: FontClass.Serif,
  [FontCategory.Display]: FontClass.Display,
  [FontCategory.Handwriting]: FontClass.Script,
  [FontCategory.Mono]: FontClass.Mono
};

const BUILTIN_CLASS: Record<BuiltinFont, FontClass> = { [BuiltinFont.Sans]: FontClass.Grotesk, [BuiltinFont.Mono]: FontClass.Mono };

const prop = (clip: Clip, key: string) => (clip.props as Record<string, unknown>)[key];
const num = (clip: Clip, key: string, fallback: number) => {
  const v = prop(clip, key);
  return typeof v === 'number' ? v : fallback;
};

function fontClass(clip: Clip, doc: MotionDoc): FontClass {
  const family = String(prop(clip, 'font') ?? BuiltinFont.Sans);
  if (CONDENSED.test(family) || num(clip, 'stretch', 100) <= CONDENSED_WIDTH) {
    return FontClass.Condensed;
  }
  const builtin = BUILTIN_CLASS[family as BuiltinFont];
  if (builtin) {
    return builtin;
  }
  const face = doc.fonts.find((f) => f.family === family);
  return face ? CATEGORY_CLASS[face.category] : FontClass.Grotesk;
}

function letterCase(clip: Clip): LetterCase {
  const declared = clip.component === 'Kicker' ? 'upper' : prop(clip, 'textCase');
  if (declared === 'upper') {
    return LetterCase.Upper;
  }
  if (declared === 'lower') {
    return LetterCase.Lower;
  }
  const text = String(prop(clip, 'text') ?? '');
  if (text === text.toUpperCase() && text !== text.toLowerCase()) {
    return LetterCase.Upper;
  }
  return text === text.toLowerCase() ? LetterCase.Lower : LetterCase.Mixed;
}

const nearest = (size: number, roles: readonly TypeSpec[]) =>
  roles.reduce((best, r) => (Math.abs(Math.log(r.size / size)) < Math.abs(Math.log(best.size / size)) ? r : best));

const quote = (clip: Clip) => `${clip.id} ("${String(prop(clip, 'text') ?? '').split('\n')[0]}")`;

function weight(clip: Clip, spec: TypeSpec): TypeProblem[] {
  const w = num(clip, 'weight', DEFAULT_WEIGHT[clip.component] ?? 400);
  const off = Math.abs(w - spec.weight);
  if (off <= WEIGHT_SLACK) {
    return [];
  }
  const miss = off >= WEIGHT_GROSS ? LookMiss.TypeWeightGross : LookMiss.TypeWeight;
  return [{ miss, detail: `${quote(clip)} is weight ${w}, the references set the ${spec.role} at ${spec.weight}: set weight ${spec.weight}` }];
}

function family(clip: Clip, spec: TypeSpec, doc: MotionDoc): TypeProblem[] {
  const found = fontClass(clip, doc);
  if (found === spec.font) {
    return [];
  }
  const miss = spec.role === TypeRole.Display ? LookMiss.TypeFamily : LookMiss.TypeFamilySmall;
  return [{ miss, detail: `${quote(clip)} is set in a ${found} face, the references set the ${spec.role} in a ${spec.font} one: register_font and set_font ${spec.fonts.join(' or ')}` }];
}

function tracking(clip: Clip, spec: TypeSpec): TypeProblem[] {
  const t = num(clip, 'tracking', 0);
  if (Math.abs(t - spec.tracking) <= TRACKING_SLACK) {
    return [];
  }
  return [{ miss: LookMiss.TypeTracking, detail: `${quote(clip)} has tracking ${t}em, the references set the ${spec.role} at ${spec.tracking}em: set tracking ${spec.tracking}` }];
}

function leading(clip: Clip, spec: TypeSpec): TypeProblem[] {
  const l = num(clip, 'leading', 1.2);
  const lines = String(prop(clip, 'text') ?? '').split('\n').length;
  if (lines < 2 || Math.abs(l - spec.leading) <= LEADING_SLACK) {
    return [];
  }
  return [{ miss: LookMiss.TypeLeading, detail: `${quote(clip)} has line height ${l}, the references set the ${spec.role} at ${spec.leading}: set leading ${spec.leading}` }];
}

function letters(clip: Clip, spec: TypeSpec): TypeProblem[] {
  const found = letterCase(clip);
  if (found === spec.case) {
    return [];
  }
  return [{ miss: LookMiss.TypeCase, detail: `${quote(clip)} is ${found} case, the references set the ${spec.role} in ${spec.case} case: retype it or set textCase` }];
}

function rules(clips: readonly Clip[], look: ReferenceLook): TypeProblem[] {
  if (!look.rules?.count) {
    return [];
  }
  const thin = clips.filter((c) => c.component === 'Shape' && Math.min(num(c, 'width', 1), num(c, 'height', 1)) <= THIN_RULE).length;
  if (thin > 0) {
    return [];
  }
  return [{ miss: LookMiss.Rules, detail: `the references draw ${look.rules.count} hairline rule(s) ${look.rules.thickness} of the frame height thick and the video has none: add Shape rects that thin, hung on the grid` }];
}

export function typeProblems(doc: MotionDoc, clips: readonly Clip[], look: ReferenceLook): TypeProblem[] {
  const roles = look.type ?? [];
  const texts = clips.filter((c) => TEXTS.has(c.component));
  const assigned = roles.length ? texts.map((clip) => ({ clip, spec: nearest(num(clip, 'size', 0.1), roles) })) : [];
  const perClip = assigned.flatMap(({ clip, spec }) => [...family(clip, spec, doc), ...weight(clip, spec), ...tracking(clip, spec), ...leading(clip, spec), ...letters(clip, spec)]);
  const missing = roles
    .filter((r) => !assigned.some((a) => a.spec === r))
    .map((r) => ({ miss: LookMiss.TypeRoleMissing, detail: `the references set a ${r.role} role (${r.font}, weight ${r.weight}, size ${r.size} of the frame height) and no text here is set at that size: add it` }));
  return [...perClip, ...missing, ...rules(clips, look)];
}
