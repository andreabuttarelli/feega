import type { Target } from './browser';

export const OVERLAY_SELECTOR = 'dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]';
export const ESCAPE_KEY = 'Escape';
const MAX_OVERLAYS = 3;

export enum DismissKind {
  Button = 'button',
  Key = 'key'
}

export type DismissStrategy = { name: string; kind: DismissKind.Button; labels: readonly string[] } | { name: string; kind: DismissKind.Key; key: string };

export const DISMISS_STRATEGIES: readonly DismissStrategy[] = [
  { name: 'skip', kind: DismissKind.Button, labels: ['skip', 'skip tour', 'salta'] },
  { name: 'got it', kind: DismissKind.Button, labels: ['got it', 'ok, got it', 'ho capito'] },
  { name: 'not now', kind: DismissKind.Button, labels: ['not now', 'maybe later', 'later', 'no thanks', 'no, thanks', 'più tardi'] },
  { name: 'dismiss', kind: DismissKind.Button, labels: ['dismiss', 'continue', 'done'] },
  { name: 'close', kind: DismissKind.Button, labels: ['close', 'chiudi', '×', '✕', 'x'] },
  { name: 'escape', kind: DismissKind.Key, key: ESCAPE_KEY }
];

export type Overlay = { buttons: string[] };

export type OverlayTab = {
  overlay: () => Promise<Overlay | null>;
  click: (target: Target) => Promise<void>;
  press: (key: string) => Promise<void>;
};

const plain = (label: string) => label.replace(/\s+/g, ' ').trim().toLowerCase();

function pressed(strategy: DismissStrategy, overlay: Overlay): Target | string | null {
  if (strategy.kind === DismissKind.Key) {
    return strategy.key;
  }
  const label = overlay.buttons.find((b) => strategy.labels.includes(plain(b)));
  return label === undefined ? null : { selector: `::-p-aria([name="${label.replace(/"/g, '\\"')}"][role="button"])` };
}

async function apply(tab: OverlayTab, action: Target | string): Promise<void> {
  if (typeof action === 'string') {
    await tab.press(action);
    return;
  }
  await tab.click(action);
}

async function dismissOne(tab: OverlayTab, overlay: Overlay): Promise<string | null> {
  for (const strategy of DISMISS_STRATEGIES) {
    const action = pressed(strategy, overlay);
    if (!action) {
      continue;
    }
    await apply(tab, action).catch(() => undefined);
    const after = await tab.overlay();
    if (!after || after.buttons.join('|') !== overlay.buttons.join('|')) {
      return strategy.name;
    }
  }
  return null;
}

export async function dismissOverlays(tab: OverlayTab): Promise<string[]> {
  const dismissed: string[] = [];
  for (let i = 0; i < MAX_OVERLAYS; i++) {
    const overlay = await tab.overlay().catch(() => null);
    if (!overlay) {
      return dismissed;
    }
    const how = await dismissOne(tab, overlay);
    if (!how) {
      return dismissed;
    }
    dismissed.push(how);
  }
  return dismissed;
}
