import { COPY, SOURCES } from '@feega/plugin-registry/registry';
import type { Row } from './plugin-manager';

export enum Badge {
  Official = 'Official',
  Community = 'Community'
}

export type Card = Row & { summary: string; description: string; badge: Badge };

export function cardsOf(rows: Row[]): Card[] {
  return rows.map((row) => {
    const source = SOURCES.find((one) => one.manifestId === row.id);
    if (!source) {
      return { ...row, summary: '', description: '', badge: Badge.Community };
    }

    const copy = COPY[source.id];
    return { ...row, summary: source.summary, description: copy.description, badge: Badge.Official };
  });
}

export function filterCards(cards: Card[], query: string): Card[] {
  const needle = query.trim().toLowerCase();
  return cards.filter((card) => `${card.name} ${card.summary}`.toLowerCase().includes(needle));
}
