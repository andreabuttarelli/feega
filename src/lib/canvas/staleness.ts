export enum Remote {
  Live = 'live',
  CanvasGone = 'canvas_gone',
  ProjectGone = 'project_gone'
}

export type RemoteState =
  | { kind: Remote.Live; revision: string }
  | { kind: Remote.CanvasGone }
  | { kind: Remote.ProjectGone };

export enum Trigger {
  Return = 'return',
  Online = 'online',
  Reconnect = 'reconnect',
  AppUpdated = 'app_updated'
}

export enum Verdict {
  Resync = 'resync',
  LeaveCanvas = 'leave_canvas',
  LeaveProject = 'leave_project',
  OfferReload = 'offer_reload'
}

export type StaleCheck = { seen: string; remote: RemoteState; trigger: Trigger; appUpdated: boolean };

type Rule = { when: (check: StaleCheck) => boolean; verdict: Verdict; final?: true };

const isNewer = (check: StaleCheck) => check.remote.kind === Remote.Live && check.remote.revision !== check.seen;

const RULES: Rule[] = [
  { when: (c) => c.remote.kind === Remote.ProjectGone, verdict: Verdict.LeaveProject, final: true },
  { when: (c) => c.remote.kind === Remote.CanvasGone, verdict: Verdict.LeaveCanvas, final: true },
  { when: (c) => isNewer(c) || c.trigger === Trigger.Online, verdict: Verdict.Resync },
  { when: (c) => c.appUpdated, verdict: Verdict.OfferReload }
];

export function judge(check: StaleCheck): Verdict[] {
  const verdicts: Verdict[] = [];
  for (const rule of RULES) {
    if (!rule.when(check)) {
      continue;
    }
    verdicts.push(rule.verdict);
    if (rule.final) {
      return verdicts;
    }
  }
  return verdicts;
}

export const VERDICT_NOTICE: Record<Verdict, string> = {
  [Verdict.Resync]: 'This canvas was updated elsewhere — refreshed.',
  [Verdict.LeaveCanvas]: 'This canvas was deleted elsewhere. You are on another canvas of the project.',
  [Verdict.LeaveProject]: 'This project was deleted elsewhere. You are back to your projects.',
  [Verdict.OfferReload]: 'A new version of feega is available.'
};

export const DROPPED_EDIT_NOTICE = 'A node you were editing was deleted elsewhere: your unsent change to it was discarded.';

type Placed = { id: string; version: number; x: number; y: number };

const fingerprint = (tile: Placed) => `${tile.id}:${tile.version}:${tile.x}:${tile.y}`;

export function changedElsewhere(before: Placed[], after: Placed[]): boolean {
  if (before.length !== after.length) {
    return true;
  }
  const known = new Set(before.map(fingerprint));
  return after.some((tile) => !known.has(fingerprint(tile)));
}

let carried: string | null = null;

export function carryNotice(notice: string) {
  carried = notice;
}

export function takeNotice(): string | null {
  const notice = carried;
  carried = null;
  return notice;
}
