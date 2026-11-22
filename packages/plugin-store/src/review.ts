import type { Review } from './install';

export const NO_PERMISSIONS = 'It asks for no permissions.';

export const questionOf = ({ name, version, words }: Review): string =>
  [`Install ${name} ${version}? Feega has not reviewed this plugin.`, words.length ? 'It will be able to:' : NO_PERMISSIONS, ...words.map((word) => `- ${word}`)].join('\n');
