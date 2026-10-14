// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FIRST_TOUCH,
  TouchPhase,
  armFirstTouch,
  firstTouchScript,
} from "./first-touch";

vi.stubGlobal("PointerEvent", class extends MouseEvent {});

const RECT = { left: 100, top: 50, width: 400, height: 200 };

function stage() {
  const lift = document.createElement("div");
  const frame = document.createElement("iframe");
  const overlay = document.createElement("div");
  lift.appendChild(frame);
  document.body.replaceChildren(lift, overlay);
  frame.getBoundingClientRect = () => ({
    ...RECT,
    right: 500,
    bottom: 250,
    x: 100,
    y: 50,
    toJSON: () => ({}),
  });
  const hits: { type: string; x: number; y: number; trusted: boolean }[] = [];
  for (const type of [
    "pointerdown",
    "mousedown",
    "pointermove",
    "mousemove",
    "pointerup",
    "mouseup",
    "click",
  ]) {
    overlay.addEventListener(type, (e) =>
      hits.push({
        type,
        x: (e as MouseEvent).clientX,
        y: (e as MouseEvent).clientY,
        trusted: e.isTrusted,
      }),
    );
  }
  document.elementFromPoint = () => overlay;
  return { lift, frame, overlay, hits };
}

const touch = (
  frame: HTMLIFrameElement,
  phase: TouchPhase,
  x = 0.5,
  y = 0.25,
) =>
  dispatchEvent(
    new MessageEvent("message", {
      source: frame.contentWindow,
      data: { type: FIRST_TOUCH, phase, x, y, button: 0 },
    }),
  );

const activation = (isActive: boolean) =>
  Object.defineProperty(navigator, "userActivation", {
    value: { isActive },
    configurable: true,
  });

describe("the first touch on the preview", () => {
  beforeEach(() => activation(true));
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lifts the frame above the overlays until it is touched", () => {
    const { lift, frame } = stage();

    armFirstTouch(frame, lift);

    expect(frame.style.pointerEvents).toBe("auto");
    expect(lift.style.zIndex).not.toBe("");
  });

  it("hands the press back to the overlay under the same point, then steps aside", () => {
    const { lift, frame, hits } = stage();
    armFirstTouch(frame, lift);

    touch(frame, TouchPhase.Down);
    touch(frame, TouchPhase.Up);

    expect(hits.map((h) => h.type)).toEqual([
      "pointerdown",
      "mousedown",
      "pointerup",
      "mouseup",
      "click",
    ]);
    expect(hits[0]).toMatchObject({ x: 300, y: 100 });
    expect(frame.style.pointerEvents).toBe("");
    expect(lift.style.zIndex).toBe("");
  });

  it("carries the drag of that first press, and no move before it", () => {
    const { lift, frame, hits } = stage();
    armFirstTouch(frame, lift);

    touch(frame, TouchPhase.Move, 0.1, 0.1);
    touch(frame, TouchPhase.Down);
    touch(frame, TouchPhase.Move, 0.75, 0.5);
    touch(frame, TouchPhase.Up, 0.75, 0.5);

    expect(hits.map((h) => h.type)).toEqual([
      "pointerdown",
      "mousedown",
      "pointermove",
      "mousemove",
      "pointerup",
      "mouseup",
      "click",
    ]);
    expect(hits[2]).toMatchObject({ x: 400, y: 150 });
  });

  it("refuses a touch the frame posts without a real user gesture", () => {
    activation(false);
    const { lift, frame, hits } = stage();
    armFirstTouch(frame, lift);

    touch(frame, TouchPhase.Down);

    expect(hits).toEqual([]);
    expect(frame.style.pointerEvents).toBe("auto");
  });

  it("replays one press only: later messages from the frame click nothing", () => {
    const { lift, frame, hits } = stage();
    armFirstTouch(frame, lift);

    touch(frame, TouchPhase.Down);
    touch(frame, TouchPhase.Up);
    touch(frame, TouchPhase.Down);
    touch(frame, TouchPhase.Up);

    expect(hits).toHaveLength(5);
  });

  it("keeps a forged point inside the preview", () => {
    const { lift, frame } = stage();
    const at = vi.spyOn(document, "elementFromPoint");
    armFirstTouch(frame, lift);

    touch(frame, TouchPhase.Down, 9, -3);

    expect(at).toHaveBeenCalledWith(500, 50);
  });

  it("ignores messages from any window but the preview", () => {
    const { lift, frame, hits } = stage();
    armFirstTouch(frame, lift);

    dispatchEvent(
      new MessageEvent("message", {
        source: window,
        data: {
          type: FIRST_TOUCH,
          phase: TouchPhase.Down,
          x: 0.5,
          y: 0.5,
          button: 0,
        },
      }),
    );

    expect(hits).toEqual([]);
  });

  it("disarms when disposed", () => {
    const { lift, frame } = stage();

    armFirstTouch(frame, lift)();

    expect(frame.style.pointerEvents).toBe("");
    expect(lift.style.zIndex).toBe("");
  });
});

describe("the script inside the preview", () => {
  it("posts each press as a fraction of the frame", () => {
    const post = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => {});
    Object.defineProperty(window, "innerWidth", {
      value: 400,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 200,
      configurable: true,
    });
    new Function(firstTouchScript().replace(/^<script>|<\/script>$/g, ""))();

    dispatchEvent(
      new MouseEvent("pointerdown", { clientX: 100, clientY: 50, button: 0 }),
    );

    expect(post).toHaveBeenCalledWith(
      {
        type: FIRST_TOUCH,
        phase: TouchPhase.Down,
        x: 0.25,
        y: 0.25,
        button: 0,
      },
      "*",
    );
  });
});
