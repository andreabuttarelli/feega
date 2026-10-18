import { describe, expect, it } from 'vitest';
import { canvasModeFor, CanvasMode } from '$lib/canvas/canvas-mode';
import { ORG_ROLES, OrgRoleName } from '$lib/org-roles';

describe('la tela di un viewer è in sola lettura', () => {
  it('un viewer la guarda, non la modifica', () => {
    expect(canvasModeFor(OrgRoleName.Viewer)).toBe(CanvasMode.View);
  });

  it('chi può modificare la modifica', () => {
    for (const role of ORG_ROLES.filter((r) => r !== OrgRoleName.Viewer)) {
      expect(canvasModeFor(role)).toBe(CanvasMode.Edit);
    }
  });
});
