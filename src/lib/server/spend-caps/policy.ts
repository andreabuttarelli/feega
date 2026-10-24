export enum CapScope {
  OrgMember = 'org_member',
  ProjectMember = 'project_member',
  ProjectTotal = 'project_total'
}

export enum CapReset {
  None = 'none',
  Monthly = 'monthly'
}

export type SpendCap = { scope: CapScope; projectId: string | null; capUsd: number; reset: CapReset };

export type SpentOf = (cap: SpendCap) => Promise<number>;

const NARROWEST_FIRST: Record<CapScope, number> = {
  [CapScope.ProjectMember]: 0,
  [CapScope.ProjectTotal]: 1,
  [CapScope.OrgMember]: 2
};

export function applicableCaps(caps: SpendCap[], projectId: string | null): SpendCap[] {
  return caps.filter((cap) => cap.scope === CapScope.OrgMember || cap.projectId === projectId);
}

export function capSince(cap: SpendCap, now: Date): Date | null {
  return cap.reset === CapReset.Monthly ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) : null;
}

export async function firstReached(caps: SpendCap[], spentOf: SpentOf): Promise<SpendCap | null> {
  const ordered = [...caps].sort((a, b) => NARROWEST_FIRST[a.scope] - NARROWEST_FIRST[b.scope]);

  for (const cap of ordered) {
    if ((await spentOf(cap)) >= cap.capUsd) {
      return cap;
    }
  }
  return null;
}
