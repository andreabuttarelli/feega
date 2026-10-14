import { js } from "./html";

export const FIRST_TOUCH = "feega:touch";

export enum TouchPhase {
  Down = "pointerdown",
  Move = "pointermove",
  Up = "pointerup",
}

export type FirstTouch = {
  type: typeof FIRST_TOUCH;
  phase: TouchPhase;
  x: number;
  y: number;
  button: number;
};

const ARMED_LAYER = "2147483647";

const REPLAYED: Record<TouchPhase, string[]> = {
  [TouchPhase.Down]: ["pointerdown", "mousedown"],
  [TouchPhase.Move]: ["pointermove", "mousemove"],
  [TouchPhase.Up]: ["pointerup", "mouseup", "click"],
};

export function firstTouchScript(): string {
  const phases = js(Object.values(TouchPhase));
  return `<script>${phases}.forEach(function(phase){addEventListener(phase,function(e){parent.postMessage({type:${js(FIRST_TOUCH)},phase:phase,x:e.clientX/innerWidth,y:e.clientY/innerHeight,button:e.button},'*');},true);});</script>`;
}

const clamp = (n: number) => Math.min(1, Math.max(0, Number(n) || 0));

function pointOf(frame: HTMLIFrameElement, touch: FirstTouch) {
  const box = frame.getBoundingClientRect();
  return {
    clientX: box.left + clamp(touch.x) * box.width,
    clientY: box.top + clamp(touch.y) * box.height,
  };
}

function replay(
  target: Element,
  touch: FirstTouch,
  point: { clientX: number; clientY: number },
) {
  const init = {
    ...point,
    button: touch.button,
    bubbles: true,
    cancelable: true,
    composed: true,
  };
  for (const type of REPLAYED[touch.phase]) {
    const pointer = type.startsWith("pointer");
    target.dispatchEvent(
      pointer
        ? new PointerEvent(type, {
            ...init,
            pointerId: 1,
            pointerType: "mouse",
            isPrimary: true,
          })
        : new MouseEvent(type, init),
    );
  }
}

const gestured = () =>
  (navigator as Navigator & { userActivation?: { isActive: boolean } })
    .userActivation?.isActive === true;

export function armFirstTouch(
  frame: HTMLIFrameElement,
  lift: HTMLElement,
): () => void {
  let pressed: Element | null = null;

  const lower = () => {
    frame.style.pointerEvents = "";
    lift.style.zIndex = "";
  };

  const stop = () => {
    lower();
    removeEventListener("message", onMessage);
  };

  function onMessage(e: MessageEvent) {
    const touch = e.data as FirstTouch;
    if (e.source !== frame.contentWindow || touch?.type !== FIRST_TOUCH) {
      return;
    }
    const point = pointOf(frame, touch);

    if (touch.phase === TouchPhase.Down && !pressed && gestured()) {
      lower();
      pressed = document.elementFromPoint(point.clientX, point.clientY);
      if (pressed) {
        replay(pressed, touch, point);
      }
      return;
    }

    if (!pressed || touch.phase === TouchPhase.Down) {
      return;
    }
    replay(pressed, touch, point);
    if (touch.phase === TouchPhase.Up) {
      stop();
    }
  }

  frame.style.pointerEvents = "auto";
  lift.style.zIndex = ARMED_LAYER;
  addEventListener("message", onMessage);
  return stop;
}
