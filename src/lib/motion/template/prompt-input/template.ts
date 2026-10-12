import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { PropFormat, VAR_PREFIX, paramVar, snakeKey, type PropSpec } from '$lib/motion/custom/component';
import { writeComponent } from '$lib/motion/custom/ops';
import { registerFont } from '$lib/motion/fonts/ops';
import { GOOGLE_FONTS } from '$lib/motion/fonts/catalogue';
import { declareVar, VarKind, type VarDecl } from '$lib/motion/interactive/vars';
import { addClip, setCanvas, type OpResult } from '$lib/motion/timeline';
import { BUILTIN_PREFIX } from '../design-kit';
import { exposeField, FieldType, type FieldInput } from '../fields';
import type { TemplateEntry } from '../library';
import { PROMPT_COMPONENT, PROMPT_FONTS, PROMPT_PROPS, PROMPT_VAR_PREFIX, promptComponent, promptDefaults } from './component';

export const PROMPT_TEMPLATE_ID = `${BUILTIN_PREFIX}prompt-input`;
export const PROMPT_CLIP = 'prompt';
export const PROMPT_VARS = ['text', 'placeholder', 'chips', 'buttonLabel', 'accent', 'theme', 'speed', 'typo', 'camera', 'cameraZoom'];

const PROMPT_KEY_FIELDS = ['text', 'buttonLabel', 'theme', 'accent'].map(snakeKey);

const SECONDS = 9;
const FPS = 30;
const UNEXPOSED = new Set([VAR_PREFIX]);

const GROUP: Record<NonNullable<PropSpec['group']>, string> = { Content: 'Text', Style: 'Style', Layout: 'Style', Motion: 'Motion', Camera: 'Motion' };

type FieldShape = Pick<FieldInput, 'type' | 'min' | 'max' | 'options'>;

function fieldShape(spec: PropSpec): FieldShape {
  if (spec.format === PropFormat.Font) {
    return { type: FieldType.Select, options: PROMPT_FONTS };
  }
  if (spec.enum) {
    return { type: FieldType.Select, options: spec.enum };
  }
  if (spec.format === PropFormat.Color) {
    return { type: FieldType.Color };
  }
  const plain: Record<PropSpec['type'], FieldShape> = {
    string: { type: FieldType.Text },
    number: { type: FieldType.Number, min: spec.minimum, max: spec.maximum },
    boolean: { type: FieldType.Boolean }
  };
  return plain[spec.type];
}

function varOf(key: string, spec: PropSpec): VarDecl {
  const name = paramVar(PROMPT_VAR_PREFIX, key);
  if (spec.enum) {
    return { name, kind: VarKind.Enum, default: String(spec.default), options: spec.enum };
  }
  if (spec.format === PropFormat.Color) {
    return { name, kind: VarKind.Color, default: String(spec.default) };
  }
  const plain: Record<PropSpec['type'], VarDecl> = {
    string: { name, kind: VarKind.String, default: String(spec.default) },
    number: { name, kind: VarKind.Number, default: Number(spec.default), min: spec.minimum ?? 0, max: spec.maximum ?? 1 },
    boolean: { name, kind: VarKind.Boolean, default: Boolean(spec.default) }
  };
  return plain[spec.type];
}

const must = (result: OpResult): MotionDoc => {
  if (!result.ok) {
    throw new Error(`prompt-input: ${result.error}`);
  }
  return result.doc;
};

function promptDoc(): MotionDoc {
  let doc = must(setCanvas({ ...newMotionDoc(MotionFormat.Landscape), fps: FPS }, { durationInFrames: SECONDS * FPS }));
  for (const font of PROMPT_FONTS) {
    doc = must(registerFont(doc, font, GOOGLE_FONTS));
  }
  doc = must(writeComponent(doc, PROMPT_COMPONENT, promptComponent()));
  doc = must(addClip(doc, { component: 'Custom', from: 0, durationInFrames: SECONDS * FPS, props: { name: PROMPT_COMPONENT, ...promptDefaults() } }, PROMPT_CLIP));
  for (const [key, spec] of Object.entries(PROMPT_PROPS).filter(([key]) => !UNEXPOSED.has(key))) {
    doc = must(exposeField(doc, { key: snakeKey(key), label: spec.title ?? key, clipId: PROMPT_CLIP, prop: key, group: GROUP[spec.group ?? 'Style'], ...fieldShape(spec) }));
  }
  for (const key of PROMPT_VARS) {
    doc = must(declareVar(doc, varOf(key, PROMPT_PROPS[key])));
  }
  return doc;
}

export const PROMPT_INPUT_TEMPLATE: TemplateEntry = {
  id: PROMPT_TEMPLATE_ID,
  template: {
    name: 'Prompt input',
    description: 'A prompt box types a request at a human pace, presses send and thinks.',
    keyFields: PROMPT_KEY_FIELDS,
    doc: promptDoc()
  }
};
