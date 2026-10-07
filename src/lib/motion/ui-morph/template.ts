import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { GOOGLE_FONTS } from '../fonts/catalogue';
import { BUILTIN_PREFIX } from '../template/design-kit';
import { exposeField, FieldType } from '../template/fields';
import type { TemplateEntry } from '../template/library';
import { addMorphReel } from './ops';
import { DEFAULT_REEL } from './reel';

const CLIP = 'reel';
const REEL_FPS = 60;

const FIELDS = [
  { key: 'accent', label: 'Accent', type: FieldType.Color, clipId: CLIP, prop: 'accent' },
  { key: 'button', label: 'Button', type: FieldType.Text, clipId: CLIP, prop: 'button' },
  { key: 'toast', label: 'Toast', type: FieldType.Text, clipId: CLIP, prop: 'toast' }
];

function reelDoc(): MotionDoc {
  const made = addMorphReel({ ...newMotionDoc(MotionFormat.Square), fps: REEL_FPS }, { states: DEFAULT_REEL, bpm: 120, offset: 0, props: {} }, GOOGLE_FONTS, CLIP);
  if (!made.ok) {
    throw new Error(`ui-morph-reel: ${made.error}`);
  }
  return FIELDS.reduce((doc, field) => {
    const exposed = exposeField(doc, field);
    if (!exposed.ok) {
      throw new Error(`ui-morph-reel: ${exposed.error}`);
    }
    return exposed.doc;
  }, made.doc);
}

export const UI_MORPH_TEMPLATE: TemplateEntry = {
  id: `${BUILTIN_PREFIX}ui-morph-reel`,
  template: { name: 'UI morph reel', description: 'One shape morphing through eleven UI states on the beat, cursor-driven, looping.', doc: reelDoc() }
};
