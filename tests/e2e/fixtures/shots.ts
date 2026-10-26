import { homedir } from 'node:os';
import { join } from 'node:path';

export const SHOTS_DIR = join(homedir(), 'Documents', 'feega-videos', 'e2e');

export const SHOT_PREFIX = process.env.SHOT_PREFIX ?? join(SHOTS_DIR, 'shot');
