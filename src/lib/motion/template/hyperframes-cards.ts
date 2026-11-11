import { MotionFormat } from '@feega/motion-core/motion/doc';
import { HF_PORTS } from '@feega/motion-core/motion/hyperframes/catalog';
import { HfCategory, type HfPort } from '@feega/motion-core/motion/hyperframes/model';
import { EdgeTone, Energy, Joint, SectionRole, TextAmount, type TemplateCard } from './card';

type CategoryCard = { roles: TemplateCard['roles']; energy: Energy; text: TextAmount; goodFor: string };

const CATEGORY_CARD: Record<HfCategory, CategoryCard> = {
  [HfCategory.LowerThird]: { roles: [SectionRole.Feature, SectionRole.Proof], energy: Energy.Calm, text: TextAmount.Word, goodFor: 'naming a speaker or a place over footage' },
  [HfCategory.Caption]: { roles: [SectionRole.Feature], energy: Energy.Medium, text: TextAmount.Lines, goodFor: 'spoken captions over a clip' },
  [HfCategory.Text]: { roles: [SectionRole.Opener, SectionRole.Feature], energy: Energy.Medium, text: TextAmount.Line, goodFor: 'a headline or claim' },
  [HfCategory.Title]: { roles: [SectionRole.Opener, SectionRole.Closer], energy: Energy.Medium, text: TextAmount.Line, goodFor: 'a title card at the start or the end' },
  [HfCategory.Chart]: { roles: [SectionRole.Stat, SectionRole.Proof], energy: Energy.Medium, text: TextAmount.Word, goodFor: 'one number or one chart that proves a point' },
  [HfCategory.Card]: { roles: [SectionRole.Proof, SectionRole.Product], energy: Energy.Calm, text: TextAmount.Lines, goodFor: 'a quote, a notification or a small piece of interface' },
  [HfCategory.Transition]: { roles: [SectionRole.Transition], energy: Energy.Fast, text: TextAmount.None, goodFor: 'a bridge between two sections' },
  [HfCategory.Ambient]: { roles: [SectionRole.Background], energy: Energy.Calm, text: TextAmount.None, goodFor: 'motion behind other clips' }
};

const LIGHT_LUMA = 0.5;

const toneOf = (hex: string): EdgeTone => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > LIGHT_LUMA ? EdgeTone.Light : EdgeTone.Dark;
};

const formatOf = (port: HfPort) => (port.height > port.width ? MotionFormat.Vertical : port.height === port.width ? MotionFormat.Square : MotionFormat.Landscape);

const cardOf = (port: HfPort): TemplateCard => {
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

export const HF_CARDS: Record<string, TemplateCard> = Object.fromEntries(HF_PORTS.map((p) => [`hyperframes-${p.id}`, cardOf(p)]));
