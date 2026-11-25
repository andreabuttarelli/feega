import { pixelSvg } from '@feega/pixel-icons/pixel';
import { AgentId, OnboardingStep } from '../../../inspect/src/messages';
import { SUPPORT_ITEMS, type SupportEntry, type SupportItem } from '../../../inspect/src/support';
import { AGENT_LOGOS } from '../../../inspect/src/webview/agent-logos';
import type { AcpAgent } from '../../../inspect/src/host/ai/acp-agents';
import { Detection, overviewOf } from '../../../inspect/src/webview/onboarding-agents';
import { SNACKBAR_TEXT, copyFeedback, type Feedback } from '../../../inspect/src/webview/onboarding-copy';
import { LOCAL_EMPTY, LOCAL_LATER, FAQ_ANSWER, FAQ_QUESTION, MCP_COMMAND, MCP_DOCS_URL, SKILL_COMMAND, SKILL_DETAIL, SKILL_TITLE, SLIDES } from '../../../inspect/src/webview/onboarding-slides';
import type { ShellState } from '../main/types';
import { el, pill, run, type View } from './dom';

export type OnboardingDeps = {
  signIn: () => Promise<void>;
  cancelSignIn: () => Promise<void>;
  openUrl: (url: string) => Promise<void>;
  copy: (text: string) => Promise<void>;
  detectAgents: () => Promise<AcpAgent[]>;
  finish: () => Promise<void>;
  changed: () => void;
};

const LOGO_SIZE = 28;
const HERO_PIXEL = 6;
const LAST = SLIDES.length - 1;

const MCP_KEY = 'mcp';
const SKILL_KEY = 'skill';
const CHECK = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>';
const CHEVRON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>';

let index = 0;
let faqOpen = false;
let local: AcpAgent[] | null = null;
let detecting = false;
let feedback: Feedback = { copied: null, snackbar: false };
let feel: ((key: string) => void) | null = null;
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

const copy = (key: string, text: string, deps: OnboardingDeps) => {
  feel ??= copyFeedback((next) => {
    feedback = next;
    deps.changed();
  });
  void deps.copy(text);
  feel(key);
};

const copyPill = (key: string, label: string, text: string, deps: OnboardingDeps) => {
  const done = feedback.copied === key;
  const button = pill(done ? 'Copied' : label, `${done ? 'primary' : 'outline'} small`, () => copy(key, text, deps));
  if (done) {
    button.insertAdjacentHTML('afterbegin', CHECK);
  }
  return button;
};

const faq = () => {
  const root = el('div', { class: `onb-faq${faqOpen ? ' open' : ''}` });
  const question = el('button', { class: 'onb-question', on: () => (faqOpen = root.classList.toggle('open')) }, el('span', { text: FAQ_QUESTION }), el('span', { html: CHEVRON }));
  root.append(question, el('div', { class: 'onb-answer' }, el('p', { text: FAQ_ANSWER })));
  return root;
};

const markHtml = (mark: ReturnType<typeof overviewOf>['rows'][number]['mark']) =>
  mark.logo ? `<svg class="onb-glyph" viewBox="${mark.logo.viewBox}" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="${mark.logo.path}"/></svg>` : `<span class="onb-glyph onb-initial" aria-hidden="true">${mark.initial}</span>`;

const detect = (deps: OnboardingDeps) => {
  if (local !== null || detecting) {
    return;
  }
  detecting = true;
  void deps.detectAgents().then((found) => {
    local = found;
    detecting = false;
    deps.changed();
  });
};

const localBody = ({ deps }: Ctx) => {
  detect(deps);
  if (local === null) {
    return [];
  }
  const overview = overviewOf(local);
  const empty = overview.none ? [el('p', { class: 'onb-more', text: LOCAL_EMPTY })] : [];
  const rows = overview.rows.map((row) => el('li', { class: `onb-local-row${row.state === Detection.NotFound ? ' off' : ''}` }, el('span', { class: 'onb-mark', html: markHtml(row.mark) }), el('span', { class: 'onb-local-name', text: row.label }), el('span', { class: 'onb-local-state', text: row.state === Detection.Detected ? 'detected' : 'not found' })));
  return [...empty, el('ul', { class: 'onb-local' }, ...rows), el('p', { class: 'onb-more', text: LOCAL_LATER })];
};

const agentsBody = ({ deps }: Ctx) => [
  agentLogos(),
  el(
    'ul',
    { class: 'onb-ways' },
    way(SKILL_TITLE, SKILL_DETAIL, copyPill(SKILL_KEY, 'Copy command', SKILL_COMMAND, deps)),
    way('MCP', 'Your agent reads your selection', pill('docs', 'ghost small', run(() => deps.openUrl(MCP_DOCS_URL))), copyPill(MCP_KEY, 'Copy setup', MCP_COMMAND, deps))
  ),
  faq()
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
    void deps.copy(item.text);
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
  [OnboardingStep.LocalAgents]: localBody,
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

const snackbar = () => (feedback.snackbar ? [el('div', { class: 'onb-snackbar', text: SNACKBAR_TEXT })] : []);

export const skipOnboarding = (deps: OnboardingDeps) => leave(deps);

export const onboardingView = (state: ShellState, deps: OnboardingDeps): View => ({
  key: `onboarding:${index}:${state.email}:${state.signingIn}:${ticked.size}:${feedback.copied}:${feedback.snackbar}:${local?.length ?? -1}`,
  build: () => {
    const slide = SLIDES[index];
    const more = slide.more ? [el('p', { class: 'onb-more', text: slide.more })] : [];
    return el(
      'div',
      { class: 'screen onb' },
      el('div', { class: 'onb-card' }, el('div', { class: 'onb-hero', html: pixelSvg(slide.icon, HERO_PIXEL) }), el('h1', { class: 'display onb-title', text: slide.title }), el('p', { class: 'onb-body', text: slide.body }), ...more, el('div', { class: 'onb-extra' }, ...STEP_BODIES[slide.step]({ state, deps })), footer(deps)), ...snackbar()
    );
  }
});
