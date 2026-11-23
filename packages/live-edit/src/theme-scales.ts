import type { ReadFile } from './files';
import { liveTheme, type LiveTheme } from './live-tokens';
import { SPACING_STEPS } from './tailwind-property';

export type Step = { px: number; name: string };

export type Scales = { spacing: Step[]; radius: Step[]; fontSize: Step[] };

const FULL_RADIUS_PX = 9999;

const byPx = (a: Step, b: Step) => a.px - b.px;

const stepsOf = (scale: Map<number, string>): Step[] =>
  [...scale].filter(([px]) => px < FULL_RADIUS_PX).map(([px, name]) => ({ px, name })).sort(byPx);

export const scalesOf = (theme: LiveTheme): Scales => ({
  spacing: SPACING_STEPS.map((step) => ({ px: step * theme.spacingPx, name: String(step) })),
  radius: stepsOf(theme.radii),
  fontSize: stepsOf(theme.sizes)
});

export async function readScales(read: ReadFile): Promise<Scales> {
  return scalesOf(await liveTheme(read));
}
