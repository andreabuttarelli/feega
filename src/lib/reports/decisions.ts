export enum Decision {
  Dismiss = 'dismiss',
  Remove = 'remove',
  Suspend = 'suspend',
  Restore = 'restore'
}

export enum ReportStatus {
  Open = 'open',
  Dismissed = 'dismissed',
  Actioned = 'actioned',
  CounterNoticed = 'counter_noticed',
  Restored = 'restored'
}

export enum ContentAction {
  Keep = 'keep',
  Remove = 'remove',
  Restore = 'restore'
}

export enum StrikeAction {
  None = 'none',
  Add = 'add',
  Revoke = 'revoke'
}

export enum AccountAction {
  ByStrikes = 'by_strikes',
  Suspend = 'suspend'
}

export type DecisionEffect = {
  label: string;
  status: ReportStatus;
  content: ContentAction;
  strike: StrikeAction;
  account: AccountAction;
};

export const DECISION_EFFECTS: Record<Decision, DecisionEffect> = {
  [Decision.Dismiss]: {
    label: 'Dismiss',
    status: ReportStatus.Dismissed,
    content: ContentAction.Keep,
    strike: StrikeAction.None,
    account: AccountAction.ByStrikes
  },
  [Decision.Remove]: {
    label: 'Remove content',
    status: ReportStatus.Actioned,
    content: ContentAction.Remove,
    strike: StrikeAction.Add,
    account: AccountAction.ByStrikes
  },
  [Decision.Suspend]: {
    label: 'Remove and suspend account',
    status: ReportStatus.Actioned,
    content: ContentAction.Remove,
    strike: StrikeAction.Add,
    account: AccountAction.Suspend
  },
  [Decision.Restore]: {
    label: 'Restore',
    status: ReportStatus.Restored,
    content: ContentAction.Restore,
    strike: StrikeAction.Revoke,
    account: AccountAction.ByStrikes
  }
};

export type Ground = {
  id: string;
  label: string;
  clause: string;
  decisions: readonly Decision[];
};

const ENFORCE = [Decision.Remove, Decision.Suspend] as const;

export const GROUNDS: readonly Ground[] = [
  { id: 'illegal', label: 'Illegal content', clause: 'Regulation (EU) 2022/2065 art. 16; Terms §12', decisions: ENFORCE },
  { id: 'prohibited', label: 'Prohibited by the acceptable use policy', clause: 'Terms §8', decisions: ENFORCE },
  { id: 'copyright', label: 'Copyright infringement', clause: '17 U.S.C. §512(c); Terms §12A', decisions: ENFORCE },
  { id: 'likeness', label: 'Likeness or voice used without consent', clause: 'Terms §11', decisions: ENFORCE },
  { id: 'csam', label: 'Child sexual abuse material', clause: 'Directive 2011/93/EU; Terms §8', decisions: ENFORCE },
  { id: 'no_violation', label: 'No violation found', clause: 'Terms §12', decisions: [Decision.Dismiss] },
  { id: 'insufficient', label: 'Notice incomplete or not substantiated', clause: 'Regulation (EU) 2022/2065 art. 16(2); 17 U.S.C. §512(c)(3)', decisions: [Decision.Dismiss] },
  { id: 'counter_notice', label: 'Valid counter-notice, no court action filed', clause: '17 U.S.C. §512(g)(2)(C)', decisions: [Decision.Restore] },
  { id: 'reversed', label: 'Decision reversed on review of a complaint', clause: 'Regulation (EU) 2022/2065 art. 20', decisions: [Decision.Restore] }
];

export function groundsFor(decision: Decision): Ground[] {
  return GROUNDS.filter((g) => g.decisions.includes(decision));
}

export function groundOf(decision: Decision, id: string): Ground | null {
  return groundsFor(decision).find((g) => g.id === id) ?? null;
}

export function decisionOf(value: string): Decision | null {
  return Object.values(Decision).find((d) => d === value) ?? null;
}
