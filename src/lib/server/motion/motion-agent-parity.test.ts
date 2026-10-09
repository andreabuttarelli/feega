import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import type { z } from 'zod';
import { MotionFormat, motionDocSchema, newMotionDoc } from '$lib/motion/doc';
import { cameraSchema } from '$lib/motion/camera';
import { createMotionTools, type MotionSession } from './motion-tools';
import { LAYOUTS } from '$lib/canvas/composition/index';
import { BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';

type Access = { write: string[]; read: string } | { fixed: string };

const DOC: Record<string, Access> = {
  version: { fixed: 'schema version, set by the editor' },
  fps: { write: ['set_canvas'], read: 'fps' },
  background: { write: ['set_canvas'], read: 'background' },
  motionBlur: { write: ['set_motion_blur'], read: 'motionBlur' },
  fields: { write: ['expose_field', 'unexpose_field', 'insert_template', 'set_template_fields'], read: 'fields' },
  width: { write: ['set_canvas'], read: 'width' },
  height: { write: ['set_canvas'], read: 'height' },
  durationInFrames: { write: ['set_canvas', 'fit_duration'], read: 'duration' },
  tracks: { write: ['add_track', 'set_track', 'remove_track'], read: 'tracks' },
  comps: { write: ['precompose', 'edit_comp', 'insert_template', 'detach_template'], read: 'comps' },
  assets: { write: ['add_asset', 'remove_asset'], read: 'assets' },
  camera: { write: ['set_camera'], read: 'camera' },
  look: { write: ['set_look', 'set_light', 'remove_light', 'set_light_keyframes'], read: 'look' },
  fonts: { write: ['set_font', 'register_font', 'remove_font'], read: 'fonts' },
  components: { write: ['write_component', 'patch_component', 'remove_component'], read: 'components' },
  shaders: { write: ['add_custom_effect'], read: 'shaders' },
  markers: { write: ['set_marker', 'remove_marker', 'mark_beats'], read: 'markers' },
  workArea: { write: ['set_work_area'], read: 'workArea' },
  interactive: { write: ['set_interactive', 'apply_interactive_preset'], read: 'interactive' },
  style: { write: ['set_style'], read: 'style' },
  script: { write: ['write_script'], read: 'script' }
};

const TRACK: Record<string, Access> = {
  id: { write: ['add_track'], read: 'id' },
  kind: { write: ['add_track'], read: 'kind' },
  name: { write: ['set_track'], read: 'name' },
  clips: { write: ['add_clip', 'move_clip', 'remove_clip'], read: 'clips' },
  hidden: { write: ['set_visibility'], read: 'hidden' },
  locked: { write: ['set_visibility'], read: 'locked' }
};

const CLIP: Record<string, Access> = {
  id: { write: ['add_clip'], read: 'id' },
  from: { write: ['set_timing', 'move_clip'], read: 'start' },
  durationInFrames: { write: ['set_timing', 'trim_clip'], read: 'duration' },
  trimStart: { write: ['trim_clip'], read: 'trimStart' },
  component: { write: ['add_clip'], read: 'component' },
  props: { write: ['set_props', 'add_particles', 'apply_particle_preset', 'set_time_remap'], read: 'props' },
  transitionIn: { write: ['set_transition'], read: 'in' },
  transitionOut: { write: ['set_transition'], read: 'out' },
  junction: { write: ['set_clip_transition'], read: 'junction' },
  transform: { write: ['set_transform'], read: 'transform' },
  keyframes: { write: ['set_keyframes', 'remove_keyframes', 'duck_audio', 'set_time_remap', 'freeze_frame'], read: 'keyframes' },
  mask: { write: ['set_mask', 'remove_mask'], read: 'mask' },
  maskStack: { write: ['set_mask_stack', 'remove_mask'], read: 'maskStack' },
  matte: { write: ['set_track_matte'], read: 'matte' },
  depth: { write: ['set_clip_depth'], read: 'depth' },
  space: { write: ['set_clip_depth'], read: 'space' },
  parent: { write: ['set_parent', 'parent_clips'], read: 'parent' },
  parentOpacity: { write: ['set_parent'], read: 'parentOpacity' },
  expressions: { write: ['set_expression', 'pulse_with_music'], read: 'expressions' },
  effects: { write: ['add_effect', 'set_effect', 'remove_effect', 'set_lut'], read: 'effects' },
  shaders: { write: ['add_custom_effect', 'set_custom_effect', 'remove_custom_effect'], read: 'shaders' },
  blend: { write: ['set_blend_mode'], read: 'blend' },
  animators: { write: ['add_text_animator', 'set_text_animator', 'remove_text_animator', 'apply_text_preset'], read: 'animators' },
  motionBlur: { write: ['set_motion_blur'], read: 'motionBlur' },
  textPath: { write: ['set_text_path', 'remove_text_path'], read: 'textPath' },
  path: { write: ['set_motion_path', 'set_path_tangent'], read: 'path' },
  physics: { write: ['set_physics', 'apply_physics_preset'], read: 'physics' },
  hidden: { write: ['set_visibility'], read: 'hidden' },
  locked: { write: ['set_visibility'], read: 'locked' },
  bleed: { write: ['set_visibility'], read: 'bleed' },
  markers: { write: ['set_marker', 'remove_marker'], read: 'markers' }
};

const CAMERA: Record<string, Access> = {
  base: { write: ['set_camera', 'apply_camera_preset'], read: 'values' },
  dof: { write: ['set_camera'], read: 'dof' },
  keyframes: { write: ['set_camera_keyframes', 'apply_camera_preset'], read: 'keyframes' },
  expressions: { write: ['set_expression'], read: 'expressions' }
};

type Shaped = { shape: Record<string, z.ZodType> };

function objectOf(schema: unknown): Shaped {
  let current = schema as { shape?: unknown; element?: unknown; _zod: { def: { innerType?: unknown } } };
  while (!current.shape) {
    current = (current.element ?? current._zod.def.innerType) as typeof current;
  }
  return current as Shaped;
}

const docShape = objectOf(motionDocSchema).shape;
const trackShape = objectOf(docShape.tracks).shape;
const clipShape = objectOf(trackShape.clips).shape;
const cameraShape = objectOf(cameraSchema).shape;

const TABLES: [string, Record<string, Access>, Record<string, unknown>][] = [
  ['doc', DOC, docShape],
  ['track', TRACK, trackShape],
  ['clip', CLIP, clipShape],
  ['camera', CAMERA, cameraShape]
];

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  return { tools, run };
}

describe('every editable part of a motion video has an agent path', () => {
  it.each(TABLES)('each %s field is in the parity table, and the table names no field that is gone', (_name, table, shape) => {
    expect(Object.keys(table).sort()).toEqual(Object.keys(shape).sort());
  });

  it.each(TABLES)('each writable %s field names tools the agent really has', (_name, table) => {
    const { tools } = setup();
    for (const [field, access] of Object.entries(table)) {
      const missing = 'write' in access ? access.write.filter((t) => !tools[t]) : [];
      expect({ field, missing }).toEqual({ field, missing: [] });
    }
  });

  it('every composition layout is a template the agent inserts and fills with its template tools, every setting a field', () => {
    for (const [layout, def] of Object.entries(LAYOUTS)) {
      const entry = BUILTIN_TEMPLATES.find((e) => e.id === `builtin:composition-${layout}`);
      const props = entry?.template.doc.fields.map((f) => f.prop) ?? [];

      expect({ layout, missing: def.params.map((p) => `layoutParams.${p.name}`).filter((p) => !props.includes(p)) }).toEqual({ layout, missing: [] });
    }
  });

  it('the agent can bring a brand in from outside the doc: a site, an org brand, a picture', () => {
    const { tools } = setup();

    expect(['analyze_site', 'use_brand', 'import_asset'].filter((t) => !tools[t])).toEqual([]);
  });

  it('get_motion_doc shows every writable field of the doc, its tracks, clips and camera', async () => {
    const { run } = setup();
    await run('add_clip', { component: 'Shape', start: 0, duration: 2 });
    await run('set_camera', { enabled: true });
    const doc = (await run('get_motion_doc', {})) as Record<string, unknown> & { tracks: (Record<string, unknown> & { clips: Record<string, unknown>[] })[]; camera: Record<string, unknown> };
    const views: Record<string, Record<string, unknown>> = { doc, track: doc.tracks[0], clip: doc.tracks[0].clips[0], camera: doc.camera };

    for (const [name, table] of TABLES) {
      for (const [field, access] of Object.entries(table)) {
        if ('read' in access) {
          expect({ name, field, shown: access.read in views[name] }).toEqual({ name, field, shown: true });
        }
      }
    }
  });
});
