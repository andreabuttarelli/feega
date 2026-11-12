import { MotionFormat } from '@feega/motion-core/motion/doc';
import { EdgeTone, Energy, Joint, SectionRole, TextAmount, type TemplateCard } from './card';
import ARC_SHOWS from './arc/arc-shows.json';

const cardOf = (shows: string): TemplateCard => ({
  roles: [SectionRole.Product],
  energy: Energy.Calm,
  loops: false,
  onScreen: [{ from: 0, what: `still: ${shows}` }],
  needs: { media: null, text: TextAmount.Line },
  bestFormats: [MotionFormat.Landscape],
  edges: { start: EdgeTone.Light, end: EdgeTone.Light, transition: Joint.Cut },
  goodFor: ['showing a real interface component, editable as layers']
});

export const ARC_CARDS: Record<string, TemplateCard> = Object.fromEntries(Object.entries(ARC_SHOWS).map(([slug, shows]) => [`arc-${slug}`, cardOf(shows)]));
