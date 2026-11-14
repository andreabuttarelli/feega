import { CoreEvent } from '$lib/core-usage';

export const ACTIVATION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const ACTIVATION_OPEN = CoreEvent.CanvasOpened;
export const ACTIVATION_FRAME: ReadonlySet<string> = new Set([CoreEvent.FrameCreated, CoreEvent.FrameEdited]);
export const NORTH_STAR_EVENTS: ReadonlySet<string> = new Set([CoreEvent.ExportCompleted, CoreEvent.AgentAction]);

export type Occurrence = { event: string; at: number };

export function activated(signupAt: number, seen: readonly Occurrence[]): boolean {
  const inWindow = seen.filter((o) => o.at >= signupAt && o.at - signupAt <= ACTIVATION_WINDOW_MS);
  return inWindow.some((o) => o.event === ACTIVATION_OPEN) && inWindow.some((o) => ACTIVATION_FRAME.has(o.event));
}

export function northStarTeam(weekEvents: readonly string[]): boolean {
  return weekEvents.some((e) => NORTH_STAR_EVENTS.has(e));
}
