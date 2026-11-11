import { REMOCN_PORTS } from '@feega/motion-core/motion/remocn/catalog';
import type { TemplateCard } from './card';
import { cardOf } from './snapcn-cards';

export const REMOCN_CARDS: Record<string, TemplateCard> = Object.fromEntries(REMOCN_PORTS.map((p) => [`remocn-${p.id}`, cardOf(p)]));
