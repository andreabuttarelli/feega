import { MotionFormat } from '@feega/motion-core/motion/doc';
import { EdgeTone, Energy, Joint, SectionRole, TextAmount, type TemplateCard } from './card';

type IndexRow = { slug: string; description: string };

const cardOf = (description: string): TemplateCard => ({
  roles: [SectionRole.Product],
  energy: Energy.Calm,
  loops: false,
  onScreen: [{ from: 0, what: description }],
  needs: { media: null, text: TextAmount.Line },
  bestFormats: [MotionFormat.Landscape],
  edges: { start: EdgeTone.Light, end: EdgeTone.Light, transition: Joint.Cut },
  goodFor: ['showing a real interface component, editable as layers']
});

export const shippedCards = (slugPrefix: string, index: IndexRow[]): Record<string, TemplateCard> => Object.fromEntries(index.map((a) => [`${slugPrefix}${a.slug}`, cardOf(a.description)]));
