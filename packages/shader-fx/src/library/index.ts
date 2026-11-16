import { emberField } from './ember-field';
import { liquidLens } from './liquid-lens';
import type { LibraryShader } from './shader';
import { silkDrift } from './silk-drift';
import { veilWipe } from './veil-wipe';
import { voiceOrb } from './voice-orb';

export { LibraryGenre, type LibraryShader } from './shader';

export const SHADER_LIBRARY: readonly LibraryShader[] = [silkDrift, liquidLens, emberField, voiceOrb, veilWipe];
