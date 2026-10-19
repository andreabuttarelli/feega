export enum ZoomStep {
  In = 'in',
  Out = 'out',
  Fit = 'fit'
}

export type CanvasZoom = {
  step: (step: ZoomStep) => void;
  scaleBy: (factor: number) => void;
};

type GestureEvent = UIEvent & { scale: number };

const STEP_OF_KEY: Record<string, ZoomStep> = {
  '+': ZoomStep.In,
  '=': ZoomStep.In,
  '-': ZoomStep.Out,
  _: ZoomStep.Out,
  '0': ZoomStep.Fit
};

const WHEEL_ZOOM_SPEED = 0.01;
const LOCKED_ATTR = 'data-page-zoom-locked';
const OWNS_PINCH = '[data-owns-pinch], .svelte-flow';
const ACTIVE = { passive: false } as const;
const ACTIVE_CAPTURE = { passive: false, capture: true } as const;
const CAPTURE = { capture: true } as const;

export function browserZoomStep(e: KeyboardEvent): ZoomStep | null {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) {
    return null;
  }
  return STEP_OF_KEY[e.key] ?? null;
}

export function wheelFactor(deltaY: number): number {
  return Math.exp(-deltaY * WHEEL_ZOOM_SPEED);
}

function ownsPinch(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(OWNS_PINCH) !== null;
}

export function lockPageZoom(win: Window, zoom: CanvasZoom | null): () => void {
  let gestureScale = 1;
  let pinchSentWheels = false;

  const blockPinch = (e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      pinchSentWheels = true;
    }
  };

  const forwardPinch = (e: WheelEvent) => {
    if (e.ctrlKey) {
      zoom?.scaleBy(wheelFactor(e.deltaY));
    }
  };

  const onKey = (e: KeyboardEvent) => {
    const step = browserZoomStep(e);
    if (!step) {
      return;
    }
    e.preventDefault();
    zoom?.step(step);
  };

  const onGestureStart = (e: Event) => {
    e.preventDefault();
    gestureScale = 1;
    pinchSentWheels = false;
  };

  const onGestureChange = (e: Event) => {
    e.preventDefault();
    const scale = (e as GestureEvent).scale;
    if (pinchSentWheels || ownsPinch(e.target)) {
      return;
    }
    zoom?.scaleBy(scale / gestureScale);
    gestureScale = scale;
  };

  const block = (e: Event) => e.preventDefault();

  const blockMultiTouch = (e: TouchEvent) => {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  };

  const root = win.document.documentElement;
  root.setAttribute(LOCKED_ATTR, '');

  win.addEventListener('wheel', blockPinch, ACTIVE_CAPTURE);
  win.addEventListener('wheel', forwardPinch, ACTIVE);
  win.addEventListener('keydown', onKey);
  win.addEventListener('gesturestart', onGestureStart, ACTIVE);
  win.addEventListener('gesturechange', onGestureChange, ACTIVE);
  win.addEventListener('gestureend', block, ACTIVE);
  win.addEventListener('touchmove', blockMultiTouch, ACTIVE_CAPTURE);

  return () => {
    root.removeAttribute(LOCKED_ATTR);
    win.removeEventListener('wheel', blockPinch, CAPTURE);
    win.removeEventListener('wheel', forwardPinch);
    win.removeEventListener('keydown', onKey);
    win.removeEventListener('gesturestart', onGestureStart);
    win.removeEventListener('gesturechange', onGestureChange);
    win.removeEventListener('gestureend', block);
    win.removeEventListener('touchmove', blockMultiTouch, CAPTURE);
  };
}
