import type { ShaderParam } from '@feega/shader-fx';
import type { Measured } from '@feega/shader-fx/measure';
import { CheckState } from '$lib/server/repos/effects';

export const CHECK_BUDGET_MS = 60;
export const FLICKER_WARNING = 0.2;

export type GlPage = { run: <T>(script: string) => Promise<T> };

export type Check = { state: CheckState; problems: string[]; costMs: number | null };

export function verdictOf(measured: Measured): Check {
  const { problems, costMs, flicker } = measured;
  if (problems.length) {
    return { state: CheckState.Failed, problems, costMs };
  }
  if (costMs !== null && costMs > CHECK_BUDGET_MS) {
    return { state: CheckState.Failed, problems: [`${costMs.toFixed(1)} ms per 1080p frame, over the ${CHECK_BUDGET_MS} ms budget: fewer texture fetches or loop steps`], costMs };
  }

  const warnings = flicker !== null && flicker > FLICKER_WARNING ? [`warning: mean brightness jumps ${Math.round(flicker * 100)}% between frames; flicker this strong can trigger seizures`] : [];
  return { state: CheckState.Passed, problems: warnings, costMs };
}

export async function checkEffect(gl: GlPage, effect: { frag: string; params: ShaderParam[] }): Promise<Check> {
  const measured = await gl.run<Measured>(`window.__shaderFx.measure(${JSON.stringify({ frag: effect.frag, params: effect.params })})`).catch(() => null);
  return measured ? verdictOf(measured) : { state: CheckState.Unchecked, problems: [], costMs: null };
}
