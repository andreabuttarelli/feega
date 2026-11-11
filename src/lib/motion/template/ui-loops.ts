import { UI_LOOP_PORTS } from '@feega/motion-core/motion/uiloops/catalog';
import { BUILTIN_PREFIX } from './design-kit';
import type { TemplateCard } from './card';
import type { TemplateEntry } from './library';
import { cardOf } from './snapcn-cards';
import { templateOf } from './snapcn';

export const UI_LOOP_TEMPLATES: TemplateEntry[] = UI_LOOP_PORTS.map((p) => templateOf(p, BUILTIN_PREFIX));

export const UI_LOOP_CARDS: Record<string, TemplateCard> = Object.fromEntries(UI_LOOP_PORTS.map((p) => [p.id, cardOf(p)]));
