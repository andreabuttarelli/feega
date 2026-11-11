import { MotionFormat } from '@feega/motion-core/motion/doc';
import { SNAPCN_PORTS } from '@feega/motion-core/motion/snapcn/catalog';
import { SnapcnCategory, type SnapcnPort } from '@feega/motion-core/motion/snapcn/model';
import { EdgeTone, Energy, Joint, SectionRole, TextAmount, type TemplateCard } from './card';

type CategoryCard = { roles: TemplateCard['roles']; energy: Energy; text: TextAmount; goodFor: string };

const CATEGORY_CARD: Record<SnapcnCategory, CategoryCard> = {
  [SnapcnCategory.Text]: { roles: [SectionRole.Opener, SectionRole.Feature], energy: Energy.Medium, text: TextAmount.Line, goodFor: 'a headline or claim in a product demo' },
  [SnapcnCategory.Ai]: { roles: [SectionRole.Product, SectionRole.Feature], energy: Energy.Medium, text: TextAmount.Lines, goodFor: 'showing an AI prompt, answer or agent at work' },
  [SnapcnCategory.Logo]: { roles: [SectionRole.Opener, SectionRole.Closer], energy: Energy.Medium, text: TextAmount.Word, goodFor: 'a logo sting at the start or end' },
  [SnapcnCategory.Screen]: { roles: [SectionRole.Product], energy: Energy.Calm, text: TextAmount.Line, goodFor: 'presenting an app screen or device' },
  [SnapcnCategory.Scene]: { roles: [SectionRole.Opener, SectionRole.Feature, SectionRole.Closer], energy: Energy.Fast, text: TextAmount.Line, goodFor: 'a full launch or feature scene' },
  [SnapcnCategory.Caption]: { roles: [SectionRole.Feature], energy: Energy.Medium, text: TextAmount.Lines, goodFor: 'spoken captions over a clip' },
  [SnapcnCategory.Cursor]: { roles: [SectionRole.Product], energy: Energy.Medium, text: TextAmount.Word, goodFor: 'a cursor clicking or typing in a UI' },
  [SnapcnCategory.Social]: { roles: [SectionRole.Proof, SectionRole.Stat], energy: Energy.Fast, text: TextAmount.Word, goodFor: 'social proof and growth' },
  [SnapcnCategory.Transition]: { roles: [SectionRole.Transition], energy: Energy.Fast, text: TextAmount.None, goodFor: 'a bridge between two sections' },
  [SnapcnCategory.Background]: { roles: [SectionRole.Opener, SectionRole.Feature, SectionRole.Closer], energy: Energy.Calm, text: TextAmount.None, goodFor: 'a moving backdrop behind titles and UI' },
  [SnapcnCategory.Effect]: { roles: [SectionRole.Feature, SectionRole.Product], energy: Energy.Medium, text: TextAmount.Word, goodFor: 'a glow, border or motion accent on a card or button' },
  [SnapcnCategory.Icon]: { roles: [SectionRole.Feature, SectionRole.Proof], energy: Energy.Medium, text: TextAmount.None, goodFor: 'an animated icon beside a feature or a stat' }
};

const LIGHT_LUMA = 0.5;

const toneOf = (hex: string): EdgeTone => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > LIGHT_LUMA ? EdgeTone.Light : EdgeTone.Dark;
};

const formatOf = (port: SnapcnPort) => (port.height > port.width ? MotionFormat.Vertical : MotionFormat.Landscape);

export const cardOf = (port: SnapcnPort): TemplateCard => {
  const c = CATEGORY_CARD[port.category];
  const tone = toneOf(port.background);
  return {
    roles: c.roles,
    energy: c.energy,
    loops: false,
    onScreen: [{ from: 0, to: port.frames / port.fps, what: port.about }],
    needs: { media: null, text: c.text },
    bestFormats: [formatOf(port)],
    edges: { start: tone, end: tone, transition: Joint.Cut },
    goodFor: [c.goodFor]
  };
};

export const SNAPCN_CARDS: Record<string, TemplateCard> = Object.fromEntries(SNAPCN_PORTS.map((p) => [`snapcn-${p.id}`, cardOf(p)]));
