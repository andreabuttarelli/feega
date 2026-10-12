import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { PropFormat, VAR_PREFIX, paramVar, snakeKey, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { writeComponent } from '$lib/motion/custom/ops';
import { registerFont } from '$lib/motion/fonts/ops';
import { GOOGLE_FONTS } from '$lib/motion/fonts/catalogue';
import { declareVar, VarKind, type VarDecl } from '$lib/motion/interactive/vars';
import { addClip, setCanvas, type OpResult } from '$lib/motion/timeline';
import { exposeField, FieldType, type FieldInput } from './fields';

export type CustomTemplateSpec = {
  name: string;
  component: string;
  code: CustomComponent;
  props: Record<string, PropSpec>;
  fonts: readonly string[];
  varPrefix: string;
  vars: readonly string[];
  clip: string;
  seconds: number;
  fps: MotionDoc['fps'];
};

const GROUP: Record<NonNullable<PropSpec['group']>, string> = { Content: 'Text', Style: 'Style', Layout: 'Style', Motion: 'Motion', Camera: 'Motion' };

type FieldShape = Pick<FieldInput, 'type' | 'min' | 'max' | 'options'>;

function fieldShape(spec: PropSpec, fonts: readonly string[]): FieldShape {
  if (spec.format === PropFormat.Font) {
    return { type: FieldType.Select, options: [...fonts] };
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

function varOf(prefix: string, key: string, spec: PropSpec): VarDecl {
  const name = paramVar(prefix, key);
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

export const defaultsOf = (props: Record<string, PropSpec>): Record<string, unknown> => Object.fromEntries(Object.entries(props).map(([key, spec]) => [key, spec.default]));

export function customTemplateDoc(spec: CustomTemplateSpec): MotionDoc {
  const must = (result: OpResult): MotionDoc => {
    if (!result.ok) {
      throw new Error(`${spec.name}: ${result.error}`);
    }
    return result.doc;
  };
  const frames = spec.seconds * spec.fps;
  let doc = must(setCanvas({ ...newMotionDoc(MotionFormat.Landscape), fps: spec.fps }, { durationInFrames: frames }));
  for (const font of spec.fonts) {
    doc = must(registerFont(doc, font, GOOGLE_FONTS));
  }
  doc = must(writeComponent(doc, spec.component, spec.code));
  doc = must(addClip(doc, { component: 'Custom', from: 0, durationInFrames: frames, props: { name: spec.component, ...defaultsOf(spec.props) } }, spec.clip));
  for (const [key, prop] of Object.entries(spec.props).filter(([key]) => key !== VAR_PREFIX)) {
    doc = must(exposeField(doc, { key: snakeKey(key), label: prop.title ?? key, clipId: spec.clip, prop: key, group: GROUP[prop.group ?? 'Style'], ...fieldShape(prop, spec.fonts) }));
  }
  for (const key of spec.vars) {
    doc = must(declareVar(doc, varOf(spec.varPrefix, key, spec.props[key])));
  }
  return doc;
}
