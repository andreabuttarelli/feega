import { z } from 'zod';
import { HOUSE_LOOP } from '../style-model';
import { MAX_VARS } from './var-model';
import { varBindingSchema, varDeclSchema } from './var-schema';
import { OUTSIDES, PLAY_MODES, Outside, PlayMode, SCROLL_LENGTH } from './settings';

export const interactiveSchema = z.object({
  playback: z.enum(PLAY_MODES).default(PlayMode.Autoplay),
  loop: z.boolean().default(HOUSE_LOOP),
  outside: z.enum(OUTSIDES).default(Outside.Fallback),
  scrollLength: z.number().int().min(SCROLL_LENGTH.min).max(SCROLL_LENGTH.max).default(SCROLL_LENGTH.default),
  vars: z.array(varDeclSchema).max(MAX_VARS).default([]),
  bindings: z.array(varBindingSchema).default([])
});
