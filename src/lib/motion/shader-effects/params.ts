import { Source, ValueKind, type AnimProp } from '../keyframes';
import { SHADER_EFFECTS, animatedKeys, type ShaderEffectId } from './catalogue';

export function shaderEffectProps(clip: { component: string; props: Record<string, unknown> }): AnimProp[] {
  if (clip.component !== 'ShaderEffect') {
    return [];
  }

  const spec = SHADER_EFFECTS[clip.props.effect as ShaderEffectId];
  if (!spec) {
    return [];
  }

  return animatedKeys(spec).map((key) => {
    const number = spec.numbers[key];
    if (number) {
      return { key, label: number.label, kind: ValueKind.Number, source: Source.Param, min: number.min, max: number.max, step: number.step, fallback: number.fallback, base: Number(clip.props[key] ?? number.fallback) };
    }
    return { key, label: key, kind: ValueKind.Color, source: Source.Param, min: 0, max: 0, step: 0, fallback: 0, base: String(clip.props[key] ?? spec.colours[key]) };
  });
}
