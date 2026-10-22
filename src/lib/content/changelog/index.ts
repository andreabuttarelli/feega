/** `YYYY-MM-DD`, come il nome del file. Una data in prosa e una ISO nello stesso giorno si
 *  ordinano al contrario: `Date.parse` legge la prima come mezzanotte locale e la seconda come
 *  mezzanotte UTC. */
export type ChangelogDate = `${number}-${number}-${number}`;

export type ChangelogEntry = {
  date: ChangelogDate;
  title: string;
  items: string[];
};

import legacyEntries from './legacy';
import fromFiles from 'virtual:changelog-entries';

export const changelogEntries: ChangelogEntry[] = [...fromFiles, ...legacyEntries];
