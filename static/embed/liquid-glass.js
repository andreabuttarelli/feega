(() => {
  const TAG = 'feega-liquid-glass';

  if (customElements.get(TAG)) {
    return;
  }

  const CSS = `
    ${TAG} {
      --lg-ink: #000;
      --lg-bg: #fff;
      --lg-font: "Inter Tight", "Helvetica Neue", Arial, sans-serif;
      position: relative;
      display: grid;
      place-content: center;
      min-height: 480px;
      background: var(--lg-bg);
      color: var(--lg-ink);
      overflow: hidden;
      touch-action: pan-y;
      text-align: center;
      font: 800 clamp(56px, 11vw, 200px)/0.92 var(--lg-font);
      letter-spacing: -0.055em;
    }

    ${TAG} > :not(canvas) { margin: 0; font: inherit; letter-spacing: inherit; }
    ${TAG}[data-live] > :not(canvas) { color: transparent; }
    ${TAG}[data-live]:not(:has(> :not(canvas))) { color: transparent; }

    ${TAG} > canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
      pointer-events: none;
    }
  `;

  const VERT = `
    attribute vec2 p;
    void main() { gl_Position = vec4(p, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;
    uniform sampler2D tex;
    uniform vec2 res;
    uniform vec2 a;
    uniform vec2 b;
    uniform float ra;
    uniform float rb;
    uniform vec2 stretch;
    uniform float t;
    uniform float power;

    float smin(float x, float y, float k) {
      float h = clamp(0.5 + 0.5 * (y - x) / k, 0.0, 1.0);
      return mix(y, x, h) - k * h * (1.0 - h);
    }

    float blob(vec2 q, vec2 c, float r) {
      vec2 d = q - c;
      float s = length(stretch);
      if (s > 0.001) {
        vec2 dir = stretch / s;
        vec2 side = vec2(-dir.y, dir.x);
        d = dir * (dot(d, dir) / (1.0 + s)) + side * (dot(d, side) * sqrt(1.0 + s));
      }
      float wobble = sin(atan(d.y, d.x) * 3.0 + t * 1.3) * 0.012 * r;
      return length(d) - r - wobble;
    }

    float field(vec2 q) {
      return smin(blob(q, a, ra), length(q - b) - rb, ra * 0.55);
    }

    vec3 scene(vec2 uv) {
      return texture2D(tex, vec2(uv.x, 1.0 - uv.y)).rgb;
    }

    void main() {
      vec2 q = gl_FragCoord.xy;
      vec2 uv = q / res;
      float d = field(q);
      float px = 1.5;

      if (d > ra * 0.35) {
        gl_FragColor = vec4(scene(uv), 1.0);
        return;
      }

      vec2 e = vec2(1.0, 0.0);
      vec2 n = normalize(vec2(field(q + e.xy) - field(q - e.xy), field(q + e.yx) - field(q - e.yx)) + 1e-6);

      float depth = clamp(-d / ra, 0.0, 1.0);
      float edge = 1.0 - depth;
      float dome = 1.0 - sqrt(max(1.0 - edge * edge, 0.0));
      float bend = dome * ra * 0.75 * power;
      vec2 zoom = (q - a) * 0.32 * depth * power;
      vec2 off = (n * bend + zoom) / res;
      float spread = 0.025;

      vec3 glass = vec3(
        scene(uv - off * (1.0 + spread)).r,
        scene(uv - off).g,
        scene(uv - off * (1.0 - spread)).b
      );

      vec2 light = normalize(vec2(-0.6, 0.8));
      float rim = pow(edge, 6.0);
      float spec = pow(max(dot(n, light), 0.0), 3.0) * rim;
      float shade = pow(max(dot(n, -light), 0.0), 2.0) * rim;
      glass = mix(glass, vec3(1.0), spec * 0.85);
      glass *= 1.0 - shade * 0.16;
      glass = mix(glass, vec3(0.93, 0.95, 1.0), 0.04 * depth);

      float shadowD = field(q + vec2(0.0, ra * 0.06));
      float shadow = (1.0 - smoothstep(0.0, ra * 0.25, shadowD)) * 0.05;
      vec3 outside = scene(uv) * (1.0 - shadow);

      float inside = 1.0 - smoothstep(-px, px, d);
      gl_FragColor = vec4(mix(outside, glass, inside), 1.0);
    }
  `;

  const SPRING = { stiffness: 120, damping: 14 };
  const DROP = { stiffness: 38, damping: 7 };
  const DROP_RATIO = 0.42;
  const STRETCH = 0.00025;
  const STRETCH_MAX = 0.3;
  const LEASH = 0.85;
  const DPR_MAX = 2;
  const DEFAULT_SIZE = 0.13;
  const DEFAULT_POWER = 1;
  const UNIFORMS = ['tex', 'res', 'a', 'b', 'ra', 'rb', 'stretch', 't', 'power'];

  function shader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  function program(gl) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(p);
    gl.useProgram(p);
    return p;
  }

  function step(body, target, cfg, dt) {
    body.vx += (cfg.stiffness * (target.x - body.x) - cfg.damping * body.vx) * dt;
    body.vy += (cfg.stiffness * (target.y - body.y) - cfg.damping * body.vy) * dt;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
  }

  function leash(body, anchor, max) {
    const dx = body.x - anchor.x;
    const dy = body.y - anchor.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= max) {
      return;
    }
    body.x = anchor.x + (dx / dist) * max;
    body.y = anchor.y + (dy / dist) * max;
    body.vx = anchor.vx;
    body.vy = anchor.vy;
  }

  function number(el, name, fallback) {
    const value = parseFloat(el.getAttribute(name));
    return Number.isFinite(value) ? value : fallback;
  }

  function injectStyle() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  class LiquidGlass extends HTMLElement {
    connectedCallback() {
      this.canvas = document.createElement('canvas');
      this.canvas.setAttribute('aria-hidden', 'true');
      this.appendChild(this.canvas);

      const gl = this.canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
      if (!gl) {
        this.canvas.remove();
        return;
      }
      this.gl = gl;
      this.setup();
      this.listen();
      this.setAttribute('data-live', '');
      this.raf = requestAnimationFrame((now) => this.frame(now));
    }

    disconnectedCallback() {
      cancelAnimationFrame(this.raf);
      this.resizer?.disconnect();
      this.viewer?.disconnect();
      this.canvas?.remove();
      this.removeAttribute('data-live');
    }

    setup() {
      const gl = this.gl;
      const prog = program(gl);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = Object.fromEntries(UNIFORMS.map((k) => [k, gl.getUniformLocation(prog, k)]));

      this.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      this.paper = document.createElement('canvas');
      this.lens = { x: 0, y: 0, vx: 0, vy: 0 };
      this.drop = { x: 0, y: 0, vx: 0, vy: 0 };
      this.flow = { x: 0, y: 0 };
      this.pointer = { x: 0, y: 0, active: false };
      this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.visible = true;
      this.last = performance.now();

      this.resize();
      Object.assign(this.lens, this.wander(0));
      Object.assign(this.drop, this.wander(0));
    }

    listen() {
      const aim = (e) => {
        const r = this.getBoundingClientRect();
        this.pointer.x = (e.clientX - r.left) * this.dpr;
        this.pointer.y = (r.bottom - e.clientY) * this.dpr;
        this.pointer.active = true;
      };
      this.addEventListener('pointermove', aim);
      this.addEventListener('pointerdown', aim);
      this.addEventListener('pointerleave', () => { this.pointer.active = false; });

      this.resizer = new ResizeObserver(() => this.resize());
      this.resizer.observe(this);
      this.viewer = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; });
      this.viewer.observe(this);
      document.fonts.ready.then(() => this.paint());
    }

    title() {
      return [...this.children].find((c) => c !== this.canvas) ?? this;
    }

    paint() {
      const title = this.title();
      const style = getComputedStyle(title);
      const host = getComputedStyle(this);
      const size = parseFloat(style.fontSize) * this.dpr;
      const lead = parseFloat(style.lineHeight) * this.dpr || size * 0.92;
      const lines = title.innerText.split('\n').filter((l) => l.trim());
      const ink = this.paper.getContext('2d');

      this.paper.width = this.w;
      this.paper.height = this.h;
      ink.fillStyle = host.backgroundColor;
      ink.fillRect(0, 0, this.w, this.h);
      ink.fillStyle = host.getPropertyValue('--lg-ink').trim() || '#000';
      ink.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
      ink.letterSpacing = `${parseFloat(style.letterSpacing) * this.dpr || 0}px`;
      ink.textAlign = 'center';
      ink.textBaseline = 'middle';
      const top = this.h / 2 - (lead * (lines.length - 1)) / 2;
      lines.forEach((line, i) => ink.fillText(line, this.w / 2, top + i * lead));

      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.paper);
    }

    resize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
      this.w = Math.max(1, Math.round(this.clientWidth * this.dpr));
      this.h = Math.max(1, Math.round(this.clientHeight * this.dpr));
      this.canvas.width = this.w;
      this.canvas.height = this.h;
      this.gl.viewport(0, 0, this.w, this.h);
      this.paint();
    }

    wander(time) {
      return {
        x: this.w / 2 + Math.sin(time * 0.37) * this.w * 0.24,
        y: this.h / 2 + Math.sin(time * 0.53 + 1.2) * this.h * 0.05
      };
    }

    smooth(dt) {
      const k = Math.min(1, dt * 8);
      this.flow.x += ((this.lens.vx * STRETCH) / this.dpr - this.flow.x) * k;
      this.flow.y += ((this.lens.vy * STRETCH) / this.dpr - this.flow.y) * k;
      const s = Math.hypot(this.flow.x, this.flow.y);
      if (s > STRETCH_MAX) {
        this.flow.x *= STRETCH_MAX / s;
        this.flow.y *= STRETCH_MAX / s;
      }
    }

    frame(now) {
      this.raf = requestAnimationFrame((t) => this.frame(t));
      if (!this.visible) {
        this.last = now;
        return;
      }

      const dt = Math.min((now - this.last) / 1000, 1 / 30);
      this.last = now;
      const time = this.still ? 0 : now / 1000;
      const target = this.pointer.active ? this.pointer : this.wander(time);
      const ra = Math.min(this.w, this.h * 1.6) * number(this, 'size', DEFAULT_SIZE);

      step(this.lens, target, SPRING, dt);
      step(this.drop, this.lens, DROP, dt);
      leash(this.drop, this.lens, ra * LEASH);
      this.smooth(dt);

      const gl = this.gl;
      const u = this.u;
      gl.uniform1i(u.tex, 0);
      gl.uniform2f(u.res, this.w, this.h);
      gl.uniform2f(u.a, this.lens.x, this.lens.y);
      gl.uniform2f(u.b, this.drop.x, this.drop.y);
      gl.uniform1f(u.ra, ra);
      gl.uniform1f(u.rb, ra * DROP_RATIO);
      gl.uniform2f(u.stretch, this.flow.x, this.flow.y);
      gl.uniform1f(u.t, time);
      gl.uniform1f(u.power, number(this, 'power', DEFAULT_POWER));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  injectStyle();
  customElements.define(TAG, LiquidGlass);
})();
