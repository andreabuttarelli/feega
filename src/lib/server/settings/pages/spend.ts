import { fail } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { SettingsActions, SettingsEvent } from '../event';
import type { Db } from '$lib/server/db/client';
import { settingsScope } from '$lib/server/settings-actions';
import { isOrgAdmin } from '$lib/server/model-allowlist/admin';
import { readCaps, removeCap, saveCap } from '$lib/server/spend-caps/store';
import { CapReset, CapScope, type SpendCap } from '$lib/server/spend-caps/policy';
import { can, OrgAction, type OrgRole } from '$lib/org-roles';

const HTTP_FORBIDDEN = 403;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAVAILABLE = 503;

const SCOPES: readonly string[] = Object.values(CapScope);
const RESETS: readonly string[] = Object.values(CapReset);

export const load = async ({ parent, locals, params }: SettingsEvent) => {
  const { org } = await parent();
  const caps = (await readCaps(locals.supabase as unknown as Db, org.id)) ?? [];

  return {
    caps: caps.filter((cap) => cap.projectId === null || cap.projectId === params.projectId),
    canEdit: can(org.role as OrgRole, OrgAction.ManageMembers)
  };
};

async function admin(event: RequestEvent<{ projectId: string }>) {
  const { supabase } = event.locals;
  const scope = await settingsScope(supabase, event.params.projectId);
  const { data } = await supabase.auth.getUser();
  if (!scope || !data.user || !(await isOrgAdmin(supabase as unknown as Db, scope.orgId, data.user.id))) {
    return null;
  }
  return { db: supabase as unknown as Db, orgId: scope.orgId, projectId: event.params.projectId };
}

async function saveSpendCap(event: RequestEvent<{ projectId: string }>) {
  const ctx = await admin(event);
  if (!ctx) {
    return fail(HTTP_FORBIDDEN, { capError: 'forbidden' });
  }

  const form = await event.request.formData();
  const scope = String(form.get('scope') ?? '');
  const reset = String(form.get('reset') ?? CapReset.None);
  const capUsd = Number(form.get('cap_usd'));
  if (!SCOPES.includes(scope) || !RESETS.includes(reset) || !(capUsd > 0)) {
    return fail(HTTP_BAD_REQUEST, { capError: 'invalid' });
  }

  const cap: SpendCap = { scope: scope as CapScope, projectId: scope === CapScope.OrgMember ? null : ctx.projectId, capUsd, reset: reset as CapReset };
  return (await saveCap(ctx.db, { orgId: ctx.orgId, cap })) ? { capSaved: scope } : fail(HTTP_UNAVAILABLE, { capError: 'unavailable' });
}

async function removeSpendCap(event: RequestEvent<{ projectId: string }>) {
  const ctx = await admin(event);
  if (!ctx) {
    return fail(HTTP_FORBIDDEN, { capError: 'forbidden' });
  }

  const scope = String((await event.request.formData()).get('scope') ?? '');
  if (!SCOPES.includes(scope)) {
    return fail(HTTP_BAD_REQUEST, { capError: 'invalid' });
  }

  const projectId = scope === CapScope.OrgMember ? null : ctx.projectId;
  return (await removeCap(ctx.db, { orgId: ctx.orgId, scope: scope as CapScope, projectId })) ? { capRemoved: scope } : fail(HTTP_UNAVAILABLE, { capError: 'unavailable' });
}

export const actions: SettingsActions = { saveCap: saveSpendCap, removeCap: removeSpendCap };
