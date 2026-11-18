import { fail } from '@sveltejs/kit';
import type { SharedActions, SharedEvent } from '../event';
import type { Db } from '$lib/server/db/client';
import { isOrgAdmin } from '$lib/server/model-allowlist/admin';
import { readCaps, removeCap, saveCap } from '$lib/server/spend-caps/store';
import { CapReset, capScopesOn, CapScope, editableCaps, type SpendCap } from '$lib/server/spend-caps/policy';
import { can, OrgAction, type OrgRole } from '$lib/org-roles';

const HTTP_FORBIDDEN = 403;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAVAILABLE = 503;

const RESETS: readonly string[] = Object.values(CapReset);

export const load = async ({ parent, locals }: SharedEvent) => {
  const { org, project } = await parent();
  const projectId = project?.id ?? null;
  const caps = (await readCaps(locals.supabase as unknown as Db, org.id)) ?? [];

  return {
    caps: editableCaps(caps, projectId),
    scopes: capScopesOn(projectId),
    canEdit: can(org.role as OrgRole, OrgAction.ManageMembers)
  };
};

async function admin(event: SharedEvent) {
  const { supabase } = event.locals;
  const { org, project } = await event.parent();
  const { data } = await supabase.auth.getUser();
  if (!data.user || !(await isOrgAdmin(supabase as unknown as Db, org.id, data.user.id))) {
    return null;
  }
  return { db: supabase as unknown as Db, orgId: org.id, projectId: project?.id ?? null };
}

async function saveSpendCap(event: SharedEvent) {
  const ctx = await admin(event);
  if (!ctx) {
    return fail(HTTP_FORBIDDEN, { capError: 'forbidden' });
  }

  const form = await event.request.formData();
  const scope = String(form.get('scope') ?? '');
  const reset = String(form.get('reset') ?? CapReset.None);
  const capUsd = Number(form.get('cap_usd'));
  if (!(capScopesOn(ctx.projectId) as readonly string[]).includes(scope) || !RESETS.includes(reset) || !(capUsd > 0)) {
    return fail(HTTP_BAD_REQUEST, { capError: 'invalid' });
  }

  const cap: SpendCap = { scope: scope as CapScope, projectId: ctx.projectId, capUsd, reset: reset as CapReset };
  return (await saveCap(ctx.db, { orgId: ctx.orgId, cap })) ? { capSaved: scope } : fail(HTTP_UNAVAILABLE, { capError: 'unavailable' });
}

async function removeSpendCap(event: SharedEvent) {
  const ctx = await admin(event);
  if (!ctx) {
    return fail(HTTP_FORBIDDEN, { capError: 'forbidden' });
  }

  const scope = String((await event.request.formData()).get('scope') ?? '');
  if (!(capScopesOn(ctx.projectId) as readonly string[]).includes(scope)) {
    return fail(HTTP_BAD_REQUEST, { capError: 'invalid' });
  }

  return (await removeCap(ctx.db, { orgId: ctx.orgId, scope: scope as CapScope, projectId: ctx.projectId })) ? { capRemoved: scope } : fail(HTTP_UNAVAILABLE, { capError: 'unavailable' });
}

export const actions: SharedActions = { saveCap: saveSpendCap, removeCap: removeSpendCap };
