import { js } from "../../hyperframes/html";
import { COMPOSITION_ID } from "../../hyperframes/capture";
import {
  CUSTOM_ROOT_PREFIX,
  DOM_READ_REPLY,
  DOM_READ_REQUEST,
  NO_INDEX,
  TEXT_PAD,
  READ_ATTRS,
  READ_STYLES,
  type DomReadRequest,
  type RawNode,
  type RawTree,
  type TextLine,
  type TextRaster,
} from "./tree";
import type { SvgNode } from "../../effects/registry";

type ProbeConfig = {
  request: string;
  reply: string;
  timeline: string;
  prefix: string;
  none: number;
  pad: number;
  styles: readonly string[];
  attrs: readonly string[];
};

type Seekable = { pause: () => void; seek: (t: number) => void };

export function domProbe(cfg: ProbeConfig) {
  const UNRENDERED = new Set([
    "style",
    "script",
    "defs",
    "clippath",
    "pattern",
    "lineargradient",
    "radialgradient",
    "filter",
    "mask",
    "symbol",
    "marker",
    "title",
    "desc",
    "metadata",
  ]);
  const UNTRANSFORMED = "feega-dom-read-untransformed";
  const isSvgImage = (el: Element) =>
    !(el instanceof HTMLElement) && el.tagName.toLowerCase() === "image";

  const boxed = (el: Element) =>
    el instanceof HTMLElement ||
    el.tagName.toLowerCase() === "svg" ||
    isSvgImage(el);

  const ownText = (el: Element) =>
    [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? "")
      .join("")
      .trim();

  const untransformed = <T>(measure: () => T): T => {
    const sheet = document.createElement("style");
    sheet.id = UNTRANSFORMED;
    sheet.textContent =
      "*{transform:none!important;translate:none!important;rotate:none!important;scale:none!important}";
    document.head.appendChild(sheet);
    const out = measure();
    sheet.remove();
    return out;
  };

  const PSEUDOS = ["::before", "::after"];
  const UNPSEUDO = "feega-dom-read-unpseudo";
  const SHOWN_CONTENT = /^"(.*)"$/s;
  const EMPTY_CONTENT = new Set(["", "none", "normal"]);

  const pseudoOf = (el: Element, which: string) => {
    const computed = getComputedStyle(el, which);
    if (EMPTY_CONTENT.has(computed.content) || computed.display === "none") {
      return null;
    }
    const style: [string, string][] = [];
    for (let i = 0; i < computed.length; i++) {
      style.push([computed[i], computed.getPropertyValue(computed[i])]);
    }
    return {
      which,
      style,
      text: SHOWN_CONTENT.exec(computed.content)?.[1] ?? "",
    };
  };

  const materialized = (root: HTMLElement) => {
    const hosts = [root, ...root.querySelectorAll("*")]
      .filter((el) => el instanceof HTMLElement)
      .map((el) => ({
        el,
        pseudos: PSEUDOS.flatMap((w) => pseudoOf(el, w) ?? []),
      }))
      .filter((h) => h.pseudos.length);
    const sheet = document.createElement("style");
    sheet.textContent = `.${UNPSEUDO}::before,.${UNPSEUDO}::after{content:none!important}`;
    document.head.appendChild(sheet);
    const made = hosts.flatMap(({ el, pseudos }) => {
      el.classList.add(UNPSEUDO);
      return pseudos.map(({ which, style, text }) => {
        const span = document.createElement("span");
        style
          .filter(([k]) => k !== "content")
          .forEach(([k, v]) => span.style.setProperty(k, v));
        span.textContent = text;
        if (which === PSEUDOS[0]) {
          el.prepend(span);
        } else {
          el.append(span);
        }
        return span;
      });
    });
    return () => {
      made.forEach((span) => span.remove());
      hosts.forEach(({ el }) => el.classList.remove(UNPSEUDO));
      sheet.remove();
    };
  };

  const linesOf = (el: Element, box: DOMRect): TextLine[] => {
    const lines: TextLine[] = [];
    const range = document.createRange();
    for (const node of el.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) {
        continue;
      }
      let offset = 0;
      for (const char of node.textContent ?? "") {
        const start = offset;
        offset += char.length;
        if (!char.trim()) {
          continue;
        }
        range.setStart(node, start);
        range.setEnd(node, offset);
        const rect = range.getClientRects()[0];
        if (!rect || !rect.width) {
          continue;
        }
        const top = rect.top - box.top;
        const last = lines[lines.length - 1];
        const line =
          last && top + rect.height / 2 < last.top + last.height
            ? last
            : lines[
                lines.push({ chars: [], xs: [], top, height: rect.height }) - 1
              ];
        line.chars.push(char);
        line.xs.push(rect.left - box.left);
      }
    }
    return lines;
  };

  type SvgText = Element & {
    getNumberOfChars: () => number;
    getExtentOfChar: (i: number) => DOMRect;
  };
  const charsPlaced = (el: Element): el is SvgText =>
    typeof (el as Partial<SvgText>).getExtentOfChar === "function";

  const svgLinesOf = (el: SvgText): TextLine[] => {
    const chars = [...(el.textContent ?? "").replace(/\s+/g, " ").trim()];
    if (chars.length !== el.getNumberOfChars()) {
      return [];
    }
    const lines: TextLine[] = [];
    chars.forEach((char, i) => {
      const at = el.getExtentOfChar(i);
      if (!char.trim() || !at.width) {
        return;
      }
      const last = lines[lines.length - 1];
      const line =
        last && Math.abs(last.top - at.y) < at.height / 2
          ? last
          : lines[
              lines.push({ chars: [], xs: [], top: at.y, height: at.height }) -
                1
            ];
      line.chars.push(char);
      line.xs.push(at.x);
    });
    return lines;
  };

  const CASES: Record<string, (c: string) => string> = {
    uppercase: (c) => c.toUpperCase(),
    lowercase: (c) => c.toLowerCase(),
  };
  const unquoted = (family: string) =>
    family.trim().replace(/^["']|["']$/g, "");

  const RANGE = /U\+([0-9a-f?]+)(?:-([0-9a-f]+))?/gi;
  const inRange = (range: string, cp: number) =>
    [...range.matchAll(RANGE)].some((m) => {
      const lo = parseInt(m[1].replace(/\?/g, "0"), 16);
      const hi = m[2]
        ? parseInt(m[2], 16)
        : parseInt(m[1].replace(/\?/g, "F"), 16);
      return lo <= cp && cp <= hi;
    });

  const webFaces = () =>
    [...document.fonts].filter((f) => f.status === "loaded");

  const coveredBy = (faces: FontFace[], family: string, lines: TextLine[]) => {
    const own = faces.filter((f) => unquoted(f.family) === family);
    return (
      own.length > 0 &&
      lines.every((l) =>
        l.chars.every((c) =>
          own.some((f) => inRange(f.unicodeRange, c.codePointAt(0)!)),
        ),
      )
    );
  };

  const SUBPIXEL_STEPS = 4;

  const rasterOf = (
    computed: CSSStyleDeclaration,
    lines: TextLine[],
    box: DOMRect,
    layers: Promise<ImageBitmap>[],
  ): TextRaster => {
    const size = parseFloat(computed.fontSize) || 0;
    const left = Math.floor(box.left) - cfg.pad;
    const top = Math.floor(box.top) - cfg.pad;
    const right = Math.max(
      box.right,
      ...lines.map((l) => box.left + (l.xs[l.xs.length - 1] ?? 0) + 2 * size),
    );
    const bottom = Math.max(
      box.bottom,
      ...lines.map((l) => box.top + l.top + l.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(right) + cfg.pad - left;
    canvas.height = Math.ceil(bottom) + cfg.pad - top;
    const pen = canvas.getContext("2d") as CanvasRenderingContext2D;
    pen.font = `${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
    pen.fillStyle = computed.color;
    const cased = CASES[computed.textTransform] ?? ((c: string) => c);
    for (const line of lines) {
      line.chars.forEach((raw, i) => {
        const char = cased(raw);
        const x =
          Math.round((box.left + line.xs[i]) * SUBPIXEL_STEPS) / SUBPIXEL_STEPS;
        const baseline = Math.round(
          box.top +
            line.top +
            Math.round(pen.measureText(char).fontBoundingBoxAscent),
        );
        pen.fillText(char, x - left, baseline - top);
      });
    }
    return {
      layer: layers.push(createImageBitmap(canvas)) - 1,
      width: canvas.width,
      height: canvas.height,
      at: [left - box.left, top - box.top],
    };
  };

  const URL_IMAGE = /url\(\s*["']?([^"')]+)["']?\s*\)/;
  const loaded = new Map<string, Promise<HTMLImageElement>>();

  const loadImage = (src: string) => {
    const known = loaded.get(src);
    if (known) {
      return known;
    }
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = src;
    const ready = image.decode().then(() => image);
    loaded.set(src, ready);
    return ready;
  };

  const lengthIn = (value: string | undefined, basis: number, auto: number) =>
    !value || value === "auto"
      ? auto
      : value.endsWith("%")
        ? (parseFloat(value) * basis) / 100
        : parseFloat(value);

  const tileIn = (
    value: string,
    box: [number, number],
    image: HTMLImageElement,
  ): [number, number] => {
    const [iw, ih] = [
      image.naturalWidth || box[0],
      image.naturalHeight || box[1],
    ];
    if (value === "cover" || value === "contain") {
      const scale = (value === "cover" ? Math.max : Math.min)(
        box[0] / iw,
        box[1] / ih,
      );
      return [iw * scale, ih * scale];
    }
    const [w, h] = value.split(/\s+/);
    const width = lengthIn(w, box[0], NaN);
    const height = lengthIn(h, box[1], NaN);
    return [
      width || (height ? (iw * height) / ih : iw),
      height || (width ? (ih * width) / iw : ih),
    ];
  };

  const splitLayers = (value: string) => {
    const layers: string[] = [];
    let [depth, quote, start] = [0, "", 0];
    for (let i = 0; i < value.length; i++) {
      const c = value[i];
      if (quote) {
        i += c === "\\" ? 1 : 0;
        quote = c === quote ? "" : quote;
        continue;
      }
      if (c === '"' || c === "'") {
        quote = c;
      }
      depth += c === "(" ? 1 : c === ")" ? -1 : 0;
      if (c === "," && depth === 0) {
        layers.push(value.slice(start, i).trim());
        start = i + 1;
      }
    }
    return [...layers, value.slice(start).trim()];
  };

  const QUOTED_URL = /^url\(\s*(["'])((?:(?!\1)[^\\]|\\.)*)\1\s*\)$/;
  const BARE_URL = /^url\(\s*([^)\s]*)\s*\)$/;
  const urlOf = (layer: string) => {
    const quoted = QUOTED_URL.exec(layer);
    return quoted
      ? quoted[2].replace(/\\(.)/g, "$1")
      : (BARE_URL.exec(layer)?.[1] ?? null);
  };

  const bitmapOf = async (
    size: [number, number],
    paint: (pen: CanvasRenderingContext2D) => Promise<void>,
  ) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(size[0]));
    canvas.height = Math.max(1, Math.ceil(size[1]));
    await paint(canvas.getContext("2d") as CanvasRenderingContext2D).catch(
      () => undefined,
    );
    return createImageBitmap(canvas);
  };

  const backgroundLayer = (
    computed: CSSStyleDeclaration,
    size: [number, number],
  ) =>
    bitmapOf(size, async (pen) => {
      const images = splitLayers(computed.backgroundImage);
      const sizes = splitLayers(computed.backgroundSize);
      const positions = splitLayers(computed.backgroundPosition);
      const repeats = splitLayers(computed.backgroundRepeat);
      for (let i = images.length - 1; i >= 0; i--) {
        const src = urlOf(images[i]);
        if (!src) {
          continue;
        }
        const image = await loadImage(src);
        const [tw, th] = tileIn(sizes[i % sizes.length] ?? "auto", size, image);
        const [px, py] = (positions[i % positions.length] ?? "0% 0%").split(
          /\s+/,
        );
        const x = lengthIn(px, size[0] - tw, 0);
        const y = lengthIn(py, size[1] - th, 0);
        if ((repeats[i % repeats.length] ?? "repeat") === "no-repeat") {
          pen.drawImage(image, x, y, tw, th);
          continue;
        }
        const tile = document.createElement("canvas");
        tile.width = Math.max(1, Math.round(tw));
        tile.height = Math.max(1, Math.round(th));
        tile.getContext("2d")?.drawImage(image, 0, 0, tile.width, tile.height);
        const pattern = pen.createPattern(tile, "repeat");
        pattern?.setTransform(
          new DOMMatrix([tw / tile.width, 0, 0, th / tile.height, x, y]),
        );
        pen.fillStyle = pattern ?? "transparent";
        pen.fillRect(0, 0, size[0], size[1]);
      }
    });

  const imageLayer = (
    image: HTMLImageElement,
    computed: CSSStyleDeclaration,
    size: [number, number],
  ) =>
    bitmapOf(size, async (pen) => {
      await image.decode();
      const [iw, ih] = [image.naturalWidth, image.naturalHeight];
      const fit = computed.objectFit;
      const scale =
        fit === "cover"
          ? Math.max(size[0] / iw, size[1] / ih)
          : fit === "contain"
            ? Math.min(size[0] / iw, size[1] / ih)
            : NaN;
      const [w, h] = Number.isNaN(scale) ? size : [iw * scale, ih * scale];
      pen.drawImage(image, (size[0] - w) / 2, (size[1] - h) / 2, w, h);
    });

  const SLICE = /\bslice\b/;
  const NONE = /^none\b/;

  const svgImageLayer = (el: Element, size: [number, number]) =>
    bitmapOf(size, async (pen) => {
      const image = await loadImage(el.getAttribute("href") ?? "");
      const [iw, ih] = [image.naturalWidth, image.naturalHeight];
      const aspect = el.getAttribute("preserveAspectRatio") ?? "";
      const scale = NONE.test(aspect)
        ? NaN
        : (SLICE.test(aspect) ? Math.max : Math.min)(
            size[0] / iw,
            size[1] / ih,
          );
      const [w, h] = Number.isNaN(scale) ? size : [iw * scale, ih * scale];
      pen.drawImage(image, (size[0] - w) / 2, (size[1] - h) / 2, w, h);
    });

  const REFERENCE = /url\(\s*["']?#([^"')]+)["']?\s*\)/;
  const REFERRING = ["clip-path", "filter", "fill", "stroke", "mask-image"];

  const SVG_NS = "http://www.w3.org/2000/svg";
  const PAINTED_BY = ["fill", "stroke"];
  const SVG_LOOKS = [
    "fill",
    "fill-opacity",
    "fill-rule",
    "stroke",
    "stroke-width",
    "stroke-opacity",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-dasharray",
    "opacity",
    "visibility",
    "transform",
    "transform-origin",
    "font-family",
    "font-size",
    "font-weight",
  ];

  const referencedTag = (value: string) => {
    const id = REFERENCE.exec(value)?.[1];
    return id ? document.getElementById(id)?.tagName.toLowerCase() : undefined;
  };

  const UNEMBEDDED = "text, image, foreignObject";

  const rasterisedSvg = (svg: Element) =>
    !svg.querySelector(UNEMBEDDED) &&
    [...svg.querySelectorAll("*")].some(
      (e) =>
        e.hasAttribute("mask") ||
        referencedTag(e.getAttribute("filter") ?? "") === "filter" ||
        PAINTED_BY.some(
          (k) => referencedTag(e.getAttribute(k) ?? "") === "pattern",
        ),
    );

  const svgLayer = (svg: Element, size: [number, number]) => {
    const clone = svg.cloneNode(true) as SVGElement;
    const copies = [clone, ...clone.querySelectorAll("*")] as SVGElement[];
    [svg, ...svg.querySelectorAll("*")].forEach((source, i) => {
      const computed = getComputedStyle(source);
      SVG_LOOKS.map((k) => [k, computed.getPropertyValue(k)])
        .filter(([, v]) => !v.includes("url("))
        .forEach(([k, v]) => copies[i].style?.setProperty(k, v));
    });
    const borrowed = [
      ...new Set(
        [svg, ...svg.querySelectorAll("*")].flatMap((e) =>
          [...e.attributes].map((a) => REFERENCE.exec(a.value)?.[1] ?? ""),
        ),
      ),
    ]
      .map((id) => (id ? document.getElementById(id) : null))
      .filter((def): def is HTMLElement => def !== null && !svg.contains(def))
      .map((def) => def.cloneNode(true));
    if (borrowed.length) {
      const defs = document.createElementNS(SVG_NS, "defs");
      defs.append(...borrowed);
      clone.prepend(defs);
    }
    clone.style.transform = "none";
    clone.style.position = "static";
    clone.setAttribute("xmlns", SVG_NS);
    clone.setAttribute("width", String(size[0]));
    clone.setAttribute("height", String(size[1]));
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
    return bitmapOf(size, async (pen) => {
      const image = await loadImage(src);
      pen.drawImage(image, 0, 0, size[0], size[1]);
    });
  };

  const serialized = (el: Element): SvgNode => ({
    tag: el.tagName,
    attrs: Object.fromEntries([...el.attributes].map((a) => [a.name, a.value])),
    children: [...el.children].map(serialized),
  });

  const defsOf = (nodes: RawNode[]): Record<string, SvgNode> => {
    const ids = new Set(
      nodes.flatMap((n) =>
        REFERRING.map(
          (k) =>
            REFERENCE.exec(n.style[k as keyof RawNode["style"]] ?? "")?.[1],
        ).filter((id): id is string => Boolean(id)),
      ),
    );
    return Object.fromEntries(
      [...ids].flatMap((id) => {
        const el = document.getElementById(id);
        return el ? [[id, serialized(el)]] : [];
      }),
    );
  };

  const read = (root: HTMLElement, layers: Promise<ImageBitmap>[]): RawTree => {
    const restore = materialized(root);
    try {
      return readNow(root, layers);
    } finally {
      restore();
    }
  };

  const readNow = (
    root: HTMLElement,
    layers: Promise<ImageBitmap>[],
  ): RawTree => {
    const nodes: RawNode[] = [];
    const elements: Element[] = [];
    const visit = (el: Element, parent: number) => {
      const tag = el.tagName.toLowerCase();
      if (UNRENDERED.has(tag)) {
        return;
      }
      const computed = getComputedStyle(el);
      if (computed.display === "none") {
        return;
      }
      const style = Object.fromEntries(
        cfg.styles.map((k) => [k, computed.getPropertyValue(k)]),
      );
      const attrs = Object.fromEntries(
        cfg.attrs.flatMap((k) =>
          el.hasAttribute(k) ? [[k, el.getAttribute(k) ?? ""]] : [],
        ),
      );
      const layer =
        el instanceof HTMLCanvasElement
          ? layers.push(createImageBitmap(el)) - 1
          : cfg.none;
      const text = tag === "text" ? (el.textContent ?? "").trim() : ownText(el);
      nodes.push({
        tag,
        svg: !(el instanceof HTMLElement),
        parent,
        at: null,
        size: [0, 0],
        style,
        attrs,
        text,
        lines: [],
        raster: null,
        layer,
      });
      elements.push(el);
      const me = nodes.length - 1;
      for (const child of el.children) {
        visit(child, me);
      }
    };
    visit(root, cfg.none);
    const rects = untransformed(() => {
      const boxes = elements.map((el) => el.getBoundingClientRect());
      const web = webFaces();
      elements.forEach((el, i) => {
        if (!nodes[i].text) {
          return;
        }
        if (charsPlaced(el)) {
          nodes[i].lines = svgLinesOf(el);
          return;
        }
        if (!(el instanceof HTMLElement)) {
          return;
        }
        const computed = getComputedStyle(el);
        nodes[i].lines = linesOf(el, boxes[i]);
        nodes[i].raster = coveredBy(
          web,
          unquoted(computed.fontFamily.split(",")[0]),
          nodes[i].lines,
        )
          ? null
          : rasterOf(computed, nodes[i].lines, boxes[i], layers);
      });
      return boxes;
    });
    nodes.forEach((node, i) => {
      if (!boxed(elements[i])) {
        return;
      }
      const own = rects[i];
      const base = node.parent === cfg.none ? own : rects[node.parent];
      node.at = [own.left - base.left, own.top - base.top];
      node.size = [own.width, own.height];
    });
    nodes.forEach((node, i) => {
      const el = elements[i];
      if (node.layer === cfg.none && isSvgImage(el)) {
        node.layer = layers.push(svgImageLayer(el, node.size)) - 1;
        return;
      }
      if (node.tag === "svg" && rasterisedSvg(el)) {
        node.layer = layers.push(svgLayer(el, node.size)) - 1;
        return;
      }
      if (node.layer !== cfg.none || !(el instanceof HTMLElement)) {
        return;
      }
      const computed = getComputedStyle(el);
      if (el instanceof HTMLImageElement) {
        node.layer = layers.push(imageLayer(el, computed, node.size)) - 1;
        return;
      }
      if (URL_IMAGE.test(computed.backgroundImage)) {
        node.layer = layers.push(backgroundLayer(computed, node.size)) - 1;
      }
    });
    return {
      width: rects[0]?.width ?? 0,
      height: rects[0]?.height ?? 0,
      nodes,
      defs: defsOf(nodes),
    };
  };

  addEventListener("message", (e: MessageEvent) => {
    const m = e.data as DomReadRequest;
    if (!m || m.type !== cfg.request) {
      return;
    }
    const source = e.source as Window | null;
    const w = window as unknown as {
      __timelines?: Record<string, Seekable>;
      __fontsReady?: Promise<unknown>;
      __hfWaitForSeekCompletion?: () => Promise<void>;
      __hf?: { buildReady?: Record<string, Promise<unknown>> };
      __player?: { renderSeek?: (t: number, o: { exact: boolean }) => void };
    };
    const done = (body: Record<string, unknown>, transfer: Transferable[]) =>
      source?.postMessage(
        { type: cfg.reply, id: m.id, time: m.time, ...body },
        { targetOrigin: "*", transfer },
      );
    Promise.resolve(w.__fontsReady)
      .then(() => document.fonts.ready)
      .then(() => Promise.all(Object.values(w.__hf?.buildReady ?? {})))
      .then(() => {
        const tl = w.__timelines?.[cfg.timeline];
        tl?.pause();
        if (w.__player?.renderSeek) {
          w.__player.renderSeek(m.time, { exact: true });
          return;
        }
        tl?.seek(m.time);
      })
      .then(() => w.__hfWaitForSeekCompletion?.())
      .then(async () => {
        const pending: Promise<ImageBitmap>[] = [];
        const trees = Object.fromEntries(
          m.clips.flatMap((clip) => {
            const root =
              document.getElementById(cfg.prefix + clip) ??
              document.querySelector<HTMLElement>(
                `[data-clip="${CSS.escape(clip)}"]`,
              );
            return root ? [[clip, read(root, pending)]] : [];
          }),
        );
        const layers = await Promise.all(pending);
        done({ trees, layers }, layers);
      })
      .catch((err) => done({ trees: {}, layers: [], error: String(err) }, []));
  });
}

export function domProbeScript(): string {
  const cfg: ProbeConfig = {
    request: DOM_READ_REQUEST,
    reply: DOM_READ_REPLY,
    timeline: COMPOSITION_ID,
    prefix: CUSTOM_ROOT_PREFIX,
    none: NO_INDEX,
    pad: TEXT_PAD,
    styles: READ_STYLES,
    attrs: READ_ATTRS,
  };
  return `<script>(${domProbe.toString()})(${js(cfg)});</script>`;
}
