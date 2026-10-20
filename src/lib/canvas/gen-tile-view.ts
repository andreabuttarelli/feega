import { formatCredits } from '$lib/components/credit-amount-format';
import { audioFormOf, type AudioField } from './audio-form';
import { shownIndex } from './gen-history';
import { runStateOf, type GenMedium, type GenNode, type RunState } from './gen-node';
import { loopCreditsOf, type RunQuote } from './run-quote';

export type GenTileExtras = {
  hasUpstreamText: boolean;
  variableTextInput: boolean;
  loopQueued: number;
  loopVisible: boolean;
  loopCombinationCount: number;
};

export type GenButton = { label: string; credits: string | null; variable: boolean; enabled: boolean };

export type GenTileView = {
  medium: GenMedium;
  state: RunState;
  hasBody: boolean;
  hint: string;
  placeholder: string;
  prompt: string;
  output: string | null;
  error: string | null;
  warn: { text: string; soft: boolean } | null;
  run: GenButton;
  loop: (GenButton & { cancel: boolean }) | null;
  runs: number;
  shown: number;
  form: AudioField[];
};

export const PROMPT_PLACEHOLDER: Record<GenMedium, string> = {
  text: 'What should it be about…',
  image: 'Describe what you want to see…',
  video: 'Describe what you want to see…',
  audio: 'Text to speak, or the music or sound to make…',
  model3d: 'Connect an image, or describe the object…'
};

export const RUN_LABEL: Record<RunState, string> = {
  empty: 'Write what you want',
  ready: 'Ready',
  running: 'Sta lavorando…',
  done: 'Done',
  failed: 'Failed'
};

const approx = (credits: number | null) => (credits === null ? null : formatCredits(credits, { approx: true }));

function loopOf(quote: RunQuote, x: GenTileExtras): GenTileView['loop'] {
  if (x.loopQueued > 0) {
    return { label: `Annulla loop (${x.loopQueued})`, credits: null, variable: false, enabled: true, cancel: true };
  }
  if (!x.loopVisible) {
    return null;
  }
  return { label: `Loop ×${x.loopCombinationCount}`, credits: approx(loopCreditsOf(quote, x.loopCombinationCount, x.variableTextInput)), variable: quote.variable, enabled: quote.enabled, cancel: false };
}

export function hasGenBody(medium: GenMedium, state: RunState, refId: string | null, example: boolean): boolean {
  return medium !== 'text' || state === 'running' || state === 'failed' || !!refId || example;
}

export function genTileView(node: GenNode, quote: RunQuote, x: GenTileExtras): GenTileView {
  const state = runStateOf(node, { hasUpstreamText: x.hasUpstreamText });
  const tooLong = quote.tooLong && quote.choice?.maxPromptChars ? ` (${node.prompt.length}/${quote.choice.maxPromptChars})` : '';
  return {
    medium: node.medium,
    state,
    hasBody: hasGenBody(node.medium, state, node.refId, false),
    hint: RUN_LABEL[state],
    placeholder: PROMPT_PLACEHOLDER[node.medium],
    prompt: node.prompt,
    output: node.runs.find((r) => r.mediaId === node.refId)?.text ?? null,
    error: node.error ?? null,
    warn: quote.reason ? { text: `${quote.reason}${tooLong}`, soft: !quote.tooLong } : null,
    run: { label: quote.label, credits: approx(quote.credits), variable: quote.variable, enabled: quote.enabled },
    loop: loopOf(quote, x),
    runs: node.runs.length,
    shown: shownIndex(node),
    form: node.medium === 'audio' ? audioFormOf(node) : []
  };
}
