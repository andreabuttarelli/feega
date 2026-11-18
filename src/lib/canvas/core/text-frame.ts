const DOC_TEXT = Symbol('doc text');

type HeldDoc = { text: string; doc?: unknown };

type Framed = { doc: unknown; assets: Record<string, string>; playhead?: number };

const heldOf = (source: object): HeldDoc | undefined => (source as { [DOC_TEXT]?: HeldDoc })[DOC_TEXT];

const fieldsOf = (source: object, without: readonly string[]): Record<string, unknown> => Object.fromEntries(Object.keys(source).filter((k) => !without.includes(k)).map((k) => [k, source[k as keyof typeof source]]));

const heldFrame = <F extends Framed>(fields: Record<string, unknown>, held: HeldDoc): F => Object.defineProperties({ ...fields }, { doc: { enumerable: true, get: () => (held.doc ??= JSON.parse(held.text)) }, [DOC_TEXT]: { value: held } }) as F;

export const textFrame = <F extends Framed>(fields: Omit<F, 'doc'>, text: string): F => heldFrame<F>(fields, { text });

export function withAssets<F extends Framed>(source: F, assets: Record<string, string>): F {
  const held = heldOf(source);
  return held ? heldFrame<F>({ ...fieldsOf(source, ['doc']), assets }, held) : { ...source, assets };
}

export function frameText(source: Framed): string {
  const held = heldOf(source);
  if (!held) {
    const { playhead: _playhead, ...rest } = source;
    return JSON.stringify(rest);
  }

  const rest = JSON.stringify(fieldsOf(source, ['doc', 'playhead']));
  return rest === '{}' ? `{"doc":${held.text}}` : `{"doc":${held.text},${rest.slice(1)}`;
}
