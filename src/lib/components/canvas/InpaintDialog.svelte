<script lang="ts">
  import type { Mask, Stroke } from '$lib/image-mask';
  import { BRUSH_DEFAULT_PX, BRUSH_MAX_PX, BRUSH_MIN_PX, brushOf, maskOfStrokes, pointOf, thinned, type ScreenRect } from '$lib/canvas/brush';

  let { src, onapply, onclose }: { src: string; onapply: (prompt: string, mask: Mask) => void; onclose: () => void } = $props();

  const PAINT = 'rgba(255, 64, 64, 0.55)';

  let picture = $state<HTMLImageElement | null>(null);
  let overlay = $state<HTMLCanvasElement | null>(null);
  let strokes = $state<Stroke[]>([]);
  let live = $state<[number, number][] | null>(null);
  let brushPx = $state(BRUSH_DEFAULT_PX);
  let prompt = $state('');

  const mask = $derived(maskOfStrokes(strokes));
  const ready = $derived(Boolean(mask) && prompt.trim().length > 0);

  function rectOf(): ScreenRect {
    const box = overlay!.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  }

  function paint() {
    if (!overlay) {
      return;
    }
    const canvas = overlay;
    const context = overlay.getContext('2d')!;
    context.clearRect(0, 0, overlay.width, overlay.height);
    context.strokeStyle = PAINT;
    context.fillStyle = PAINT;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    const shorter = Math.min(overlay.width, overlay.height);
    const all = live ? [...strokes, { points: live, width: brushOf(brushPx, rectOf()) }] : strokes;
    for (const stroke of all) {
      const width = stroke.width * shorter;
      const points = stroke.points.map(([x, y]) => [x * canvas.width, y * canvas.height] as const);
      if (points.length === 1) {
        context.beginPath();
        context.arc(points[0][0], points[0][1], width / 2, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      context.lineWidth = width;
      context.beginPath();
      points.forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
      context.stroke();
    }
  }

  function fit() {
    if (!picture || !overlay) {
      return;
    }
    overlay.width = picture.clientWidth;
    overlay.height = picture.clientHeight;
    paint();
  }

  function begin(event: PointerEvent) {
    overlay!.setPointerCapture(event.pointerId);
    live = [pointOf({ x: event.clientX, y: event.clientY }, rectOf())];
    paint();
  }

  function extend(event: PointerEvent) {
    if (!live) {
      return;
    }
    live = [...live, pointOf({ x: event.clientX, y: event.clientY }, rectOf())];
    paint();
  }

  function end() {
    if (!live) {
      return;
    }
    strokes = [...strokes, { points: thinned(live), width: brushOf(brushPx, rectOf()) }];
    live = null;
    paint();
  }

  function undo() {
    strokes = strokes.slice(0, -1);
    paint();
  }

  function clear() {
    strokes = [];
    paint();
  }

  function apply() {
    if (mask && ready) {
      onapply(prompt.trim(), mask);
      onclose();
    }
  }

  $effect(() => {
    if (!picture) {
      return;
    }
    const observer = new ResizeObserver(fit);
    observer.observe(picture);
    return () => observer.disconnect();
  });
</script>

<div class="ip-overlay" role="button" tabindex="-1" aria-label="Cancel" onclick={(e) => e.target === e.currentTarget && onclose()} onkeydown={(e) => e.key === 'Escape' && onclose()}>
  <div class="ip-card" role="dialog" aria-modal="true" aria-label="Inpaint" data-testid="inpaint-dialog">
    <h3>Inpaint</h3>
    <p class="ip-hint">Paint over what should change, then say what goes there.</p>
    <div class="ip-stage">
      <div class="ip-frame">
        <img bind:this={picture} {src} alt="" draggable="false" onload={fit} />
        <canvas
        bind:this={overlay}
        aria-label="Paint the area to change"
        data-testid="inpaint-surface"
        onpointerdown={begin}
        onpointermove={extend}
        onpointerup={end}
        onpointercancel={end}
        ></canvas>
      </div>
    </div>
    <div class="ip-tools">
      <label class="ip-brush">Brush<input type="range" min={BRUSH_MIN_PX} max={BRUSH_MAX_PX} bind:value={brushPx} aria-label="Brush size" data-testid="inpaint-brush" /></label>
      <button class="ip-btn" type="button" disabled={!strokes.length} onclick={undo} data-testid="inpaint-undo">Undo</button>
      <button class="ip-btn" type="button" disabled={!strokes.length} onclick={clear} data-testid="inpaint-clear">Clear</button>
    </div>
    <textarea bind:value={prompt} rows="2" placeholder="What goes in the painted area?" aria-label="Prompt" data-testid="inpaint-prompt"></textarea>
    <div class="ip-actions">
      <button class="ip-btn" type="button" onclick={onclose}>Cancel</button>
      <button class="ip-btn primary" type="button" disabled={!ready} onclick={apply} data-testid="inpaint-apply">Inpaint</button>
    </div>
  </div>
</div>

<style>
  .ip-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; padding: 24px; }
  .ip-card { background: var(--paper, #fff); padding: 22px; width: 100%; max-width: 640px; max-height: 100%; overflow: auto; border-radius: var(--ui-radius-lg); box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column; gap: 10px; }
  .ip-card h3 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
  .ip-hint { margin: 0; font-size: 13px; color: var(--ink-soft, #6e6e73); }
  .ip-stage { display: flex; justify-content: center; background: var(--paper-2, #f5f5f7); }
  .ip-frame { position: relative; line-height: 0; }
  .ip-frame img { display: block; max-width: 100%; max-height: 50vh; user-select: none; }
  .ip-frame canvas { position: absolute; inset: 0; width: 100%; height: 100%; cursor: crosshair; touch-action: none; }
  .ip-tools { display: flex; align-items: center; gap: 10px; }
  .ip-brush { display: flex; align-items: center; gap: 8px; font-size: 13px; flex: 1; }
  .ip-brush input { flex: 1; }
  .ip-card textarea { font: inherit; font-size: 14px; padding: 8px; border: 1px solid var(--line, #e3e3e6); border-radius: var(--ui-radius-sm); resize: vertical; }
  .ip-actions { display: flex; gap: 10px; justify-content: flex-end; }
  .ip-btn { font: inherit; font-size: 13.5px; font-weight: 600; padding: 8px 14px; cursor: pointer; background: var(--paper-2, #f5f5f7); color: var(--ink, #1d1d1f); border: 1px solid var(--line, #e3e3e6); border-radius: var(--ui-radius-sm); }
  .ip-btn.primary { background: var(--ink, #1d1d1f); color: var(--paper, #fff); }
  .ip-btn:disabled { opacity: 0.5; cursor: default; }
</style>
