export enum BriefPhase {
  Idle = 'idle',
  Creating = 'creating',
  Opening = 'opening'
}

const PROGRESS: Record<BriefPhase, string> = {
  [BriefPhase.Idle]: '',
  [BriefPhase.Creating]: 'creating your project…',
  [BriefPhase.Opening]: 'opening the editor…'
};

export function briefProgress(phase: BriefPhase): string {
  return PROGRESS[phase];
}

export function briefPhaseAfter(result: string): BriefPhase {
  return result === 'redirect' ? BriefPhase.Opening : BriefPhase.Idle;
}
