export type Searchable = { name: string; words: string[] };

enum Rank {
  Exact,
  Prefix,
  Contains,
  Word
}

const spaced = (text: string) => text.toLowerCase().replace(/[-_\s]+/g, ' ').trim();

function rankOf(spacedName: string, words: string, query: string, tokens: string[]): Rank | null {
  if (spacedName === query) {
    return Rank.Exact;
  }
  if (spacedName.startsWith(query)) {
    return Rank.Prefix;
  }
  if (tokens.every((token) => spacedName.includes(token))) {
    return Rank.Contains;
  }
  return tokens.every((token) => spacedName.includes(token) || words.includes(token)) ? Rank.Word : null;
}

export function search<T extends Searchable>(items: readonly T[], text: string, limit: number): T[] {
  const query = spaced(text);
  const tokens = query.split(' ');
  const ranked = items.flatMap((item, order) => {
    const rank = rankOf(spaced(item.name), spaced(item.words.join(' ')), query, tokens);
    return rank === null ? [] : [{ item, rank, order }];
  });

  return ranked
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .slice(0, limit)
    .map((entry) => entry.item);
}
