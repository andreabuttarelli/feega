import { pixelSvg } from '@feega/pixel-icons/pixel';
import { AgentId, OnboardingStep } from '../../../inspect/src/messages';
import { SUPPORT_ITEMS, type SupportEntry, type SupportItem } from '../../../inspect/src/support';
import { AGENT_LOGOS } from '../../../inspect/src/webview/agent-logos';
import { MCP_COMMAND, MCP_DOCS_URL, SLIDES } from '../../../inspect/src/webview/onboarding-slides';
import type { ShellState } from '../main/types';
import { el, pill, run, type View } from './dom';

export type OnboardingDeps = {
  signIn: () => Promise<void>;
  cancelSignIn: () => Promise<void>;
  openUrl: (url: string) => Promise<void>;
  finish: () => Promise<void>;
  changed: () => void;
};

const LOGO_SIZE = 28;
const HERO_PIXEL = 6;
const LAST = SLIDES.length - 1;

let index = 0;
const ticked = new Set<SupportItem>();

type Ctx = { state: ShellState; deps: OnboardingDeps };

const go = (to: number, deps: OnboardingDeps) => {
  index = to;
  deps.changed();
};

const leave = (deps: OnboardingDeps) => {
  index = 0;
  void deps.finish();
};

const agentLogos = () =>
  el(
    'ul',
    { class: 'onb-agents' },
    ...Object.values(AgentId).map((id) => {
      const logo = AGENT_LOGOS[id];
      return el('li', { class: 'onb-agent', title: logo.label, html: `<svg viewBox="${logo.viewBox}" width="${LOGO_SIZE}" height="${LOGO_SIZE}" fill="currentColor" aria-label="${logo.label}"><path fill-rule="evenodd" d="${logo.path}"/></svg>` });
    })
  );

const way = (label: string, detail: string, ...actions: HTMLElement[]) => el('li', {}, el('span', { class: 'onb-text' }, el('span', { class: 'onb-label', text: label }), el('span', { class: 'onb-detail', text: detail })), el('span', { class: 'onb-actions' }, ...actions));

const copy = (text: string) => void navigator.clipboard.writeText(text);

const agentsBody = ({ deps }: Ctx) => [
  agentLogos(),
  el(
    'ul',
    { class: 'onb-ways' },
    way('Copy for agent', 'Right-click any element'),
    way('MCP', 'Your agent reads your selection', pill('docs', 'ghost small', run(() => deps.openUrl(MCP_DOCS_URL))), pill('Copy setup', 'outline small', () => copy(MCP_COMMAND)))
  )
];

const signInBody = ({ state, deps }: Ctx) => {
  if (state.email) {
    return [el('p', { class: 'onb-signed', text: `Signed in as ${state.email}` })];
  }
  if (state.signingIn) {
    return [pill('Waiting for the browser…', 'waiting', () => undefined), pill('cancel', 'ghost small', run(() => deps.cancelSignIn()))];
  }
  return [pill('Sign in to Feega', 'primary small', run(() => deps.signIn())), pill('maybe later', 'ghost small', () => go(index + 1, deps))];
};

const act = (item: SupportEntry, deps: OnboardingDeps) => {
  ticked.add(item.id);
  if (item.url) {
    void deps.openUrl(item.url);
  }
  if (item.text) {
    copy(item.text);
  }
  deps.changed();
};

const supportBody = ({ deps }: Ctx) => [
  el(
    'ul',
    { class: 'onb-support' },
    ...SUPPORT_ITEMS.map((item) => {
      const done = ticked.has(item.id);
      return el('li', {}, el('button', { class: `onb-item${done ? ' ticked' : ''}`, on: () => act(item, deps) }, el('span', { text: item.label }), el('span', { class: 'onb-karma', text: done ? '✓' : `+${item.karma}` })));
    })
  ),
  pill('Start designing', 'primary', () => leave(deps))
];

const STEP_BODIES: Record<OnboardingStep, (ctx: Ctx) => HTMLElement[]> = {
  [OnboardingStep.Welcome]: () => [],
  [OnboardingStep.Agent]: () => [],
  [OnboardingStep.Agents]: agentsBody,
  [OnboardingStep.SignIn]: signInBody,
  [OnboardingStep.Support]: supportBody
};

const footer = (deps: OnboardingDeps) => {
  const dots = el('div', { class: 'onb-dots' }, ...SLIDES.map((_, at) => el('span', { class: `onb-dot${at === index ? ' on' : ''}` })));
  const back = pill('back', 'ghost small', () => go(index - 1, deps));
  back.toggleAttribute('disabled', index === 0);
  const next = index === LAST ? [] : [pill('next', 'ghost small strong', () => go(index + 1, deps))];
  return el('footer', { class: 'onb-foot' }, pill('skip', 'ghost small', () => leave(deps)), dots, el('div', { class: 'onb-steps' }, back, ...next));
};

export const skipOnboarding = (deps: OnboardingDeps) => leave(deps);

export const onboardingView = (state: ShellState, deps: OnboardingDeps): View => ({
  key: `onboarding:${index}:${state.email}:${state.signingIn}:${ticked.size}`,
  build: () => {
    const slide = SLIDES[index];
    const more = slide.more ? [el('p', { class: 'onb-more', text: slide.more })] : [];
    return el(
      'div',
      { class: 'screen onb' },
      el('div', { class: 'onb-card' }, el('div', { class: 'onb-hero', html: pixelSvg(slide.icon, HERO_PIXEL) }), el('h1', { class: 'display onb-title', text: slide.title }), el('p', { class: 'onb-body', text: slide.body }), ...more, el('div', { class: 'onb-extra' }, ...STEP_BODIES[slide.step]({ state, deps })), footer(deps))
    );
  }
});
