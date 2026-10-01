import type { Db } from '$lib/server/db/client';
import { listNodes } from '$lib/server/repos/canvas';
import { claimCampaignTemplate } from '$lib/server/repos/profiles';
import { insertTemplate } from '$lib/server/canvas/templates';
import { templateIdForCampaign, type Campaign } from '$lib/onboarding/campaigns';

export const WELCOME_ORIGIN = { x: 0, y: 0 };

export type WelcomePlace = { userId: string; orgId: string; projectId: string; canvasId: string };

export type WelcomeDeps = {
  listNodes: typeof listNodes;
  claimCampaign: typeof claimCampaignTemplate;
  insertTemplate: typeof insertTemplate;
};

const WELCOME_DEPS: WelcomeDeps = { listNodes, claimCampaign: claimCampaignTemplate, insertTemplate };

export async function seedWelcome(db: Db, place: WelcomePlace, campaign: Campaign, deps: WelcomeDeps = WELCOME_DEPS): Promise<boolean> {
  const existing = await deps.listNodes(db, { orgId: place.orgId, canvasId: place.canvasId });
  if (existing.length > 0) {
    return false;
  }

  if (!(await deps.claimCampaign(db, place.userId, campaign))) {
    return false;
  }

  await deps.insertTemplate(db, {
    orgId: place.orgId,
    projectId: place.projectId,
    canvasId: place.canvasId,
    templateId: templateIdForCampaign(campaign),
    at: WELCOME_ORIGIN,
    actor: { kind: 'user', id: place.userId }
  });
  return true;
}
