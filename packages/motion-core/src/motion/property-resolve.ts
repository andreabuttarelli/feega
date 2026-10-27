import type { MotionClip, MotionComp } from './doc';

export enum PropertyKind {
  Boolean = 'boolean',
  Text = 'text',
  Swap = 'swap',
  Nested = 'nested'
}

export type PropertyValue = string | boolean;
export type PropertyDef = { kind: PropertyKind; target: string; default?: PropertyValue; nested?: string; preferred?: string[] };
export type PropertyValues = Record<string, PropertyValue>;

const asked = (def: PropertyDef, value: PropertyValue, clip: MotionClip): Record<string, unknown> => {
  const byKind: Record<PropertyKind, () => Record<string, unknown>> = {
    [PropertyKind.Boolean]: () => ({ hidden: value === false }),
    [PropertyKind.Text]: () => ({ text: value }),
    [PropertyKind.Swap]: () => ({ comp: value }),
    [PropertyKind.Nested]: () => ({ propValues: { ...(clip.props.propValues as PropertyValues | undefined), [def.nested!]: value } })
  };
  return byKind[def.kind]();
};

export function propertyOverride(main: MotionComp['component'], values: PropertyValues | undefined, clip: MotionClip): Record<string, unknown> {
  const defs = (main?.properties ?? {}) as Record<string, PropertyDef>;
  return Object.entries(defs).reduce<Record<string, unknown>>((out, [key, def]) => {
    const value = values?.[key] ?? def.default;
    return def.target === clip.id && value !== undefined ? { ...out, ...asked(def, value, clip) } : out;
  }, {});
}
