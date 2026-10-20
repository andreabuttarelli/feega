import { describe, it, expect } from 'vitest';
import { CANVAS_OPS } from '$lib/server/canvas/canvas-ops';
import { EDITOR_OPS } from '$lib/server/frame-editor/editor-ops';
import { motionToolList } from '$lib/server/motion/tool-run';
import { Family, RESERVED_OPS, buildCatalogue, editCatalogue } from './edit-catalogue';
import { SHOWCASE_CANVAS_OPS, SHOWCASE_MOTION_TOOLS } from '../mcp-showcase-parity';

describe('one name for every op the edit tool reaches', () => {
  it('a name shared by two registries goes to the canvas first, then the frame, and the loser is prefixed', () => {
    const catalogue = buildCatalogue({ [Family.Canvas]: ['list_templates', 'cancel_render'], [Family.Frame]: ['list_templates', 'list_fonts'], [Family.Editor]: ['cancel_render', 'list_fonts'] });

    expect(catalogue.get('list_templates')).toMatchObject({ family: Family.Canvas, source: 'list_templates' });
    expect(catalogue.get('frame_list_templates')).toMatchObject({ family: Family.Frame, source: 'list_templates' });
    expect(catalogue.get('cancel_render')).toMatchObject({ family: Family.Canvas });
    expect(catalogue.get('editor_cancel_render')).toMatchObject({ family: Family.Editor, source: 'cancel_render' });
    expect(catalogue.get('list_fonts')).toMatchObject({ family: Family.Frame });
    expect(catalogue.get('editor_list_fonts')).toMatchObject({ family: Family.Editor, source: 'list_fonts' });
  });

  it('every op of the three registries is reachable, none lost to a collision', () => {
    const total = Object.keys(CANVAS_OPS).length + Object.keys(EDITOR_OPS).length + motionToolList().length;

    expect(editCatalogue().size).toBe(total);
  });

  it('no op takes the name of the meta ops', () => {
    expect(RESERVED_OPS.filter((name) => editCatalogue().has(name))).toEqual([]);
  });

  it('everything the design showcase was built with is reachable by its own name', () => {
    const catalogue = editCatalogue();

    expect([...SHOWCASE_CANVAS_OPS].filter((n) => catalogue.get(n)?.family !== Family.Canvas)).toEqual([]);
    expect([...SHOWCASE_MOTION_TOOLS].filter((n) => catalogue.get(n)?.family !== Family.Frame)).toEqual([]);
  });
});
