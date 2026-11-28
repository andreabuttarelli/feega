export enum Preview {
  Loading = 'loading',
  Ready = 'ready',
  NoBridge = 'no-bridge'
}

export type PreviewFacts = { bridged: boolean; pageLoaded: boolean; graceOver: boolean };

export const BRIDGE_GRACE_MS = 4000;

export function previewOf(facts: PreviewFacts): Preview {
  if (facts.bridged) {
    return Preview.Ready;
  }
  return facts.pageLoaded && facts.graceOver ? Preview.NoBridge : Preview.Loading;
}

const EMPTY_TEXT: Record<Preview, string> = {
  [Preview.Loading]: 'Waiting for the page to load…',
  [Preview.Ready]: 'Click an element to edit it. Double-click text to rewrite it.',
  [Preview.NoBridge]: 'The page has no Feega source map: element picking needs the feega-source-map plugin.'
};

export const emptyText = (preview: Preview): string => EMPTY_TEXT[preview];
