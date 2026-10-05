import { z } from 'zod';
import { OUTSIDES, PLAY_MODES, Outside, PlayMode } from './settings';

export const interactiveSchema = z.object({
  playback: z.enum(PLAY_MODES).default(PlayMode.Autoplay),
  loop: z.boolean().default(true),
  outside: z.enum(OUTSIDES).default(Outside.Fallback)
});
