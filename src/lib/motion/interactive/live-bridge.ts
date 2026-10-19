export const LIVE_MESSAGE = 'feega:live';

export enum LiveEvent {
  Wheel = 'wheel',
  Escape = 'escape'
}

export type LiveMessage = { type: typeof LIVE_MESSAGE; event: LiveEvent; x?: number; y?: number; dx?: number; dy?: number; ctrl?: boolean };

export function bridgeMain(message: string, events: Record<'Wheel' | 'Escape', string>): void {
  const scrolls = () => document.documentElement.scrollHeight > document.documentElement.clientHeight;
  addEventListener(
    'wheel',
    (e) => {
      if (scrolls()) {
        return;
      }
      e.preventDefault();
      parent.postMessage({ type: message, event: events.Wheel, x: e.clientX, y: e.clientY, dx: e.deltaX, dy: e.deltaY, ctrl: e.ctrlKey || e.metaKey }, '*');
    },
    { passive: false, capture: true }
  );
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      parent.postMessage({ type: message, event: events.Escape }, '*');
    }
  });
}

export const bridgeScript = (): string => `<script>(${bridgeMain.toString()})(${JSON.stringify(LIVE_MESSAGE)},${JSON.stringify({ Wheel: LiveEvent.Wheel, Escape: LiveEvent.Escape })});</script>`;
