import { VAR_PREFIX, paramVar } from '../custom/component';
import { interactiveOf, type Interactive } from './settings';
import { coerceVars, type VarDecl } from './var-model';

type Driving = { props: Record<string, unknown> };

const prefixOf = (clip: Driving) => (typeof clip.props[VAR_PREFIX] === 'string' && clip.props[VAR_PREFIX] ? (clip.props[VAR_PREFIX] as string) : null);

export function drivenVars<T extends { interactive?: Partial<Interactive> }>(doc: T, clips: readonly Driving[]): T {
  const driven = new Map(clips.flatMap((c) => {
    const own = prefixOf(c);
    return own ? Object.entries(c.props).map(([key, value]) => [paramVar(own, key), value] as const) : [];
  }));
  if (!driven.size) {
    return doc;
  }
  const mine = interactiveOf(doc);
  const vars = mine.vars.map((v) => {
    const value = coerceVars([v], { [v.name]: driven.get(v.name) })[v.name];
    return value === undefined ? v : ({ ...v, default: value } as VarDecl);
  });
  return { ...doc, interactive: { ...mine, vars } };
}
