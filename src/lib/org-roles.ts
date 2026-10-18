export enum OrgRoleName {
  Owner = 'owner',
  Admin = 'admin',
  Member = 'member',
  Viewer = 'viewer'
}

export const ORG_ROLES = [OrgRoleName.Owner, OrgRoleName.Admin, OrgRoleName.Member, OrgRoleName.Viewer] as const;

export type OrgRole = `${OrgRoleName}`;

export enum OrgAction {
  View = 'view',
  Edit = 'edit',
  Invite = 'invite',
  ManageMembers = 'manage_members',
  Billing = 'billing',
  TransferOwnership = 'transfer_ownership',
  Leave = 'leave'
}

const { Owner, Admin, Member, Viewer } = OrgRoleName;

const PERMISSIONS: Record<OrgAction, readonly OrgRole[]> = {
  [OrgAction.View]: [Owner, Admin, Member, Viewer],
  [OrgAction.Edit]: [Owner, Admin, Member],
  [OrgAction.Invite]: [Owner, Admin],
  [OrgAction.ManageMembers]: [Owner, Admin],
  [OrgAction.Billing]: [Owner],
  [OrgAction.TransferOwnership]: [Owner],
  [OrgAction.Leave]: [Admin, Member, Viewer]
};

const ASSIGNABLE: Record<OrgRole, readonly OrgRole[]> = {
  [Owner]: [Admin, Member, Viewer],
  [Admin]: [Admin, Member, Viewer],
  [Member]: [],
  [Viewer]: []
};

export const EDITOR_ROLES: readonly OrgRole[] = PERMISSIONS[OrgAction.Edit];

export function can(role: OrgRole, action: OrgAction): boolean {
  return PERMISSIONS[action].includes(role);
}

export function assignableRoles(role: OrgRole): readonly OrgRole[] {
  return ASSIGNABLE[role];
}

export function isOrgRole(value: unknown): value is OrgRole {
  return (ORG_ROLES as readonly unknown[]).includes(value);
}
