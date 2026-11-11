import { MotionFormat } from '@feega/motion-core/motion/doc';
import { RENDERCOMP_PORTS } from '@feega/motion-core/motion/rendercomp/catalog';
import { RendercompCategory, type RendercompPort } from '@feega/motion-core/motion/rendercomp/model';
import { EdgeTone, Energy, Joint, SectionRole, TextAmount, type TemplateCard } from './card';

type CategoryCard = { roles: TemplateCard['roles']; energy: Energy; text: TextAmount; goodFor: string };

const CATEGORY_CARD: Record<RendercompCategory, CategoryCard> = {
  [RendercompCategory.Logo]: { roles: [SectionRole.Opener, SectionRole.Closer], energy: Energy.Medium, text: TextAmount.Word, goodFor: 'a logo or brand name sting at the start or end' },
  [RendercompCategory.Text]: { roles: [SectionRole.Opener, SectionRole.Feature], energy: Energy.Medium, text: TextAmount.Line, goodFor: 'a headline, title or quote' },
  [RendercompCategory.Transition]: { roles: [SectionRole.Transition], energy: Energy.Fast, text: TextAmount.None, goodFor: 'a bridge between two sections' },
  [RendercompCategory.Chart]: { roles: [SectionRole.Stat, SectionRole.Proof], energy: Energy.Medium, text: TextAmount.Lines, goodFor: 'animating numbers and trends' },
  [RendercompCategory.Social]: { roles: [SectionRole.Proof, SectionRole.Closer], energy: Energy.Medium, text: TextAmount.Lines, goodFor: 'social proof, a chat, a lower third or an end card' },
  [RendercompCategory.Loop]: { roles: [SectionRole.Feature], energy: Energy.Calm, text: TextAmount.None, goodFor: 'an ambient background loop' }
};

const LIGHT_LUMA = 0.5;

const toneOf = (hex: string): EdgeTone => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > LIGHT_LUMA ? EdgeTone.Light : EdgeTone.Dark;
};

const formatOf = (port: RendercompPort) => (port.height > port.width ? MotionFormat.Vertical : MotionFormat.Landscape);

const cardOf = (port: RendercompPort): TemplateCard => {
  const c = CATEGORY_CARD[port.category];
  const tone = toneOf(port.background);
  return {
    roles: c.roles,
    energy: c.energy,
    loops: port.category === RendercompCategory.Loop,
    onScreen: [{ from: 0, to: port.frames / port.fps, what: port.about }],
    needs: { media: null, text: c.text },
    bestFormats: [formatOf(port)],
    edges: { start: tone, end: tone, transition: Joint.Cut },
    goodFor: [c.goodFor]
  };
};

export const RENDERCOMP_CARDS: Record<string, TemplateCard> = Object.fromEntries(RENDERCOMP_PORTS.map((p) => [`rendercomp-${p.id}`, cardOf(p)]));
