export type ChangelogEntry = { date: string; title: string; items: string[] };

export const CHANGELOG_PAGE_SIZE = 40;

export const changelogPageCount = (entries: readonly ChangelogEntry[]) => Math.max(1, Math.ceil(entries.length / CHANGELOG_PAGE_SIZE));

export const changelogPage = (entries: readonly ChangelogEntry[], page: number) => entries.slice((page - 1) * CHANGELOG_PAGE_SIZE, page * CHANGELOG_PAGE_SIZE);

export const changelogPagePath = (page: number) => `/changelog/page/${page}.json`;

export type ChangelogDay = { date: string; items: string[] };

export const changelogByDate = (entries: readonly ChangelogEntry[]): ChangelogDay[] =>
  entries.reduce<ChangelogDay[]>((days, entry) => {
    const last = days.at(-1);
    if (last?.date === entry.date) {
      last.items.push(...entry.items);
      return days;
    }
    return [...days, { date: entry.date, items: [...entry.items] }];
  }, []);
