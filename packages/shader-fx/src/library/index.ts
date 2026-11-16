import { emberField } from './ember-field';
import type { LibraryShader } from './shader';
import { voiceOrb } from './voice-orb';

export { LibraryGenre, type LibraryShader } from './shader';

export const SHADER_LIBRARY: readonly LibraryShader[] = [emberField, voiceOrb];
