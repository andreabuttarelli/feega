import { describe, expect, it } from 'vitest';
import type { TemplateEntry } from './library';
import { HAZE_GRID_COMPONENT } from './haze-grid-poster/component';
import { HAZE_GRID_POSTER_TEMPLATE } from './haze-grid-poster/template';
import { FLOW_QUOTE_COMPONENT } from './flow-quote-poster/component';
import { FLOW_QUOTE_POSTER_TEMPLATE } from './flow-quote-poster/template';
import { STACKED_PLUS_COMPONENT } from './stacked-plus-poster/component';
import { STACKED_PLUS_POSTER_TEMPLATE } from './stacked-plus-poster/template';
import { BARCODE_TABLE_COMPONENT } from './barcode-table-poster/component';
import { BARCODE_TABLE_POSTER_TEMPLATE } from './barcode-table-poster/template';
import { PIXEL_CAPS_COMPONENT } from './pixel-caps-poster/component';
import { PIXEL_CAPS_POSTER_TEMPLATE } from './pixel-caps-poster/template';
import { MONTH_GRID_COMPONENT } from './month-grid-poster/component';
import { MONTH_GRID_POSTER_TEMPLATE } from './month-grid-poster/template';
import { ROTATED_CARDS_COMPONENT } from './rotated-cards-poster/component';
import { ROTATED_CARDS_POSTER_TEMPLATE } from './rotated-cards-poster/template';
import { BRICK_CAPS_COMPONENT } from './brick-caps-poster/component';
import { BRICK_CAPS_POSTER_TEMPLATE } from './brick-caps-poster/template';
import { DARK_TAGS_COMPONENT } from './dark-tags-poster/component';
import { DARK_TAGS_POSTER_TEMPLATE } from './dark-tags-poster/template';

type PartRule = { full?: string[]; colorOnly?: string[]; shape?: string[] };
type Case = [string, TemplateEntry, string, PartRule];

const CASES: Case[] = [
  [
    'haze-grid',
    HAZE_GRID_POSTER_TEMPLATE,
    HAZE_GRID_COMPONENT,
    { full: ['rows', 'note', 'body', 'issue', 'marker', 'caption'], colorOnly: ['marks'], shape: ['haze'] }
  ],
  ['flow-quote', FLOW_QUOTE_POSTER_TEMPLATE, FLOW_QUOTE_COMPONENT, { full: ['marker', 'index'], colorOnly: ['pills'] }],
  [
    'stacked-plus',
    STACKED_PLUS_POSTER_TEMPLATE,
    STACKED_PLUS_COMPONENT,
    { full: ['rows', 'marker', 'index', 'caption'], shape: ['plus', 'quarter', 'rect'] }
  ],
  [
    'barcode-table',
    BARCODE_TABLE_POSTER_TEMPLATE,
    BARCODE_TABLE_COMPONENT,
    { full: ['titlePrimary', 'titleSecondary', 'eventLines', 'footer', 'partners', 'counter', 'index'], shape: ['barcode'] }
  ],
  [
    'pixel-caps',
    PIXEL_CAPS_POSTER_TEMPLATE,
    PIXEL_CAPS_COMPONENT,
    { full: ['title', 'columns', 'blockNumber', 'blockLabel'], colorOnly: ['index', 'blackBlocks'] }
  ],
  ['month-grid', MONTH_GRID_POSTER_TEMPLATE, MONTH_GRID_COMPONENT, { full: ['label', 'months', 'note', 'marker', 'index'], colorOnly: ['cards'] }],
  [
    'rotated-cards',
    ROTATED_CARDS_POSTER_TEMPLATE,
    ROTATED_CARDS_COMPONENT,
    { full: ['title', 'yearTag', 'wordmark', 'marker', 'index'], colorOnly: ['cards'] }
  ],
  ['brick-caps', BRICK_CAPS_POSTER_TEMPLATE, BRICK_CAPS_COMPONENT, { full: ['bars', 'marker', 'index'], colorOnly: ['corners'] }],
  ['dark-tags', DARK_TAGS_POSTER_TEMPLATE, DARK_TAGS_COMPONENT, { full: ['title', 'marker', 'index'], colorOnly: ['tags'] }]
];

describe.each(CASES)('the %s poster exposes text, colour and position per part', (_name, entry, component, rule) => {
  const props = entry.template.doc.components[component].propsSchema.properties;
  const keys = Object.keys(props);

  it.each(rule.full ?? [])('%s has its own text, colour and position fields', (part) => {
    expect(keys).toContain(part);
    expect(keys).toContain(`${part}Color`);
    expect(keys).toContain(`${part}X`);
    expect(keys).toContain(`${part}Y`);
  });

  it.each(rule.colorOnly ?? [])('%s has its own colour field (position carried per item)', (part) => {
    expect(keys).toContain(part);
    expect(keys.some((k) => k === `${part}Color` || k.startsWith(`${part}`) && k.toLowerCase().includes('color'))).toBe(true);
  });

  it.each(rule.shape ?? [])('%s has its own colour and position fields', (part) => {
    expect(keys).toContain(`${part}Color`);
    expect(keys).toContain(`${part}X`);
    expect(keys).toContain(`${part}Y`);
  });
});
