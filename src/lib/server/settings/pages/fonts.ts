import type { SettingsEvent } from '../event';
import { can, OrgAction, type OrgRole } from '$lib/org-roles';

export const load = async ({ parent }: SettingsEvent) => {
  const { org } = await parent();
  return { canEdit: can(org.role as OrgRole, OrgAction.Edit) };
};
