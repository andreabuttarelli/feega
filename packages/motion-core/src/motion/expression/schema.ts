import { z } from 'zod';
import { ValueKind, animProp, type Animated } from '../keyframes';
import { MAX_SOURCE, compileExpression } from './language';

export const expressionsSchema = z.record(z.string(), z.string().max(MAX_SOURCE)).default({});

export type Expressions = Record<string, string>;

export function expressionProblem(clip: Pick<Animated, 'component' | 'params'>, key: string, source: string): string | null {
  const prop = animProp(clip.component, key, clip.params);
  if (!prop) {
    return `${clip.component} cannot animate ${key}`;
  }
  if (prop.kind !== ValueKind.Number) {
    return `${key}: expressions drive number properties, not colours`;
  }
  const compiled = compileExpression(source);
  return compiled.ok ? null : `${key}: ${compiled.error}`;
}

export function expressionsProblem(clip: Pick<Animated, 'component' | 'params'> & { expressions: Expressions }): string | null {
  for (const [key, source] of Object.entries(clip.expressions)) {
    const problem = expressionProblem(clip, key, source);
    if (problem) {
      return problem;
    }
  }
  return null;
}
