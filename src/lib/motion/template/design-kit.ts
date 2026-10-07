import { TrackKind } from '$lib/motion/components';
import { MotionFormat, type MotionDoc } from '$lib/motion/doc';
import type { FontFace } from '$lib/motion/fonts/model';
import { assemble, type Beat, type TrackSpec } from '$lib/motion/template-kit';
import { exposeField, FieldType, type FieldInput } from './fields';
import type { TemplateEntry } from './library';

export const BUILTIN_PREFIX = 'builtin:';

export type Field = Omit<FieldInput, 'type'> & { type: FieldType };
export type Design = { id: string; name: string; description: string; seconds: number; beats: Beat[]; fields: Field[]; fonts?: FontFace[] };

const FORMAT = MotionFormat.Landscape;
const FRAME = { width: 1920, height: 1080 };

const TRACKS: TrackSpec[] = [
  { id: 'front', kind: TrackKind.Visual, name: 'Front' },
  { id: 'middle', kind: TrackKind.Visual, name: 'Middle' },
  { id: 'back', kind: TrackKind.Visual, name: 'Back' }
];

export const boxAspect = (width: number, height: number) => Math.round(((width * FRAME.width) / (height * FRAME.height)) * 100) / 100;

export const text = (key: string, label: string, clipId: string): Field => ({ key, label, type: FieldType.Text, clipId, prop: 'text' });
export const colour = (key: string, label: string, clipId: string, prop: string): Field => ({ key, label, type: FieldType.Color, clipId, prop });
export const backdrop = (fill: string, seconds: number): Beat => ({ id: 'bg', track: 'back', component: 'Shape', at: 0, len: seconds, props: { shape: 'rect', fill, x: 0.5, y: 0.5, width: 1, height: 1 } });

export function build(design: Design): TemplateEntry {
  let doc: MotionDoc = assemble({ format: FORMAT, seconds: design.seconds, tracks: TRACKS, beats: design.beats, fonts: design.fonts });
  doc = { ...doc, tracks: doc.tracks.filter((t) => t.clips.length) };
  for (const field of design.fields) {
    const exposed = exposeField(doc, field);
    if (!exposed.ok) {
      throw new Error(`${design.id}: ${exposed.error}`);
    }
    doc = exposed.doc;
  }
  return { id: `${BUILTIN_PREFIX}${design.id}`, template: { name: design.name, description: design.description, doc } };
}
