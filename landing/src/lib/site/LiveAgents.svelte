<script lang="ts">
  import { onMount } from 'svelte';
  import { ACTIONS_BY_TARGET, AGENTS, lockHeight, BUILD_SELECTOR, BuildMode, PEER_COLOURS, claimTweak, ruleFor, createLedger, mayTweak, releaseTweak, curve, initials, outermost, pick, type ActionKind, type Point, type TargetKind } from './live-agents';

  type Box = { x: number; y: number; w: number; h: number };
  type Menu = { items: string[]; active: number };
  type View = { name: string; colour: string; x: number; y: number; box: Box | null; handles: boolean; tip: string | null; menu: Menu | null; live: boolean };
  type Anchor = { el: HTMLElement | null; fx: number; fy: number };
  type Step = { ms: number; move?: boolean; start?: () => void; tick?: (t: number) => void; end?: () => void };
  type Agent = { skills: ActionKind[]; view: View; anchor: Anchor; from: Point; steps: Step[]; step: Step | null; since: number; target: HTMLElement | null; resident: HTMLElement | null; grow: number; push: Point; seed: number };

  const DESKTOP_AGENTS = 24;
  const MOBILE_AGENTS = 8;
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
  const PARALLEL_FRONT = 24;
  const OFFSCREEN_PX = 60;
  const TWEAK_GAP_MS = 3500;
  const READING_MARGIN = 120;
  const MEDIA_START_SCALE = 0.6;
  const FONTS = ['BDO Grotesk', 'Instrument Serif', 'DM Sans', 'Fragment Mono', 'Inter'];
  const SWATCHES = ['#ff4000', '#f0eee9', '#0090ff', '#ffc53d', '#30a46c'];
  const STYLE_PROPS = ['min-height', 'font-family', 'color', 'scale', 'translate', 'transition', 'transform-origin', 'height', 'letter-spacing'];

  let agents = $state<View[]>([]);
  let paused = $state(false);
  const FACES = 5;
  const FACE_STEP_PX = 16;
  const FACE_PX = 22;
  const MENU_OPEN = '.drawer';
  let running: Agent[] = [];
  const busy = new Set<HTMLElement>();
  const ledger = createLedger<HTMLElement>();
  let clock = 0;
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
    return r.width > 0 && r.bottom > -NEAR_VIEWPORT_PX && r.top < innerHeight + NEAR_VIEWPORT_PX && el.checkVisibility?.({ visibilityProperty: true }) !== false;
  }

  function underReader(el: HTMLElement): boolean {
    const r = el.getBoundingClientRect();
    return mouse.x > r.left - READING_MARGIN && mouse.x < r.right + READING_MARGIN && mouse.y > r.top - READING_MARGIN && mouse.y < r.bottom + READING_MARGIN;
  }

  function edgeOf(p: Point): Anchor {
    const out = OFFSCREEN_PX;
    const gaps = [p.x, innerWidth - p.x, innerHeight - p.y];
    const nearest = gaps.indexOf(Math.min(...gaps));
    const fy = p.y / innerHeight;
    const fx = p.x / innerWidth;
    const edges: Anchor[] = [
      { el: null, fx: -out / innerWidth, fy },
      { el: null, fx: 1 + out / innerWidth, fy },
      { el: null, fx, fy: 1 + out / innerHeight }
    ];
    return edges[nearest];
  }

  function resolve(a: Anchor): Point {
    if (!a.el) {
      return { x: a.fx * innerWidth, y: a.fy * innerHeight };
    }

    const b = boxOf(a.el);
    return { x: b.x + b.w * a.fx, y: b.y + b.h * a.fy };
  }

  function restore(el: HTMLElement) {
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
      releaseTweak(ledger, el);
      agent.target = null;
      agent.grow = 1;
      agent.view.handles = false;
      agent.view.tip = null;
      agent.view.menu = null;
    });
  }

  function reveal(el: HTMLElement) {
    if ('pending' in el.dataset) {
      el.style.removeProperty('opacity');
      delete el.dataset.pending;
    }

    el.dataset.built = '';
    el.querySelectorAll<HTMLElement>('*').forEach((d) => (d.dataset.built = ''));
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

  function build(agent: Agent, el: HTMLElement, batch: HTMLElement[]): Step[] {
    const start = { el, fx: 0, fy: 0.5 };
    const pending = 'pending' in el.dataset;
    const arrive = pending ? place(agent, el) : [...ACTION_STEPS[pick(ruleOf(el).beats, rand)](agent, el), wait(1, () => reveal(el))];
    const dropBatch = wait(1, () => {
      batch.forEach(reveal);
      batch.forEach((b) => busy.delete(b));
    });
    return [moveTo(agent, start), select(agent, el, false), ...arrive, dropBatch, release(agent, el)];
  }

  function fontSwap(agent: Agent, el: HTMLElement): Step[] {
    const current = 0;
    const tries = [1 + Math.floor(rand() * (FONTS.length - 1)), 1 + Math.floor(rand() * (FONTS.length - 1))];
    const hover = (i: number): Step => ({
      ms: between(250, 350),
      start() {
        agent.view.menu = { items: FONTS, active: i };
        lockHeight(el);
        el.style.fontFamily = i === current ? '' : `'${FONTS[i]}', serif`;
      }
    });

    return [wait(300, () => (agent.view.menu = { items: FONTS, active: current })), hover(tries[0]), wait(between(400, 600)), hover(current), wait(350, () => (agent.view.menu = null))];
  }

  function colourSwap(agent: Agent, el: HTMLElement): Step[] {
    const swatch = pick(SWATCHES, rand);
    return [
      wait(250, () => {
        el.style.transition = 'color 300ms';
        el.style.color = swatch;
        agent.view.tip = swatch.toUpperCase();
      }),
      wait(between(700, 1000), () => {
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
      ms: between(500, 700),
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
      wait(between(250, 400)),
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

  function tracking(agent: Agent, el: HTMLElement): Step[] {
    const base = getComputedStyle(el).letterSpacing;
    const to = between(-0.08, 0.06);
    const drag = (from: number, end: number): Step => ({
      ms: between(350, 550),
      start: () => lockHeight(el),
      tick(t) {
        const k = from + (end - from) * t;
        el.style.letterSpacing = `calc(${base === 'normal' ? '0px' : base} + ${k * to}em)`;
        agent.view.tip = `Tracking ${Math.round(k * to * 100)}%`;
      }
    });

    return [drag(0, 1), wait(between(250, 450)), drag(1, 0)];
  }

  const ruleOf = (el: HTMLElement) => ruleFor((selector) => el.matches(selector));
  const crewOn = (el: HTMLElement) => running.filter((a) => a.resident === el).length;

  function stayResident(agent: Agent, targets: HTMLElement[]): boolean {
    if (agent.resident && !nearViewport(agent.resident)) {
      agent.resident = null;
    }

    agent.resident ??= targets.find((el) => 'built' in el.dataset && ruleOf(el).crew > crewOn(el) && nearViewport(el)) ?? null;
    const el = agent.resident;
    if (!el) {
      return false;
    }

    agent.view.live = true;
    const rule = ruleOf(el);
    if (!mayTweak(ledger, el, clock, TWEAK_GAP_MS, rule.limit)) {
      agent.steps = [moveTo(agent, { el, fx: between(-0.05, 1.05), fy: between(0.1, 1) }), wait(between(400, 900))];
      return true;
    }

    const kind = pick(rule.beats, rand);
    claimTweak(ledger, el, clock, rule.limit);
    busy.add(el);
    agent.steps = [moveTo(agent, { el, fx: between(0.15, 0.85), fy: between(0.3, 0.8) }), select(agent, el, kind === 'resize'), ...ACTION_STEPS[kind](agent, el), release(agent, el)];
    return true;
  }

  const ACTION_STEPS: Record<ActionKind, (agent: Agent, el: HTMLElement) => Step[]> = {
    font: fontSwap,
    colour: colourSwap,
    resize,
    nudge,
    tracking,
    select: () => [wait(between(700, 1200))]
  };

  function plan(agent: Agent, targets: HTMLElement[]) {
    const unbuilt = targets.filter((el) => !('built' in el.dataset) && !busy.has(el) && nearViewport(el));
    if (unbuilt.length > 0) {
      const el = unbuilt[Math.floor(rand() * Math.min(PARALLEL_FRONT, unbuilt.length))];
      const section = el.closest('section');
      const siblings = section ? unbuilt.filter((o) => o !== el && o.closest('section') === section) : [];
      const batch = siblings.slice(0, Math.ceil(siblings.length / running.length));
      busy.add(el);
      agent.view.live = true;
      batch.forEach((b) => busy.add(b));
      agent.steps = build(agent, el, batch);
      return;
    }

    if (stayResident(agent, targets)) {
      return;
    }

    const kind = pick(agent.skills, rand);
    const free = targets.filter((el) => mayTweak(ledger, el, clock, TWEAK_GAP_MS) && 'built' in el.dataset && el.closest('main') && !underReader(el) && !busy.has(el) && ACTIONS_BY_TARGET[kindOf(el)].includes(kind) && nearViewport(el));

    if (free.length === 0) {
      agent.steps = agent.view.live ? [moveTo(agent, edgeOf(resolve(agent.anchor))), wait(1, () => (agent.view.live = false))] : [wait(between(300, 600))];
      return;
    }

    agent.view.live = true;

    const el = pick(free, rand);
    busy.add(el);
    claimTweak(ledger, el, clock);
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
    clock = now;
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
  }

  onMount(() => {
    if (matchMedia(REDUCED_QUERY).matches) {
      return;
    }

    const count = matchMedia(MOBILE_QUERY).matches ? MOBILE_AGENTS : DESKTOP_AGENTS;
    agents = AGENTS.slice(0, count).map((a, i) => ({ name: a.name, colour: PEER_COLOURS[i % PEER_COLOURS.length], x: -50, y: -50, box: null, handles: false, tip: null, menu: null, live: false }));
    const start = performance.now();
    running = agents.map((view, i) => ({
      skills: AGENTS[i].skills,
      view,
      anchor: edgeOf({ x: rand() * innerWidth, y: rand() * innerHeight }),
      from: { x: 0, y: 0 },
      steps: [wait(i * STAGGER_MS)],
      step: null,
      since: start,
      target: null,
      resident: null,
      grow: 1,
      push: { x: 0, y: 0 },
      seed: rand()
    }));

    const targets = outermost([...document.querySelectorAll<HTMLElement>(BUILD_SELECTOR)]);
    for (const el of targets) {
      if (ruleOf(el).build === BuildMode.Place && el.getBoundingClientRect().top > innerHeight) {
        el.dataset.pending = '';
        el.style.opacity = '0';
      }
    }
    let raf = 0;
    const loop = (now: number) => {
      paused = document.querySelector(MENU_OPEN) !== null;
      if (paused) {
        raf = requestAnimationFrame(loop);
        return;
      }

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
      busy.clear();
    };
  });
</script>

{#if agents.length > 0}
  <div class="live" class:paused aria-hidden="true">
    {#each agents as a (a.name)}
      {#if a.live}
        {#if a.box}
          <div class="box" style:transform="translate({a.box.x}px, {a.box.y}px)" style:width="{a.box.w}px" style:height="{a.box.h}px" style:border-color={a.colour}>
            {#if a.handles}
              {#each ['nw', 'ne', 'sw', 'se'] as corner (corner)}
                <span class="handle {corner}" style:border-color={a.colour}></span>
              {/each}
            {/if}

          </div>
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

  {#each agents as a (a.name)}
    {#if a.live && a.menu && a.box}
      <div class="live menus" class:paused aria-hidden="true">
        <div class="menu" style:transform="translate({a.box.x - 1.5}px, {a.box.y + a.box.h + 8}px)">
          {#each a.menu.items as item, i (item)}
            <span class:on={i === a.menu.active} style:font-family="'{item}'" style:background={i === a.menu.active ? a.colour : undefined}>{item}</span>
          {/each}
        </div>
      </div>
    {/if}
  {/each}

  {@const present = agents.filter((a) => a.live)}
  <div class="stack" aria-hidden="true" class:gone={present.length === 0 || paused}>
    <div class="faces" style:width="{FACE_PX + (FACES - 1) * FACE_STEP_PX}px">
      {#each present.slice(0, FACES) as a, i (a.name)}
        <span style:background={a.colour} style:transform="translateX({i * FACE_STEP_PX}px)">{initials(a.name)}</span>
      {/each}
    </div>
    <span><i></i>{present.length} {present.length === 1 ? 'agent' : 'agents'} editing</span>
  </div>
{/if}

<style>
  .live {
    position: fixed;
    inset: 0;
    z-index: var(--site-z-agents);
    overflow: hidden;
    pointer-events: none;
    font-family: 'Inter', sans-serif;
    font-variation-settings: normal;
    letter-spacing: 0;
  }

  .live > div {
    position: absolute;
    left: 0;
    top: 0;
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

  .live.paused {
    visibility: hidden;
  }

  .menu {
    position: absolute;
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
    z-index: var(--site-z-agents);
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

  .stack.gone {
    opacity: 0;
  }

  .stack {
    transition: opacity 300ms;
  }

  .faces {
    position: relative;
    height: var(--face);
    --face: 22px;
  }

  .faces span {
    position: absolute;
    left: 0;
    top: 0;
    display: grid;
    place-items: center;
    width: var(--face);
    height: var(--face);
    color: #fff;
    font-size: 9px;
    border: 2px solid #141414;
    border-radius: 9999px;
  }


  .stack i {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-right: 6px;
    background: #30a46c;
    border-radius: 9999px;
  }

</style>
