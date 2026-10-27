import { fail } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { SettingsActions, SettingsEvent } from '../event';
import type { Db } from '$lib/server/db/client';
import { canvasModelCatalogue } from '$lib/server/canvas-catalogue';
import { settingsScope } from '$lib/server/settings-actions';
import { ALLOWLIST_MEDIA_LIST, isOrgAdmin, readAllowlist, setAllowlist, type Allowlists } from '$lib/server/model-allowlist/admin';
import { can, OrgAction, type OrgRole } from '$lib/org-roles';

const HTTP_FORBIDDEN = 403;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAVAILABLE = 503;

const NONE: Allowlists = { image: [], video: [], model3d: [] };

export const load = async ({ parent, locals }: SettingsEvent) => {
  const { org } = await parent();
  const catalogue = await canvasModelCatalogue();
  const models = Object.fromEntries(ALLOWLIST_MEDIA_LIST.map((medium) => [medium, catalogue[medium].choices.map(({ id, label }) => ({ id, label }))]));

  return {
    models,
    allowed: (await readAllowlist(locals.supabase as unknown as Db, org.id)) ?? NONE,
    canEdit: can(org.role as OrgRole, OrgAction.ManageMembers)
  };
};

async function saveAllowlist(event: RequestEvent<{ projectId: string }>) {
  const { supabase } = event.locals;
  const scope = await settingsScope(supabase, event.params.projectId);
  const { data } = await supabase.auth.getUser();
  if (!scope || !data.user || !(await isOrgAdmin(supabase as unknown as Db, scope.orgId, data.user.id))) {
    return fail(HTTP_FORBIDDEN, { allowlistError: 'forbidden' });
  }

  const form = await event.request.formData();
  const medium = String(form.get('medium') ?? '');
  if (!(ALLOWLIST_MEDIA_LIST as readonly string[]).includes(medium)) {
    return fail(HTTP_BAD_REQUEST, { allowlistError: 'invalid_medium' });
  }

  const saved = await setAllowlist(supabase as unknown as Db, {
    orgId: scope.orgId,
    medium: medium as (typeof ALLOWLIST_MEDIA_LIST)[number],
    modelIds: form.getAll('model_ids').map(String)
  });
  return saved ? { allowlistSaved: medium } : fail(HTTP_UNAVAILABLE, { allowlistError: 'unavailable' });
}

export const actions: SettingsActions = { saveAllowlist };
