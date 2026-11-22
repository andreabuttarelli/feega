<script lang="ts">
  const DEFAULT_RADIUS = 220;
  const DEFAULT_GAIN = 2.2;
  const DEFAULT_SOFTNESS = 0.18;
  const THRESHOLD = 0.5;
  const FLOOR = 0.6;
  const HALO = 0.75;
  const SHINE = { low: 0.04, high: 0.6, peak: 0.4 };
  const LUMA = [0.2126, 0.7152, 0.0722];
  const EASE = 7;
  const TRAIL = 1.4;
  const IDLE = 2;
  const MAX_DPR = 2;
  const MAX_STEP = 0.05;
  const MASK_SCALE = 0.25;
  const SPRITE = 64;
  const SPACING = 0.18;
  const DEPOSIT = 0.16;
  const DRIFT = { x: 0.32, y: 0.26, fx: 0.37, fy: 0.53 };
  const BLOBS = [
    { size: 1.25, reach: 0.18, alpha: 0.55, seed: 0 },
    { size: 0.9, reach: 0.42, alpha: 0.45, seed: 1.7 },
    { size: 0.75, reach: 0.55, alpha: 0.4, seed: 3.1 },
    { size: 1.05, reach: 0.35, alpha: 0.35, seed: 4.6 }
  ];

  function wobble(time: number, seed: number): number {
    return Math.sin(time * 0.61 + seed * 1.3) * 0.5 + Math.sin(time * 1.17 + seed * 2.9) * 0.3 + Math.sin(time * 1.93 + seed * 5.1) * 0.2;
  }

  function glow(): HTMLCanvasElement {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = SPRITE;
    const g = sprite.getContext('2d')!;
    const half = SPRITE / 2;
    const pixels = g.createImageData(SPRITE, SPRITE);
    for (let i = 0; i < SPRITE * SPRITE; i++) {
      const r = Math.min(1, Math.hypot((i % SPRITE) - half + 0.5, Math.floor(i / SPRITE) - half + 0.5) / half);
      pixels.data.fill(255, i * 4, i * 4 + 3);
      pixels.data[i * 4 + 3] = 255 * Math.exp(-4.5 * r * r) * (1 - r);
    }
    g.putImageData(pixels, 0, 0);
    return sprite;
  }

  function fade(age: number): number {
    const left = 1 - age;
    return left * left * (1 + 2 * age);
  }

  function ease(low: number, high: number, x: number): number {
    const k = Math.min(1, Math.max(0, (x - low) / (high - low)));
    return k * k * (3 - 2 * k);
  }

  function shine(r: number, g: number, b: number): number {
    const luma = r * LUMA[0] + g * LUMA[1] + b * LUMA[2];
    const peak = Math.max(r, g, b);
    return ease(SHINE.low, SHINE.high, luma + (peak - luma) * SHINE.peak);
  }

  const VERTEX = [
    '#version 300 es',
    'in vec2 p;',
    'out vec2 uv;',
    'void main() { uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }'
  ].join('\n');

  const FRAGMENT = [
    '#version 300 es',
    'precision mediump float;',
    'uniform sampler2D lit;',
    'uniform sampler2D light;',
    'uniform vec4 crop;',
    'uniform float gain;',
    'uniform float soft;',
    'in vec2 uv;',
    'out vec4 tint;',
    'float shine(vec3 c) {',
    '  float luma = dot(c, vec3(' + LUMA.join(', ') + '));',
    '  float peak = max(c.r, max(c.g, c.b));',
    '  return smoothstep(' + SHINE.low.toFixed(3) + ', ' + SHINE.high.toFixed(3) + ', mix(luma, peak, ' + SHINE.peak.toFixed(3) + '));',
    '}',
    'void main() {',
    '  vec2 st = (uv - crop.xy) / crop.zw;',
    '  vec4 c = texture(lit, st);',
    '  float lum = shine(texture(lit, st, 2.5).xyz);',
    '  float l = texture(light, uv).a;',
    '  float a = smoothstep(' + THRESHOLD.toFixed(3) + ' - soft, ' + THRESHOLD.toFixed(3) + ' + soft, l * (' + FLOOR.toFixed(3) + ' + gain * lum));',
    '  a *= smoothstep(0.0, ' + HALO.toFixed(3) + ', l);',
    '  tint = vec4(c.xyz * a, a);',
    '}'
  ].join('\n');

  type Box = { x: number; y: number; w: number; h: number };
  type Size = { w: number; h: number; dpr: number };
  type Tune = { gain: number; soft: number };
  type Painter = { draw: (field: HTMLCanvasElement, box: Box, size: Size) => boolean };

  function webgl(canvas: HTMLCanvasElement, lit: HTMLImageElement, tune: Tune): Painter | null {
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false });
    if (!gl) {
      return null;
    }

    const program = gl.createProgram()!;
    for (const [kind, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]] as [number, string][]) {
      const shader = gl.createShader(kind)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.bindAttribLocation(program, 0, 'p');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return null;
    }

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const texture = (unit: number, filter: number) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    texture(1, gl.LINEAR);
    texture(0, gl.LINEAR_MIPMAP_LINEAR);
    gl.uniform1i(gl.getUniformLocation(program, 'lit'), 0);
    gl.uniform1i(gl.getUniformLocation(program, 'light'), 1);
    gl.uniform1f(gl.getUniformLocation(program, 'gain'), tune.gain);
    gl.uniform1f(gl.getUniformLocation(program, 'soft'), tune.soft);
    const crop = gl.getUniformLocation(program, 'crop');
    let loaded = '';

    function upload(): boolean {
      const src = lit.currentSrc || lit.src;
      if (loaded === src) {
        return true;
      }
      try {
        gl!.activeTexture(gl!.TEXTURE0);
        gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, lit);
        gl!.generateMipmap(gl!.TEXTURE_2D);
      } catch {
        return false;
      }
      loaded = src;
      return true;
    }

    return {
      draw(field, box, size) {
        if (!upload()) {
          return false;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.activeTexture(gl.TEXTURE1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, field);
        gl.uniform4f(crop, box.x / size.w, box.y / size.h, box.w / size.w, box.h / size.h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        return true;
      }
    };
  }

  function pixels(canvas: HTMLCanvasElement, lit: HTMLImageElement, tune: Tune): Painter | null {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    let lum = new Float32Array(0);
    let key = '';

    function measure(field: HTMLCanvasElement, box: Box, size: Size): boolean {
      const next = field.width + 'x' + field.height + (lit.currentSrc || lit.src);
      if (key === next) {
        return true;
      }
      const probe = document.createElement('canvas');
      probe.width = field.width;
      probe.height = field.height;
      const g = probe.getContext('2d', { willReadFrequently: true })!;
      const scale = field.width / size.w;
      g.drawImage(lit, box.x * scale, box.y * scale, box.w * scale, box.h * scale);
      try {
        const data = g.getImageData(0, 0, probe.width, probe.height).data;
        lum = new Float32Array(probe.width * probe.height);
        for (let i = 0; i < lum.length; i++) {
          lum[i] = shine(data[i * 4] / 255, data[i * 4 + 1] / 255, data[i * 4 + 2] / 255);
        }
      } catch {
        return false;
      }
      key = next;
      return true;
    }

    return {
      draw(field, box, size) {
        if (!measure(field, box, size)) {
          return false;
        }
        const fctx = field.getContext('2d', { willReadFrequently: true })!;
        const image = fctx.getImageData(0, 0, field.width, field.height);
        const data = image.data;
        for (let i = 0; i < lum.length; i++) {
          const l = data[i * 4 + 3] / 255;
          data[i * 4 + 3] = 255 * ease(THRESHOLD - tune.soft, THRESHOLD + tune.soft, l * (FLOOR + tune.gain * lum[i])) * ease(0, HALO, l);
        }
        fctx.putImageData(image, 0, 0);
        ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, size.w, size.h);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(field, 0, 0, size.w, size.h);
        ctx.globalCompositeOperation = 'source-in';
        ctx.drawImage(lit, box.x, box.y, box.w, box.h);
        return true;
      }
    };
  }

  function reveal(root: HTMLElement): () => void {
    const radius = Number(root.dataset.radius) || DEFAULT_RADIUS;
    const tune = { gain: Number(root.dataset.gain) || DEFAULT_GAIN, soft: Number(root.dataset.softness) || DEFAULT_SOFTNESS };
    const lit = root.querySelector<HTMLImageElement>('img.lit')!;
    const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
    const mask = document.createElement('canvas');
    const mctx = mask.getContext('2d', { willReadFrequently: true });
    let painter = webgl(canvas, lit, tune) || pixels(canvas, lit, tune);
    const sprite = glow();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let size: Size = { w: 0, h: 0, dpr: 1 };
    let target = { x: 0, y: 0 };
    let spot = { x: 0, y: 0 };
    let last = { x: 0, y: 0 };
    let trail: { x: number; y: number; t: number; seed: number }[] = [];
    let seeds = 0;
    let pointed = -Infinity;
    let clock = 0;
    let visible = false;
    let frame = 0;
    let then = 0;

    function fallback() {
      painter = null;
      root.dataset.mode = 'mask';
      root.style.setProperty('--r', radius * 1.6 + 'px');
    }

    if (!painter || !mctx) {
      fallback();
    }

    function resize() {
      const dpr = Math.min(MAX_DPR, devicePixelRatio || 1);
      size = { w: root.clientWidth, h: root.clientHeight, dpr };
      canvas.width = Math.round(size.w * dpr);
      canvas.height = Math.round(size.h * dpr);
      mask.width = Math.max(1, Math.round(size.w * MASK_SCALE));
      mask.height = Math.max(1, Math.round(size.h * MASK_SCALE));
      if (!trail.length) {
        spot = { x: size.w / 2, y: size.h / 2 };
        target = { ...spot };
        last = { ...spot };
      }
      wake();
    }

    function cover(): Box {
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

    function stamp(g: CanvasRenderingContext2D, x: number, y: number, extent: number, alpha: number) {
      g.globalAlpha = Math.min(1, alpha);
      g.drawImage(sprite, x - extent, y - extent, extent * 2, extent * 2);
    }

    function lay() {
      const step = radius * SPACING;
      const dx = spot.x - last.x;
      const dy = spot.y - last.y;
      const steps = Math.floor(Math.hypot(dx, dy) / step);
      if (!steps) {
        return;
      }
      for (let i = 1; i <= steps; i++) {
        trail.push({ x: last.x + (dx * i) / steps, y: last.y + (dy * i) / steps, t: clock, seed: seeds++ });
      }
      last = { ...spot };
    }

    function light(g: CanvasRenderingContext2D) {
      const time = reduced ? 0 : clock;
      for (const point of trail) {
        const age = (clock - point.t) / TRAIL;
        const x = point.x + radius * 0.3 * wobble(time, point.seed);
        const y = point.y + radius * 0.3 * wobble(time, point.seed + 9);
        stamp(g, x, y, radius * (0.9 + 0.3 * wobble(time, point.seed + 4)), DEPOSIT * fade(age));
      }
      for (const blob of BLOBS) {
        const x = spot.x + radius * blob.reach * wobble(time, blob.seed);
        const y = spot.y + radius * blob.reach * wobble(time, blob.seed + 7);
        const extent = radius * 1.6 * blob.size * (1 + 0.15 * wobble(time, blob.seed + 3));
        stamp(g, x, y, extent, blob.alpha);
      }
    }

    function paint() {
      if (!painter || !mctx) {
        root.style.setProperty('--x', spot.x + 'px');
        root.style.setProperty('--y', spot.y + 'px');
        return;
      }
      if (!lit.complete || !lit.naturalWidth) {
        return;
      }
      mctx.setTransform(MASK_SCALE, 0, 0, MASK_SCALE, 0, 0);
      mctx.globalAlpha = 1;
      mctx.clearRect(0, 0, size.w, size.h);
      light(mctx);
      if (!painter.draw(mask, cover(), size)) {
        fallback();
        paint();
      }
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
      trail = reduced ? [] : trail.filter((point) => clock - point.t < TRAIL);
      if (!reduced) {
        lay();
      }
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

<section class="fl-hover-reveal" data-theme="dark" data-radius="220" data-gain="2.2" data-softness="0.18" bind:this={root}>
  <img class="dark" src="https://www.feega.app/templates-assets/hover-reveal/dark-1670.webp" srcset="https://www.feega.app/templates-assets/hover-reveal/dark-960.webp 960w, https://www.feega.app/templates-assets/hover-reveal/dark-1670.webp 1670w" sizes="100vw" alt="A moonlit jungle with floating islands" />
  <img class="lit" src="https://www.feega.app/templates-assets/hover-reveal/lit-1670.webp" srcset="https://www.feega.app/templates-assets/hover-reveal/lit-960.webp 960w, https://www.feega.app/templates-assets/hover-reveal/lit-1670.webp 1670w" sizes="100vw" alt="" aria-hidden="true" crossorigin="anonymous" />
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
    .fl-hover-reveal[data-mode="mask"] .lit{visibility:visible;-webkit-mask-image:radial-gradient(circle var(--r,180px) at var(--x,50%) var(--y,50%),black,color-mix(in srgb,black 80%,transparent) 22%,color-mix(in srgb,black 50%,transparent) 45%,color-mix(in srgb,black 20%,transparent) 70%,color-mix(in srgb,black 5%,transparent) 88%,transparent);mask-image:radial-gradient(circle var(--r,180px) at var(--x,50%) var(--y,50%),black,color-mix(in srgb,black 80%,transparent) 22%,color-mix(in srgb,black 50%,transparent) 45%,color-mix(in srgb,black 20%,transparent) 70%,color-mix(in srgb,black 5%,transparent) 88%,transparent)}
    .fl-hover-reveal[data-mode="mask"] canvas{display:none}
    .fl-hover-reveal .overlay{position:absolute;inset:0;display:grid;place-items:center;padding:var(--feega-gutter);pointer-events:none;text-align:center}
    .fl-hover-reveal h2{max-width:16ch;font-family:var(--feega-font-display);font-size:var(--feega-text-display);font-weight:500;line-height:1.05;letter-spacing:var(--feega-tracking-tight);color:var(--feega-fg)}
    @media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
  }
</style>
