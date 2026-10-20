export const LIVE_MESSAGE = 'feega:live';

export enum LiveEvent {
  Wheel = 'wheel',
  GestureStart = 'gesturestart',
  GestureChange = 'gesturechange',
  GestureEnd = 'gestureend',
  Escape = 'escape'
}

export type LiveMessage = { type: typeof LIVE_MESSAGE; event: LiveEvent; x?: number; y?: number; dx?: number; dy?: number; ctrl?: boolean; scale?: number };

export function bridgeMain(message: string, events: Record<'Wheel' | 'Escape' | 'GestureStart' | 'GestureChange' | 'GestureEnd', string>): void {
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
  const gestures: Record<string, string> = { gesturestart: events.GestureStart, gesturechange: events.GestureChange, gestureend: events.GestureEnd };
  Object.keys(gestures).forEach((name) => {
    addEventListener(
      name,
      (e) => {
        e.preventDefault();
        const g = e as Event & { scale: number; clientX: number; clientY: number };
        parent.postMessage({ type: message, event: gestures[name], x: g.clientX, y: g.clientY, scale: g.scale }, '*');
      },
      { passive: false, capture: true }
    );
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      parent.postMessage({ type: message, event: events.Escape }, '*');
    }
  });
}

export const bridgeScript = (): string => `<script>(${bridgeMain.toString()})(${JSON.stringify(LIVE_MESSAGE)},${JSON.stringify({ Wheel: LiveEvent.Wheel, Escape: LiveEvent.Escape, GestureStart: LiveEvent.GestureStart, GestureChange: LiveEvent.GestureChange, GestureEnd: LiveEvent.GestureEnd })});</script>`;
