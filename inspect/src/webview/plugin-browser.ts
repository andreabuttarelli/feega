import { COPY, SOURCES, type PluginShot } from '@feega/plugin-registry/registry';
import type { Row } from './plugin-manager';

export enum Badge {
  Official = 'Official',
  Community = 'Community'
}

export type Card = Row & { summary: string; description: string; badge: Badge; shots: PluginShot[] };

const SITE = 'https://www.feega.app';

const absolute = (shot: PluginShot): PluginShot => ({ ...shot, src: `${SITE}${shot.src}` });

export function cardsOf(rows: Row[]): Card[] {
  return rows.map((row) => {
    const source = SOURCES.find((one) => one.manifestId === row.id);
    if (!source) {
      return { ...row, summary: '', description: '', badge: Badge.Community, shots: [] };
    }

    const copy = COPY[source.id];
    return { ...row, summary: source.summary, description: copy.description, badge: Badge.Official, shots: copy.shots.map(absolute) };
  });
}

export function filterCards(cards: Card[], query: string): Card[] {
  const needle = query.trim().toLowerCase();
  return cards.filter((card) => `${card.name} ${card.summary}`.toLowerCase().includes(needle));
}
