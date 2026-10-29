import type { ComponentId } from '../../components';
import type { TextMeasure } from '../../layout/text-extent';
import { estimatedText } from '../../layout/text-extent';
import { laidExtent, NO_TYPESET, planOf, type TextComponent, type Typeset } from './painter';

const SHAPED: ReadonlySet<ComponentId> = new Set<TextComponent>(['Title', 'Text', 'Kicker']);

const BLACK = () => '#000';

const measures = new WeakMap<Typeset['fonts'], TextMeasure>();

function shaped(fonts: Typeset['fonts'], smoothing: Typeset['smoothing']): TextMeasure {
  return (component, props, unit, width) => {
    if (!SHAPED.has(component)) {
      return estimatedText(component, props, unit, width);
    }
    const stage = { width: unit, height: unit };
    const env = { component: component as TextComponent, smoothing, props: { ...props }, box: { left: 0, top: 0, width: width ?? unit, height: unit }, stage, colour: BLACK, time: 0, trim: 0, fps: 30, still: null, fonts, animators: [], asset: () => null };
    const plan = planOf(env);
    if (typeof plan === 'string') {
      return estimatedText(component, props, unit, width);
    }
    const free = width === undefined;
    const room = { ...plan, fits: false, flow: { ...plan.flow, wraps: !free }, frame: { ...plan.frame, left: 0, top: 0, width: free ? Infinity : width, hugs: free } };
    const laid = laidExtent(room, fonts);
    return laid ? { width: width ?? laid.width, height: laid.height } : estimatedText(component, props, unit, width);
  };
}

export function shapedText({ fonts, smoothing }: Typeset): TextMeasure {
  if (fonts === NO_TYPESET.fonts) {
    return estimatedText;
  }
  const known = measures.get(fonts);
  if (known) {
    return known;
  }
  const made = shaped(fonts, smoothing);
  measures.set(fonts, made);
  return made;
}
