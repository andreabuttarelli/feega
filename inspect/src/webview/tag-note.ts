import type { Pick } from '../messages';

const nameOfFile = (file: string) => file.split('/').pop()!.replace(/\.[^.]+$/, '');

export const tagNote = (pick: Pick): string | null =>
  pick.component && pick.instances > 1 ? `Changes all ${pick.instances} uses of <${nameOfFile(pick.source.file)}>` : null;
