<script lang="ts">
  import { onMount } from 'svelte';
  import { ACTIONS_BY_TARGET, AGENTS, BUILD_CLASS, BUILD_SELECTOR, PEER_COLOURS, curve, initials, outermost, pick, rewriteFrom, thin, typeFrames, type ActionKind, type Point, type TargetKind } from './live-agents';

  type Box = { x: number; y: number; w: number; h: number };
  type Menu = { items: string[]; active: number };
  type View = { name: string; colour: string; x: number; y: number; box: Box | null; handles: boolean; marks: Box[]; caret: Box | null; tip: string | null; menu: Menu | null; live: boolean };
  type Anchor = { el: HTMLElement | null; fx: number; fy: number };
  type Step = { ms: number; move?: boolean; start?: () => void; tick?: (t: number) => void; end?: () => void };
  type Agent = { skills: ActionKind[]; view: View; anchor: Anchor; from: Point; steps: Step[]; step: Step | null; since: number; target: HTMLElement | null; typing: boolean; grow: number; push: Point; seed: number };

  const DESKTOP_AGENTS = 16;
  const MOBILE_AGENTS = 6;
  const MOBILE_QUERY = '(max-width: 809.98px)';
  const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
  const STAGGER_MS = 700;
  const NEAR_VIEWPORT_PX = 120;
  const AVOID_RADIUS = 110;
  const AVOID_PUSH = 70;
  const JITTER_PX = 1.6;
  const BEND_PX = 40;
  const EASE_PUSH = 0.12;
  const TEMPO = 2.6;
  const MAX_TYPE_FRAMES = 40;
  const PARALLEL_FRONT = 4;
  const IDLE_SHARE = 0.4;
  const MEDIA_START_SCALE = 0.6;
  const FONTS = ['BDO Grotesk', 'Instrument Serif', 'DM Sans', 'Fragment Mono', 'Inter'];
  const SWATCHES = ['#ff4000', '#f0eee9', '#0090ff', '#ffc53d', '#30a46c'];
  const STYLE_PROPS = ['min-height', 'font-family', 'color', 'scale', 'translate', 'transition', 'transform-origin', 'min-width'];

  let agents = $state<View[]>([]);
  let running: Agent[] = [];
  const busy = new Set<HTMLElement>();
  const originals = new Map<HTMLElement, string>();
  const mouse: Point = { x: -1e4, y: -1e4 };

  const rand = Math.random;
  const between = (a: number, b: number) => a + rand() * (b - a);

  function kindOf(el: HTMLElement): TargetKind {
    if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement) {
      return 'media';
    }

    const only = el.childNodes.length === 1 ? el.firstChild : null;
    return only instanceof Text && only.data.trim().length > 0 ? 'text' : 'block';
  }

  function boxOf(el: Element): Box {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  function nearViewport(el: HTMLElement): boolean {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.bottom > -NEAR_VIEWPORT_PX && r.top < innerHeight + NEAR_VIEWPORT_PX;
  }

  function resolve(a: Anchor): Point {
    if (!a.el) {
      return { x: a.fx * innerWidth, y: a.fy * innerHeight };
    }

    const b = boxOf(a.el);
    return { x: b.x + b.w * a.fx, y: b.y + b.h * a.fy };
  }

  function textRects(el: HTMLElement, from: number): Box[] {
    const node = el.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) {
      return [];
    }

    const range = document.createRange();
    const len = node.textContent?.length ?? 0;
    range.setStart(node, Math.min(from, len));
    range.setEnd(node, len);
    return [...range.getClientRects()].map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height }));
  }

  function caretOf(el: HTMLElement): Box | null {
    const node = el.firstChild;
    const len = node?.textContent?.length ?? 0;
    if (!node || len === 0) {
      const b = boxOf(el);
      return { x: b.x, y: b.y, w: 2, h: b.h };
    }

    const last = textRects(el, len - 1).at(-1);
    return last ? { x: last.x + last.w, y: last.y, w: 2, h: last.h } : null;
  }

  function restore(el: HTMLElement) {
    const text = originals.get(el);
    if (text !== undefined) {
      (el.firstChild as Text).data = text;
      originals.delete(el);
    }

    for (const prop of STYLE_PROPS) {
      el.style.removeProperty(prop);
    }
  }

  function moveTo(agent: Agent, anchor: Anchor): Step {
    return {
      ms: 1,
      move: true,
      start() {
        agent.from = resolve(agent.anchor);
        agent.anchor = anchor;
        const to = resolve(anchor);
        this.ms = Math.min(1500, 450 + Math.hypot(to.x - agent.from.x, to.y - agent.from.y) * 0.7);
      }
    };
  }

  function wait(ms: number, end?: () => void): Step {
    return { ms, end };
  }

  function select(agent: Agent, el: HTMLElement, handles: boolean): Step {
    return wait(between(180, 320), () => {
      agent.target = el;
      agent.view.handles = handles;
    });
  }

  function release(agent: Agent, el: HTMLElement): Step {
    return wait(between(300, 700), () => {
      restore(el);
      busy.delete(el);
      agent.target = null;
      agent.typing = false;
      agent.grow = 1;
      agent.view.handles = false;
      agent.view.marks = [];
      agent.view.caret = null;
      agent.view.tip = null;
      agent.view.menu = null;
    });
  }

  function reveal(el: HTMLElement) {
    el.dataset.built = '';
    el.querySelectorAll<HTMLElement>('*').forEach((d) => (d.dataset.built = ''));
  }

  function lockSize(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    el.style.minHeight = `${r.height}px`;
    el.style.minWidth = `${r.width}px`;
  }

  function typeIn(agent: Agent, el: HTMLElement): Step[] {
    const node = el.firstChild as Text;
    const text = node.data;
    const steps: Step[] = [
      wait(1, () => {
        originals.set(el, text);
        lockSize(el);
        node.data = '';
        reveal(el);
        agent.typing = true;
      })
    ];

    for (const frame of thin(typeFrames(text, 0, rand), MAX_TYPE_FRAMES)) {
      steps.push({ ms: text.startsWith(frame) ? between(25, 70) : between(110, 200), start: () => (node.data = frame) });
    }

    return steps;
  }

  function place(agent: Agent, el: HTMLElement): Step[] {
    const draw: Step = {
      ms: between(350, 650),
      start: () => (agent.view.handles = true),
      tick(t) {
        agent.grow = Math.max(0.02, t);
        agent.anchor = { el, fx: agent.grow, fy: agent.grow };
      }
    };

    if (kindOf(el) !== 'media') {
      return [draw, wait(between(80, 200), () => reveal(el))];
    }

    const base = boxOf(el);
    return [
      draw,
      wait(1, () => {
        el.style.transformOrigin = 'top left';
        el.style.scale = `${MEDIA_START_SCALE}`;
        reveal(el);
      }),
      {
        ms: between(500, 800),
        tick(t) {
          const s = MEDIA_START_SCALE + (1 - MEDIA_START_SCALE) * t;
          el.style.scale = `${s}`;
          agent.anchor = { el, fx: 1, fy: 1 };
          agent.view.tip = `${Math.round(base.w * s)} × ${Math.round(base.h * s)}`;
        }
      },
      wait(between(150, 300))
    ];
  }

  function build(agent: Agent, el: HTMLElement): Step[] {
    const start = { el, fx: 0, fy: 0.5 };
    return [moveTo(agent, start), select(agent, el, false), ...(kindOf(el) === 'text' ? typeIn(agent, el) : place(agent, el)), release(agent, el)];
  }

  function typing(agent: Agent, el: HTMLElement): Step[] {
    const node = el.firstChild as Text;
    const text = node.data;
    const keep = rewriteFrom(text, rand);
    const frames = typeFrames(text, keep, rand);
    const steps: Step[] = [
      {
        ms: between(500, 800),
        start() {
          originals.set(el, text);
          el.style.minHeight = `${el.getBoundingClientRect().height}px`;
          agent.view.marks = textRects(el, keep);
        }
      },
      {
        ms: 1,
        start() {
          agent.view.marks = [];
          agent.typing = true;
        }
      }
    ];

    for (const frame of frames) {
      const typo = !text.startsWith(frame);
      steps.push({ ms: typo ? between(140, 260) : between(35, 110), start: () => (node.data = frame) });
    }

    steps.push(wait(between(400, 900), () => restore(el)));
    return steps;
  }

  function fontSwap(agent: Agent, el: HTMLElement): Step[] {
    const current = 0;
    const tries = [1 + Math.floor(rand() * (FONTS.length - 1)), 1 + Math.floor(rand() * (FONTS.length - 1))];
    const hover = (i: number): Step => ({
      ms: between(380, 600),
      start() {
        agent.view.menu = { items: FONTS, active: i };
        el.style.minHeight = `${el.getBoundingClientRect().height}px`;
        el.style.fontFamily = i === current ? '' : `'${FONTS[i]}', serif`;
      }
    });

    return [wait(300, () => (agent.view.menu = { items: FONTS, active: current })), hover(tries[0]), hover(tries[1]), wait(between(900, 1500)), hover(current), wait(350, () => (agent.view.menu = null))];
  }

  function colourSwap(agent: Agent, el: HTMLElement): Step[] {
    const swatch = pick(SWATCHES, rand);
    return [
      wait(250, () => {
        el.style.transition = 'color 300ms';
        el.style.color = swatch;
        agent.view.tip = swatch.toUpperCase();
      }),
      wait(between(1200, 2000), () => {
        el.style.removeProperty('color');
        agent.view.tip = getComputedStyle(el).color.startsWith('rgb(255') ? '#FFFFFF' : '#F0EEE9';
      }),
      wait(500)
    ];
  }

  function resize(agent: Agent, el: HTMLElement): Step[] {
    const target = between(0.82, 0.94);
    const base = boxOf(el);
    const scaleTo = (from: number, to: number): Step => ({
      ms: between(800, 1200),
      tick(t) {
        const s = from + (to - from) * t;
        el.style.scale = `${s}`;
        agent.view.tip = `${Math.round(base.w * s)} × ${Math.round(base.h * s)}`;
      }
    });

    return [
      wait(1, () => (el.style.transformOrigin = 'top left')),
      moveTo(agent, { el, fx: 1, fy: 1 }),
      scaleTo(1, target),
      wait(between(500, 900)),
      scaleTo(target, 1)
    ];
  }

  function nudge(agent: Agent, el: HTMLElement): Step[] {
    const dx = Math.round(between(-16, 16));
    const dy = Math.round(between(-6, 6));
    const shift = (from: number, to: number): Step => ({
      ms: between(500, 800),
      tick(t) {
        const k = from + (to - from) * t;
        el.style.translate = `${dx * k}px ${dy * k}px`;
        agent.view.tip = `X ${Math.round(dx * k)}  Y ${Math.round(dy * k)}`;
      }
    });

    return [shift(0, 1), wait(between(500, 900)), shift(1, 0)];
  }

  const ACTION_STEPS: Record<ActionKind, (agent: Agent, el: HTMLElement) => Step[]> = {
    type: typing,
    font: fontSwap,
    colour: colourSwap,
    resize,
    nudge,
    select: () => [wait(between(900, 1800))]
  };

  function plan(agent: Agent, targets: HTMLElement[]) {
    agent.view.live = true;
    const unbuilt = targets.filter((el) => !('built' in el.dataset) && !busy.has(el) && nearViewport(el));
    if (unbuilt.length > 0) {
      const el = unbuilt[Math.floor(rand() * Math.min(PARALLEL_FRONT, unbuilt.length))];
      busy.add(el);
      agent.steps = build(agent, el);
      return;
    }

    const kind = pick(agent.skills, rand);
    const idle = rand() < IDLE_SHARE;
    const free = targets.filter((el) => !idle && 'built' in el.dataset && el.closest('main') && !busy.has(el) && ACTIONS_BY_TARGET[kindOf(el)].includes(kind) && nearViewport(el));

    if (free.length === 0) {
      const near = targets.filter(nearViewport);
      const anchor = near.length > 0 ? { el: pick(near, rand), fx: between(-0.1, 1.1), fy: between(0, 1.2) } : { el: null, fx: between(0.08, 0.92), fy: between(0.15, 0.9) };
      agent.steps = [moveTo(agent, anchor), wait(between(600, 1800))];
      return;
    }

    const el = pick(free, rand);
    busy.add(el);
    agent.steps = [moveTo(agent, { el, fx: between(0.15, 0.85), fy: between(0.3, 0.8) }), select(agent, el, kind === 'resize'), ...ACTION_STEPS[kind](agent, el), release(agent, el)];
  }

  function advance(agent: Agent, now: number, targets: HTMLElement[]) {
    while (!agent.step || now - agent.since >= agent.step.ms) {
      agent.step?.tick?.(1);
      agent.step?.end?.();

      if (agent.steps.length === 0) {
        plan(agent, targets);
      }

      agent.step = agent.steps.shift() ?? null;
      agent.since = now;
      agent.step?.start?.();
    }
  }

  function frame(agent: Agent, now: number, targets: HTMLElement[]) {
    advance(agent, now, targets);
    const step = agent.step as Step;
    const t = Math.min(1, (now - agent.since) / step.ms);
    step.tick?.(t);

    const to = resolve(agent.anchor);
    const p = step.move ? curve(agent.from, to, t, BEND_PX * Math.sin(agent.seed * 7)) : to;

    const dx = p.x - mouse.x;
    const dy = p.y - mouse.y;
    const d = Math.hypot(dx, dy) || 1;
    const force = d < AVOID_RADIUS ? ((AVOID_RADIUS - d) / AVOID_RADIUS) * AVOID_PUSH : 0;
    agent.push.x += ((dx / d) * force - agent.push.x) * EASE_PUSH;
    agent.push.y += ((dy / d) * force - agent.push.y) * EASE_PUSH;

    const s = now / 1000 + agent.seed * 10;
    agent.view.x = p.x + agent.push.x + Math.sin(s * 1.3) * JITTER_PX;
    agent.view.y = p.y + agent.push.y + Math.cos(s * 1.7) * JITTER_PX;
    const box = agent.target ? boxOf(agent.target) : null;
    agent.view.box = box && { ...box, w: box.w * agent.grow, h: box.h * agent.grow };
    agent.view.caret = agent.typing && agent.target ? caretOf(agent.target) : null;
  }

  onMount(() => {
    if (matchMedia(REDUCED_QUERY).matches) {
      return;
    }

    const count = matchMedia(MOBILE_QUERY).matches ? MOBILE_AGENTS : DESKTOP_AGENTS;
    agents = AGENTS.slice(0, count).map((a, i) => ({ name: a.name, colour: PEER_COLOURS[i % PEER_COLOURS.length], x: -50, y: -50, box: null, handles: false, marks: [], caret: null, tip: null, menu: null, live: false }));
    const start = performance.now();
    running = agents.map((view, i) => ({
      skills: AGENTS[i].skills,
      view,
      anchor: { el: null, fx: rand(), fy: rand() },
      from: { x: 0, y: 0 },
      steps: [wait(i * STAGGER_MS)],
      step: null,
      since: start,
      target: null,
      typing: false,
      grow: 1,
      push: { x: 0, y: 0 },
      seed: rand()
    }));

    document.documentElement.dataset.agents = 'on';
    const targets = outermost([...document.querySelectorAll<HTMLElement>(BUILD_SELECTOR)]);
    let raf = 0;
    const loop = (now: number) => {
      for (const agent of running) {
        frame(agent, (now - start) * TEMPO + start, targets);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const track = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    addEventListener('pointermove', track, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', track);
      targets.forEach(restore);
      targets.forEach(reveal);
      document.documentElement.classList.remove(BUILD_CLASS);
      busy.clear();
    };
  });
</script>

{#if agents.length > 0}
  <div class="live" aria-hidden="true">
    {#each agents as a (a.name)}
      {#if a.live}
        {#each a.marks as m, i (i)}
          <div class="mark" style:left="{m.x}px" style:top="{m.y}px" style:width="{m.w}px" style:height="{m.h}px" style:background="{a.colour}40"></div>
        {/each}

        {#if a.box}
          <div class="box" style:left="{a.box.x}px" style:top="{a.box.y}px" style:width="{a.box.w}px" style:height="{a.box.h}px" style:border-color={a.colour}>
            {#if a.handles}
              {#each ['nw', 'ne', 'sw', 'se'] as corner (corner)}
                <span class="handle {corner}" style:border-color={a.colour}></span>
              {/each}
            {/if}

            {#if a.menu}
              <div class="menu">
                {#each a.menu.items as item, i (item)}
                  <span class:on={i === a.menu.active} style:font-family="'{item}'" style:background={i === a.menu.active ? a.colour : undefined}>{item}</span>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        {#if a.caret}
          <div class="caret" style:left="{a.caret.x}px" style:top="{a.caret.y}px" style:height="{a.caret.h}px" style:background={a.colour}></div>
        {/if}

        <div class="cursor" style:transform="translate({a.x}px, {a.y}px)">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M1 1 L1 13 L5 9.5 L8 15 L10 14 L7 8.5 L12 8.5 Z" fill={a.colour} stroke="#fff" stroke-width="1" /></svg>
          <span class="name" style:background={a.colour}>{a.name}</span>
          {#if a.tip}
            <span class="tip">{a.tip}</span>
          {/if}
        </div>
      {/if}
    {/each}
  </div>

  <div class="stack" aria-hidden="true">
    <div class="faces">
      {#each agents.slice(0, 5) as a (a.name)}
        <span style:background={a.colour}>{initials(a.name)}</span>
      {/each}
    </div>
    <span><i></i>{agents.length} agents editing</span>
  </div>
{/if}

<style>
  .live {
    position: fixed;
    inset: 0;
    z-index: 20;
    overflow: hidden;
    pointer-events: none;
    font-family: 'Inter', sans-serif;
    font-variation-settings: normal;
    letter-spacing: 0;
  }

  .live > div {
    position: absolute;
  }

  .mark {
    border-radius: 2px;
  }

  .box {
    border: 1.5px solid;
  }

  .handle {
    position: absolute;
    width: 8px;
    height: 8px;
    background: #fff;
    border: 1.5px solid;
    border-radius: 2px;
  }

  .nw {
    left: -5px;
    top: -5px;
  }

  .ne {
    right: -5px;
    top: -5px;
  }

  .sw {
    left: -5px;
    bottom: -5px;
  }

  .se {
    right: -5px;
    bottom: -5px;
  }

  .menu {
    position: absolute;
    left: -1.5px;
    top: calc(100% + 8px);
    display: flex;
    flex-direction: column;
    min-width: 160px;
    padding: 4px;
    background: #1c1c1c;
    border: 1px solid #333;
    border-radius: 6px;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.5);
  }

  .menu span {
    padding: 5px 8px;
    color: #ddd;
    font-size: 13px;
    line-height: 16px;
    border-radius: 4px;
  }

  .menu .on {
    color: #fff;
  }

  .caret {
    width: 2px;
    animation: blink 1s steps(1) infinite;
  }

  .cursor {
    left: 0;
    top: 0;
    will-change: transform;
  }

  .name,
  .tip {
    position: absolute;
    left: 14px;
    top: 14px;
    padding: 2px 6px;
    color: #fff;
    font-size: 11px;
    line-height: 14px;
    white-space: nowrap;
    border-radius: 9999px;
  }

  .tip {
    top: 34px;
    background: #1c1c1c;
    border-radius: 4px;
    font-family: 'Fragment Mono', monospace;
  }

  .stack {
    position: fixed;
    left: 12px;
    bottom: 12px;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px 6px 6px;
    background: rgb(20 20 20 / 0.9);
    border: 1px solid #2a2a2a;
    border-radius: 10px;
    pointer-events: none;
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    line-height: 14px;
    color: #ddd;
    letter-spacing: 0;
  }

  .faces {
    display: flex;
  }

  .faces span {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    margin-left: -6px;
    color: #fff;
    font-size: 9px;
    border: 2px solid #141414;
    border-radius: 9999px;
  }

  .faces span:first-child {
    margin-left: 0;
  }

  .stack i {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-right: 6px;
    background: #30a46c;
    border-radius: 9999px;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
</style>
