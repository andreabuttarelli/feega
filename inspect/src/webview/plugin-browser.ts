import { COPY, PluginLabel, SOURCES, creditLine, labelsOf } from '@feega/plugin-registry/registry';
import { pixelRowsOf } from '@feega/plugin-registry/pixel';
import type { Row } from './plugin-manager';

export { PluginLabel as Badge };

export type Card = Row & { summary: string; description: string; labels: PluginLabel[]; credit: string; pixels: readonly string[] | undefined };

export function cardsOf(rows: Row[]): Card[] {
  return rows.map((row) => {
    const source = SOURCES.find((one) => one.manifestId === row.id);
    if (!source) {
      return { ...row, summary: '', description: '', labels: labelsOf(undefined), credit: '', pixels: undefined };
    }

    const copy = COPY[source.id];
    return { ...row, summary: source.summary, description: copy.description, labels: labelsOf(source), credit: creditLine(source.credit), pixels: pixelRowsOf(copy.icon) };
  });
}

export function filterCards(cards: Card[], query: string): Card[] {
  const needle = query.trim().toLowerCase();
  return cards.filter((card) => `${card.name} ${card.summary}`.toLowerCase().includes(needle));
}
