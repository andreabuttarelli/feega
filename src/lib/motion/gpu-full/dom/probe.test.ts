// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { domProbe } from "@feega/motion-core/motion/gpu-full/dom/probe";
import {
  CUSTOM_ROOT_PREFIX,
  DOM_READ_REPLY,
  DOM_READ_REQUEST,
  NO_INDEX,
  READ_ATTRS,
  READ_STYLES,
  TEXT_PAD,
} from "@feega/motion-core/motion/gpu-full/dom/tree";

const CLIP = "poster";
const CONFIG = {
  request: DOM_READ_REQUEST,
  reply: DOM_READ_REPLY,
  timeline: "main",
  prefix: CUSTOM_ROOT_PREFIX,
  none: NO_INDEX,
  pad: TEXT_PAD,
  styles: READ_STYLES,
  attrs: READ_ATTRS,
};

type Reply = {
  type: string;
  id: string;
  trees: Record<string, unknown>;
  error?: string;
};

function asked(body: string): Promise<{ reply: Reply; frames: number }> {
  document.body.innerHTML = `<div id="${CUSTOM_ROOT_PREFIX}${CLIP}">${body}</div>`;
  let frames = 0;
  vi.stubGlobal("requestAnimationFrame", (run: () => void) => {
    frames += 1;
    setTimeout(run, 0);
    return frames;
  });
  vi.stubGlobal("createImageBitmap", async () => ({ width: 1, height: 1 }));
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: Object.assign([], { ready: Promise.resolve() }),
  });
  return new Promise((resolve) => {
    const source = {
      postMessage: (reply: Reply) => resolve({ reply, frames }),
    } as unknown as Window;
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: DOM_READ_REQUEST, id: "a", time: 0, clips: [CLIP] },
        source,
      }),
    );
  });
}

describe("domProbe", () => {
  beforeAll(() => domProbe(CONFIG));
  afterEach(() => vi.unstubAllGlobals());

  it("answers a page of plain elements without waiting for an animation frame", async () => {
    const { reply, frames } = await asked("<div></div>");

    expect(reply.error).toBeUndefined();
    expect(Object.keys(reply.trees)).toEqual([CLIP]);
    expect(frames).toBe(0);
  });

  it("does not wait for an animation frame to read a clip with a canvas", async () => {
    const { reply, frames } = await asked("<canvas></canvas>");

    expect(reply.error).toBeUndefined();
    expect(frames).toBe(0);
  });

  it("hands an image and a url background a bitmap of their own", async () => {
    const { reply } = await asked(
      '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><div style="background-image: url(data:image/gif;base64,R0lGODlhAQABAAAAACw=)"></div><div></div>',
    );
    const nodes = (
      reply.trees[CLIP] as { nodes: { tag: string; layer: number }[] }
    ).nodes;

    expect(nodes.map((n) => n.layer)).toEqual([NO_INDEX, 0, 1, NO_INDEX]);
  });

  it("hands an svg image a bitmap of its own, as it does an img", async () => {
    const { reply } = await asked(
      '<svg width="10" height="10"><image href="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="10" height="10" preserveAspectRatio="xMidYMid slice"></image></svg>',
    );
    const nodes = (
      reply.trees[CLIP] as { nodes: { tag: string; layer: number }[] }
    ).nodes;

    expect(nodes.find((n) => n.tag === "image")?.layer).not.toBe(NO_INDEX);
  });

  it("loads a data url background whole, even with a url() and quotes inside it", async () => {
    const loaded: string[] = [];
    class Loading {
      crossOrigin: string | null = null;
      naturalWidth = 1;
      naturalHeight = 1;
      set src(value: string) {
        loaded.push(value);
      }
      decode = async () => undefined;
    }
    vi.stubGlobal("Image", Loading);
    const noise = "data:image/svg+xml,%3Csvg%3E%3Crect filter='url(%23n)'/%3E%3C/svg%3E";
    const image = `url("${noise}")`;
    const computed = window.getComputedStyle.bind(window);
    vi.stubGlobal("getComputedStyle", (el: Element, pseudo?: string) => {
      const real = computed(el, pseudo);
      return el.classList.contains("noise")
        ? new Proxy(real, {
            get: (target, key) =>
              key === "backgroundImage"
                ? image
                : key === "getPropertyValue"
                  ? (k: string) => (k === "background-image" ? image : target.getPropertyValue(k))
                  : Reflect.get(target, key),
          })
        : real;
    });

    await asked('<div class="noise"></div>');
    await new Promise((r) => setTimeout(r, 0));

    expect(loaded).toEqual([noise]);
  });

  it("loads a remote svg image with CORS, so its bitmap can leave the frame", async () => {
    const loaded: string[] = [];
    class Loading {
      crossOrigin: string | null = null;
      naturalWidth = 1;
      naturalHeight = 1;
      set src(_: string) {
        loaded.push(String(this.crossOrigin));
      }
      decode = async () => undefined;
    }
    vi.stubGlobal("Image", Loading);

    await asked(
      '<svg width="10" height="10"><image href="https://files.example/a.jpg" width="10" height="10"></image></svg>',
    );
    await new Promise((r) => setTimeout(r, 0));

    expect(loaded).toEqual(["anonymous"]);
  });

  it("reads a ::before and an ::after as elements in their place, with their styles, and puts the page back", async () => {
    const declared = (style: Record<string, string>) =>
      Object.assign(Object.keys(style), {
        content: style.content,
        display: style.display ?? "inline",
        getPropertyValue: (k: string) => style[k] ?? "",
      });
    const PSEUDO: Record<string, Record<string, string>> = {
      "::before": { content: '""', position: "absolute", "background-color": "rgb(1, 2, 3)" },
      "::after": { content: '""', color: "rgb(4, 5, 6)" },
    };
    const computed = window.getComputedStyle.bind(window);
    vi.stubGlobal("getComputedStyle", (el: Element, pseudo?: string) =>
      pseudo
        ? declared(el.classList.contains("grain") ? PSEUDO[pseudo] : { content: "none" })
        : computed(el),
    );

    const { reply } = await asked('<div class="grain"><i></i></div>');
    const nodes = (
      reply.trees[CLIP] as { nodes: { tag: string; parent: number; style: Record<string, string>; text: string }[] }
    ).nodes;
    const grain = nodes.findIndex((n, i) => i > 0 && n.tag === "div");
    const kids = nodes.filter((n) => n.parent === grain);

    expect(kids.map((n) => n.tag)).toEqual(["span", "i", "span"]);
    expect(kids[0].style["background-color"]).toBe("rgb(1, 2, 3)");
    expect(kids[2].style.color).toBe("rgb(4, 5, 6)");
    expect(document.querySelectorAll(".grain span")).toHaveLength(0);
  });

  it("hands an svg with masks or pattern paint a bitmap of the whole svg, and not a plain one", async () => {
    const { reply } = await asked(
      '<svg width="40" height="40"><defs><pattern id="dots"></pattern><mask id="m"></mask></defs><rect width="40" height="40" fill="url(#dots)" mask="url(#m)"></rect></svg><svg width="10" height="10"><rect width="10" height="10"></rect></svg>',
    );
    const nodes = (reply.trees[CLIP] as { nodes: { tag: string; layer: number }[] }).nodes;

    expect(nodes.filter((n) => n.tag === "svg").map((n) => n.layer !== NO_INDEX)).toEqual([true, false]);
  });

  it("places svg text by its characters in the text's own user space, without a raster", async () => {
    const extents: Record<string, DOMRect> = { 0: { x: 5, y: 8, width: 6, height: 14 } as DOMRect, 1: { x: 11, y: 8, width: 6, height: 14 } as DOMRect };
    Object.assign(window.SVGElement.prototype, {
      getNumberOfChars: () => 2,
      getExtentOfChar: (i: number) => extents[i],
    });

    const { reply } = await asked('<svg width="40" height="40"><text x="5" y="20">ab</text></svg>');
    const nodes = (reply.trees[CLIP] as { nodes: { tag: string; lines: unknown[]; raster: unknown }[] }).nodes;
    const text = nodes.find((n) => n.tag === "text");

    expect(text?.lines).toEqual([{ chars: ["a", "b"], xs: [5, 11], top: 8, height: 14 }]);
    expect(text?.raster).toBeNull();
  });
});
