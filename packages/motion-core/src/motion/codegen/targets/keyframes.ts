import { cssEase, round } from '../ease';
import { Channel, NodeKind, Trigger, type AnimTrack, type Animation, type CodeNode, type ElementNode, type SvgNode } from '../ir';

const CSS_CHANNEL: Record<Channel, (v: number | string) => [string, string]> = {
  [Channel.X]: (v) => ['--tx', `${v}px`],
  [Channel.Y]: (v) => ['--ty', `${v}px`],
  [Channel.Scale]: (v) => ['scale', String(v)],
  [Channel.Rotate]: (v) => ['rotate', `${v}deg`],
  [Channel.Opacity]: (v) => ['opacity', String(v)],
  [Channel.Colour]: (v) => ['color', String(v)]
};

const TRANSLATED: ReadonlySet<Channel> = new Set([Channel.X, Channel.Y]);

const TRANSLATE = 'translate: var(--tx, 0px) var(--ty, 0px);';

export const INVIEW_CLASS = 'is-inview';

export const PROPERTY_RULES = ['--tx', '--ty'].map((name) => `@property ${name} { syntax: '<length>'; inherits: false; initial-value: 0px; }`);

export type Selectors = { base: string; inView: string };

const percent = (t: number) => `${round(t * 100)}%`;

const shorthand = (name: string, t: AnimTrack) => `${name} ${t.duration}s linear ${t.delay}s ${t.loop ? 'infinite' : 1} both`;

function keyframesOf(name: string, t: AnimTrack, indent: string): string[] {
  const stops = t.values.flatMap((v, i) => {
    const [property, value] = CSS_CHANNEL[t.channel](v);
    const ease = t.eases[i] ? [`${indent}    animation-timing-function: ${cssEase(t.eases[i])};`] : [];
    return [`${indent}  ${percent(t.times[i])} {`, `${indent}    ${property}: ${value};`, ...ease, `${indent}  }`];
  });
  return [`${indent}@keyframes ${name} {`, ...stops, `${indent}}`];
}

const block = (selector: string, lines: string[], indent: string) => [`${indent}${selector} {`, ...lines.map((l) => `${indent}  ${l}`), `${indent}}`];

export function animationCss(animation: Animation, selectors: Selectors, prefix: string, indent = ''): string[] {
  const named = animation.tracks.map((t) => ({ t, name: `${prefix}-${t.channel}` }));
  const play = `animation: ${named.map(({ t, name }) => shorthand(name, t)).join(', ')};`;
  const translate = animation.tracks.some((t) => TRANSLATED.has(t.channel)) ? [TRANSLATE] : [];
  const rules: Record<Trigger, string[]> = {
    [Trigger.Load]: block(selectors.base, [...translate, play], indent),
    [Trigger.InView]: [...block(selectors.base, [...translate, play, 'animation-play-state: paused;'], indent), ...block(selectors.inView, ['animation-play-state: running;'], indent)],
    [Trigger.Hover]: [...(translate.length ? block(selectors.base, translate, indent) : []), ...block(`${selectors.base}:hover`, [play], indent)]
  };
  return [...rules[animation.trigger], ...named.flatMap(({ t, name }) => ['', ...keyframesOf(name, t, indent)]), ''];
}

export type AnimatedNode = (ElementNode | SvgNode) & { animation: Animation };

export function animatedNodes(node: CodeNode): AnimatedNode[] {
  if (node.kind !== NodeKind.Element && node.kind !== NodeKind.Svg) {
    return [];
  }
  const own = node.animation && node.className ? [node as AnimatedNode] : [];
  const kids = node.kind === NodeKind.Element ? node.children.flatMap(animatedNodes) : [];
  return [...own, ...kids];
}

export const translates = (animation: Animation) => animation.tracks.some((t) => TRANSLATED.has(t.channel));

export const inView = (node: { animation?: Animation }) => node.animation?.trigger === Trigger.InView;

export const INVIEW_SCRIPT = [
  `const seen = new IntersectionObserver((entries) => {`,
  `  for (const entry of entries) {`,
  `    if (entry.isIntersecting) {`,
  `      entry.target.classList.add('${INVIEW_CLASS}');`,
  `      seen.unobserve(entry.target);`,
  `    }`,
  `  }`,
  `});`,
  ''
];
