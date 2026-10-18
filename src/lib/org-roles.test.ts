import { describe, expect, it } from 'vitest';
import { assignableRoles, can, ORG_ROLES, OrgAction, OrgRoleName } from '$lib/org-roles';

const MATRIX: Record<OrgAction, OrgRoleName[]> = {
  [OrgAction.View]: [OrgRoleName.Owner, OrgRoleName.Admin, OrgRoleName.Member, OrgRoleName.Viewer],
  [OrgAction.Edit]: [OrgRoleName.Owner, OrgRoleName.Admin, OrgRoleName.Member],
  [OrgAction.Invite]: [OrgRoleName.Owner, OrgRoleName.Admin],
  [OrgAction.ManageMembers]: [OrgRoleName.Owner, OrgRoleName.Admin],
  [OrgAction.Billing]: [OrgRoleName.Owner],
  [OrgAction.TransferOwnership]: [OrgRoleName.Owner],
  [OrgAction.Leave]: [OrgRoleName.Admin, OrgRoleName.Member, OrgRoleName.Viewer]
};

describe('la matrice dei permessi', () => {
  for (const action of Object.values(OrgAction)) {
    for (const role of ORG_ROLES) {
      const allowed = MATRIX[action].includes(role);
      it(`${role} ${allowed ? 'può' : 'non può'} ${action}`, () => {
        expect(can(role, action)).toBe(allowed);
      });
    }
  }

  it('un viewer non modifica niente', () => {
    expect(can(OrgRoleName.Viewer, OrgAction.Edit)).toBe(false);
  });

  it("nessuno assegna owner: si trasferisce, non si nomina", () => {
    for (const role of ORG_ROLES) {
      expect(assignableRoles(role)).not.toContain(OrgRoleName.Owner);
    }
  });

  it('un member o un viewer non assegnano ruoli', () => {
    expect(assignableRoles(OrgRoleName.Member)).toEqual([]);
    expect(assignableRoles(OrgRoleName.Viewer)).toEqual([]);
  });
});
