<script lang="ts">
  const RIM = 14;
  const BEND = 36;
  const EASE = 0.16;
  const SETTLE = 0.5;
  let lenses = 0;

  function lensMap(w: number, h: number): string {
    const r = h / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="x"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="black"/></linearGradient><linearGradient id="y" x2="0" y2="1"><stop offset="0" stop-color="lime"/><stop offset="1" stop-color="black"/></linearGradient><filter id="s"><feGaussianBlur stdDeviation="${RIM / 2}"/></filter></defs><rect width="${w}" height="${h}" fill="black"/><rect width="${w}" height="${h}" rx="${r}" fill="url(#x)"/><rect width="${w}" height="${h}" rx="${r}" fill="url(#y)" style="mix-blend-mode:screen"/><rect x="${RIM}" y="${RIM}" width="${w - RIM * 2}" height="${h - RIM * 2}" rx="${r - RIM}" fill="gray" filter="url(#s)"/></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function refracts(): boolean {
    return CSS.supports('backdrop-filter', 'url(#a)') && 'userAgentData' in navigator;
  }

  function glass(root: HTMLElement): () => void {
    const button = root.querySelector<HTMLElement>('.glass')!;
    const glow = root.querySelector<HTMLElement>('.glow')!;
    const filter = root.querySelector<SVGFilterElement>('filter')!;
    const map = root.querySelector<SVGFEImageElement>('feImage')!;
    const bend = root.querySelector<SVGFEDisplacementMapElement>('feDisplacementMap')!;
    const speed = Number(root.dataset.speed) || 1;
    const intensity = Number(root.dataset.intensity) || 1;
    const still = matchMedia('(prefers-reduced-motion: reduce)');
    const id = 'fl-glass-lens-' + ++lenses;
    const target = { x: 0, y: 0 };
    const at = { x: 0, y: 0 };
    let hovering = false;
    let frame = 0;

    filter.id = id;
    root.style.setProperty('--spin', 6 / speed + 's');
    root.style.setProperty('--glow', String(Math.min(1, 0.9 * intensity)));
    bend.setAttribute('scale', String(BEND * intensity));

    function resize() {
      const w = Math.round(button.offsetWidth);
      const h = Math.round(button.offsetHeight);
      map.setAttribute('width', String(w));
      map.setAttribute('height', String(h));
      map.setAttribute('href', lensMap(w, h));
    }

    function paint() {
      root.style.setProperty('--gx', at.x + 'px');
      root.style.setProperty('--gy', at.y + 'px');
    }

    function step() {
      const k = Math.min(1, EASE * speed);
      at.x += (target.x - at.x) * k;
      at.y += (target.y - at.y) * k;
      paint();

      if (Math.abs(target.x - at.x) + Math.abs(target.y - at.y) < SETTLE) {
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(step);
    }

    function aim(x: number, y: number, move: 'jump' | 'ease') {
      target.x = x;
      target.y = y;

      if (move === 'jump' || still.matches) {
        at.x = x;
        at.y = y;
        paint();
        return;
      }
      if (!frame) {
        frame = requestAnimationFrame(step);
      }
    }

    function aimAt(event: PointerEvent, move: 'jump' | 'ease') {
      const box = glow.getBoundingClientRect();
      const face = button.getBoundingClientRect();
      root.style.setProperty('--mx', ((event.clientX - face.left) / face.width) * 100 + '%');
      root.style.setProperty('--my', ((event.clientY - face.top) / face.height) * 100 + '%');
      aim(event.clientX - box.left, event.clientY - box.top, move);
    }

    function aimCentre() {
      aim(glow.offsetWidth / 2, glow.offsetHeight / 2, 'jump');
    }

    function showFocus() {
      aimCentre();
      root.setAttribute('data-lit', 'focus');
    }

    function onEnter(event: PointerEvent) {
      if (event.pointerType === 'touch') {
        return;
      }
      aimAt(event, root.getAttribute('data-lit') === 'pointer' ? 'ease' : 'jump');
      hovering = true;
      root.setAttribute('data-lit', 'pointer');
    }

    function onDown(event: PointerEvent) {
      if (event.pointerType !== 'touch') {
        return;
      }
      aimAt(event, 'jump');
      hovering = true;
      root.setAttribute('data-lit', 'pointer');
    }

    function onMove(event: PointerEvent) {
      if (!hovering) {
        return;
      }
      aimAt(event, 'ease');
    }

    function onLeave() {
      hovering = false;
      root.style.setProperty('--mx', '50%');
      root.style.setProperty('--my', '0%');

      if (button.matches(':focus-visible')) {
        showFocus();
        return;
      }
      root.removeAttribute('data-lit');
    }

    function onUp(event: PointerEvent) {
      if (event.pointerType === 'touch') {
        onLeave();
      }
    }

    function onFocus() {
      if (hovering || !button.matches(':focus-visible')) {
        return;
      }
      showFocus();
    }

    function onBlur() {
      if (hovering) {
        return;
      }
      root.removeAttribute('data-lit');
    }

    const watch = new ResizeObserver(resize);
    const events = [
      [root, 'pointerenter', onEnter],
      [root, 'pointerdown', onDown],
      [root, 'pointermove', onMove],
      [root, 'pointerleave', onLeave],
      [root, 'pointerup', onUp],
      [root, 'pointercancel', onLeave],
      [button, 'focus', onFocus],
      [button, 'blur', onBlur]
    ] as [HTMLElement, string, (event: any) => void][];

    if (refracts()) {
      root.style.setProperty('--lens', 'url(#' + id + ')');
      root.setAttribute('data-lens', '');
      watch.observe(button);
    }
    events.forEach(([el, type, fn]) => el.addEventListener(type, fn));

    return () => {
      cancelAnimationFrame(frame);
      watch.disconnect();
      events.forEach(([el, type, fn]) => el.removeEventListener(type, fn));
      root.removeAttribute('data-lens');
      root.removeAttribute('data-lit');
    };
  }

  let root: HTMLElement;

  $effect(() => glass(root));
</script>

<div bind:this={root} class="fl-glass-button" data-speed="1" data-intensity="1">
  <span class="glow" aria-hidden="true"><span class="hue"></span></span>
  <button class="glass" type="button"><span class="label">get started</span></button>
  <svg class="lens" aria-hidden="true" focusable="false">
    <filter x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feImage x="0" y="0" preserveAspectRatio="none" result="map" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="36" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </svg>
</div>

<style>
  :global {
    .fl-glass-button{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
    :where(.fl-glass-button) *,:where(.fl-glass-button) *::before,:where(.fl-glass-button) *::after{box-sizing:border-box}
    :where(.fl-glass-button) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
    :where(.fl-glass-button) a{color:inherit;text-decoration:none}
    :where(.fl-glass-button) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
    .fl-glass-button{--glow-1:deeppink;--glow-2:orange;--glow-3:gold;--glow-4:springgreen;--glow-5:deepskyblue;--glow-6:blueviolet;--shine:white;--spin:6s;--radius:var(--feega-radius-full);--blur:12px;--glow:0.9;--fade:300ms;--mx:50%;--my:0%;--gx:50%;--gy:50%;position:relative;display:inline-grid;place-items:center;padding:var(--feega-space-12) var(--feega-space-16);max-width:100%}
    .fl-glass-button .glow{position:absolute;inset:calc(var(--feega-space-12) - 8px) calc(var(--feega-space-16) - 8px);filter:blur(var(--blur));opacity:0;pointer-events:none;transition:opacity var(--fade) var(--feega-ease)}
    .fl-glass-button .hue{position:absolute;left:var(--gx);top:var(--gy);width:6.5rem;aspect-ratio:1;translate:-50% -50%;border-radius:50%;background:conic-gradient(var(--glow-1),var(--glow-2),var(--glow-3),var(--glow-4),var(--glow-5),var(--glow-6),var(--glow-1));-webkit-mask:radial-gradient(closest-side,black 20%,transparent);mask:radial-gradient(closest-side,black 20%,transparent);animation:fl-glass-spin var(--spin) linear infinite}
    @keyframes fl-glass-spin{to{transform:rotate(1turn)}}
    .fl-glass-button[data-lit] .glow{opacity:var(--glow)}
    .fl-glass-button[data-lit="focus"] .glow{opacity:calc(var(--glow) * 0.6)}
    .fl-glass-button .glass{position:relative;display:inline-flex;align-items:center;justify-content:center;min-height:56px;max-width:100%;padding:0 var(--feega-space-8);border:0;border-radius:var(--radius);background:linear-gradient(180deg,color-mix(in srgb,var(--feega-raised) 30%,transparent),color-mix(in srgb,var(--feega-raised) 8%,transparent));color:var(--feega-fg);font:inherit;font-size:1.0625rem;font-weight:500;letter-spacing:var(--feega-tracking);white-space:nowrap;cursor:pointer;-webkit-backdrop-filter:blur(8px) saturate(1.6);backdrop-filter:blur(8px) saturate(1.6);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--shine) 80%,transparent),inset 0 -1px 0 color-mix(in srgb,var(--shine) 25%,transparent),inset 0 -12px 20px -12px color-mix(in srgb,var(--feega-fg) 22%,transparent),inset 1px 0 0 color-mix(in srgb,var(--glow-5) 22%,transparent),inset -1px 0 0 color-mix(in srgb,var(--glow-1) 22%,transparent),0 0 0 1px color-mix(in srgb,var(--feega-fg) 8%,transparent),0 8px 24px -12px color-mix(in srgb,var(--feega-fg) 30%,transparent);transition:transform var(--feega-dur-fast) var(--feega-ease)}
    .fl-glass-button[data-lens] .glass{-webkit-backdrop-filter:var(--lens) blur(1.5px) saturate(1.6);backdrop-filter:var(--lens) blur(1.5px) saturate(1.6)}
    .fl-glass-button .glass::before{content:"";position:absolute;inset:0;padding:1.5px;border-radius:inherit;background:radial-gradient(90% 130% at var(--mx) var(--my),var(--shine),transparent 70%);-webkit-mask:linear-gradient(black 0 0) content-box exclude,linear-gradient(black 0 0);mask:linear-gradient(black 0 0) content-box exclude,linear-gradient(black 0 0);pointer-events:none}
    .fl-glass-button .glass::after{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(60% 90% at var(--mx) var(--my),color-mix(in srgb,var(--shine) 40%,transparent),transparent 70%);opacity:0.3;pointer-events:none;transition:opacity var(--fade) var(--feega-ease)}
    .fl-glass-button .label{position:relative;z-index:1;text-shadow:0 1px 1px color-mix(in srgb,var(--feega-bg) 45%,transparent)}
    .fl-glass-button .lens{position:absolute;width:0;height:0;overflow:hidden}
    .fl-glass-button[data-lit] .glass::after{opacity:0.6}
    .fl-glass-button .glass:active{transform:scale(0.97,0.93)}
    @media (prefers-reduced-motion:reduce){.fl-glass-button .hue{animation:none}.fl-glass-button .glow{transition:none}}
    @media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
  }
</style>
