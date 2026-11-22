<script lang="ts">
  const DEFAULT_RADIUS = 200;
  const EASE = 9;
  const TRAIL = 0.8;
  const IDLE = 2;
  const SOFT = 0.35;
  const MAX_DPR = 2;
  const MAX_STEP = 0.05;
  const DRIFT = { x: 0.32, y: 0.26, fx: 0.37, fy: 0.53 };

  function reveal(root: HTMLElement): () => void {
    const radius = Number(root.dataset.radius) || DEFAULT_RADIUS;
    const lit = root.querySelector<HTMLImageElement>('img.lit')!;
    const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
    const ctx = canvas.getContext('2d');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const life = reduced ? 0 : TRAIL;
    let size = { w: 0, h: 0, dpr: 1 };
    let target = { x: 0, y: 0 };
    let spot = { x: 0, y: 0 };
    let trail: { x: number; y: number; t: number }[] = [];
    let pointed = -Infinity;
    let clock = 0;
    let visible = false;
    let frame = 0;
    let then = 0;

    if (!ctx) {
      root.dataset.mode = 'mask';
      root.style.setProperty('--r', radius + 'px');
    }

    function resize() {
      const dpr = Math.min(MAX_DPR, devicePixelRatio || 1);
      size = { w: root.clientWidth, h: root.clientHeight, dpr };
      canvas.width = Math.round(size.w * dpr);
      canvas.height = Math.round(size.h * dpr);
      if (!trail.length) {
        spot = { x: size.w / 2, y: size.h / 2 };
        target = { ...spot };
      }
      wake();
    }

    function cover() {
      const iw = lit.naturalWidth;
      const ih = lit.naturalHeight;
      const scale = Math.max(size.w / iw, size.h / ih);
      return { x: (size.w - iw * scale) / 2, y: (size.h - ih * scale) / 2, w: iw * scale, h: ih * scale };
    }

    function drift() {
      if (reduced) {
        return { x: size.w / 2, y: size.h / 2 };
      }
      return {
        x: size.w / 2 + size.w * DRIFT.x * Math.sin(clock * DRIFT.fx),
        y: size.h / 2 + size.h * DRIFT.y * Math.sin(clock * DRIFT.fy + 1)
      };
    }

    function paint() {
      if (!ctx) {
        root.style.setProperty('--x', spot.x + 'px');
        root.style.setProperty('--y', spot.y + 'px');
        return;
      }
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, size.w, size.h);
      if (!lit.complete || !lit.naturalWidth) {
        return;
      }
      for (const point of trail) {
        const age = life ? (clock - point.t) / life : 0;
        const gradient = ctx.createRadialGradient(point.x, point.y, radius * SOFT, point.x, point.y, radius);
        gradient.addColorStop(0, 'white');
        gradient.addColorStop(1, 'transparent');
        ctx.globalAlpha = 1 - age;
        ctx.fillStyle = gradient;
        ctx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-in';
      const box = cover();
      ctx.drawImage(lit, box.x, box.y, box.w, box.h);
    }

    function tick(now: number) {
      frame = 0;
      const dt = Math.min(MAX_STEP, (now - then) / 1000 || 0);
      then = now;
      clock += dt;
      if (clock - pointed > IDLE) {
        target = drift();
      }
      const pull = reduced ? 1 : 1 - Math.exp(-EASE * dt);
      spot = { x: spot.x + (target.x - spot.x) * pull, y: spot.y + (target.y - spot.y) * pull };
      trail = [...trail.filter((point) => clock - point.t < life), { x: spot.x, y: spot.y, t: clock }];
      paint();
      if (!reduced) {
        wake();
      }
    }

    function wake() {
      if (!frame && visible && !document.hidden) {
        then = then || performance.now();
        frame = requestAnimationFrame(tick);
      }
    }

    function sleep() {
      cancelAnimationFrame(frame);
      frame = 0;
      then = 0;
    }

    function onMove(event: PointerEvent) {
      const box = root.getBoundingClientRect();
      target = { x: event.clientX - box.left, y: event.clientY - box.top };
      pointed = clock;
      wake();
    }

    function onLeave() {
      pointed = clock;
    }

    function onVisibility() {
      if (document.hidden) {
        sleep();
        return;
      }
      wake();
    }

    const sight = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        wake();
        return;
      }
      sleep();
    });
    const watch = new ResizeObserver(resize);

    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerdown', onMove);
    root.addEventListener('pointerleave', onLeave);
    lit.addEventListener('load', wake);
    document.addEventListener('visibilitychange', onVisibility);
    sight.observe(root);
    watch.observe(root);

    return () => {
      sleep();
      sight.disconnect();
      watch.disconnect();
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerdown', onMove);
      root.removeEventListener('pointerleave', onLeave);
      lit.removeEventListener('load', wake);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }

  let root: HTMLElement;

  $effect(() => reveal(root));
</script>

<section class="fl-hover-reveal" data-theme="dark" data-radius="200" bind:this={root}>
  <img class="dark" src="https://www.feega.app/templates-assets/hover-reveal/dark-1670.webp" srcset="https://www.feega.app/templates-assets/hover-reveal/dark-960.webp 960w, https://www.feega.app/templates-assets/hover-reveal/dark-1670.webp 1670w" sizes="100vw" alt="A moonlit jungle with floating islands" />
  <img class="lit" src="https://www.feega.app/templates-assets/hover-reveal/lit-1670.webp" srcset="https://www.feega.app/templates-assets/hover-reveal/lit-960.webp 960w, https://www.feega.app/templates-assets/hover-reveal/lit-1670.webp 1670w" sizes="100vw" alt="" aria-hidden="true" />
  <canvas aria-hidden="true"></canvas>
  <div class="overlay"><h2>Bring the night to life</h2></div>
</section>

<style>
  :global {
    .fl-hover-reveal{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
    :where(.fl-hover-reveal) *,:where(.fl-hover-reveal) *::before,:where(.fl-hover-reveal) *::after{box-sizing:border-box}
    :where(.fl-hover-reveal) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
    :where(.fl-hover-reveal) a{color:inherit;text-decoration:none}
    :where(.fl-hover-reveal) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
    .fl-hover-reveal{position:relative;overflow:hidden;width:100%;height:clamp(26rem,56vw,100svh);background:var(--feega-bg);touch-action:pan-y pinch-zoom;contain:layout paint}
    .fl-hover-reveal img,.fl-hover-reveal canvas{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;pointer-events:none;user-select:none;-webkit-user-select:none}
    .fl-hover-reveal .lit{visibility:hidden}
    .fl-hover-reveal[data-mode="mask"] .lit{visibility:visible;-webkit-mask-image:radial-gradient(circle var(--r,180px) at var(--x,50%) var(--y,50%),black 35%,transparent);mask-image:radial-gradient(circle var(--r,180px) at var(--x,50%) var(--y,50%),black 35%,transparent)}
    .fl-hover-reveal[data-mode="mask"] canvas{display:none}
    .fl-hover-reveal .overlay{position:absolute;inset:0;display:grid;place-items:center;padding:var(--feega-gutter);pointer-events:none;text-align:center}
    .fl-hover-reveal h2{max-width:16ch;font-family:var(--feega-font-display);font-size:var(--feega-text-display);font-weight:500;line-height:1.05;letter-spacing:var(--feega-tracking-tight);color:var(--feega-fg)}
    @media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
  }
</style>
