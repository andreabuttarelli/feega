import { COPY, SOURCES, creditLine } from '@feega/plugin-registry/registry';
import type { Row } from './plugin-manager';

export enum Badge {
  ByFeega = 'By Feega',
  Community = 'Community'
}

export type Card = Row & { summary: string; description: string; badge: Badge; credit: string };

export function cardsOf(rows: Row[]): Card[] {
  return rows.map((row) => {
    const source = SOURCES.find((one) => one.manifestId === row.id);
    if (!source) {
      return { ...row, summary: '', description: '', badge: Badge.Community, credit: '' };
    }

    const copy = COPY[source.id];
    return { ...row, summary: source.summary, description: copy.description, badge: Badge.ByFeega, credit: creditLine(source.credit) };
  });
}

export function filterCards(cards: Card[], query: string): Card[] {
  const needle = query.trim().toLowerCase();
  return cards.filter((card) => `${card.name} ${card.summary}`.toLowerCase().includes(needle));
}
