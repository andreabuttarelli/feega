import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import type { z } from 'zod';
import { MotionFormat, motionDocSchema, newMotionDoc } from '$lib/motion/doc';
import { cameraSchema } from '$lib/motion/camera';
import { createMotionTools, type MotionSession } from './motion-tools';

type Access = { write: string[]; read: string } | { fixed: string };

const DOC: Record<string, Access> = {
  version: { fixed: 'schema version, set by the editor' },
  fps: { fixed: 'every video runs at the same frame rate' },
  width: { write: ['set_canvas'], read: 'width' },
  height: { write: ['set_canvas'], read: 'height' },
  durationInFrames: { write: ['set_canvas'], read: 'duration' },
  tracks: { write: ['add_track', 'set_track', 'remove_track'], read: 'tracks' },
  assets: { write: ['add_asset', 'remove_asset'], read: 'assets' },
  camera: { write: ['set_camera'], read: 'camera' },
  fonts: { write: ['set_font', 'register_font', 'remove_font'], read: 'fonts' },
  components: { write: ['write_component', 'patch_component', 'remove_component'], read: 'components' }
};

const TRACK: Record<string, Access> = {
  id: { write: ['add_track'], read: 'id' },
  kind: { write: ['add_track'], read: 'kind' },
  name: { write: ['set_track'], read: 'name' },
  clips: { write: ['add_clip', 'move_clip', 'remove_clip'], read: 'clips' }
};

const CLIP: Record<string, Access> = {
  id: { write: ['add_clip'], read: 'id' },
  from: { write: ['set_timing', 'move_clip'], read: 'start' },
  durationInFrames: { write: ['set_timing', 'trim_clip'], read: 'duration' },
  trimStart: { write: ['trim_clip'], read: 'trimStart' },
  component: { write: ['add_clip'], read: 'component' },
  props: { write: ['set_props'], read: 'props' },
  transitionIn: { write: ['set_transition'], read: 'in' },
  transitionOut: { write: ['set_transition'], read: 'out' },
  transform: { write: ['set_transform'], read: 'transform' },
  keyframes: { write: ['set_keyframes', 'remove_keyframes'], read: 'keyframes' },
  mask: { write: ['set_mask', 'remove_mask'], read: 'mask' },
  matte: { write: ['set_track_matte'], read: 'matte' },
  depth: { write: ['set_clip_depth'], read: 'depth' },
  space: { write: ['set_clip_depth'], read: 'space' },
  parent: { write: ['set_parent', 'parent_clips'], read: 'parent' },
  parentOpacity: { write: ['set_parent'], read: 'parentOpacity' },
  expressions: { write: ['set_expression'], read: 'expressions' },
  effects: { write: ['add_effect', 'set_effect', 'remove_effect'], read: 'effects' },
  blend: { write: ['set_blend_mode'], read: 'blend' },
  animators: { write: ['add_text_animator', 'set_text_animator', 'remove_text_animator', 'apply_text_preset'], read: 'animators' }
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
