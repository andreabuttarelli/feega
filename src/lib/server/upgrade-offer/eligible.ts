import type { SupabaseClient } from '@supabase/supabase-js';
import { findReachableProject } from '$lib/server/projects/lookup';
import { listMemberships } from '$lib/server/repos/orgs';
import { isOrgOwner, orgBillingById, type OrgBilling } from '$lib/server/org-billing';
import { billingGrantsReady } from '$lib/server/billing-readiness';

export async function offerBilling(db: SupabaseClient, at: { projectId: string; userId: string }): Promise<OrgBilling | null> {
  const memberships = await listMemberships(db, at.userId);
  const found = await findReachableProject(db, { projectId: at.projectId, memberships, userId: at.userId });
  if (!found) {
    return null;
  }

  const [owner, ready, billing] = await Promise.all([isOrgOwner(db, found.orgId, at.userId), billingGrantsReady(db), orgBillingById(db, found.orgId)]);
  if (!owner || !ready || !billing || billing.subscriptionId) {
    return null;
  }
  return billing;
}
