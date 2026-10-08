<script lang="ts">
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import X from '@lucide/svelte/icons/x';
  import Plus from '@lucide/svelte/icons/plus';
  import { page } from '$app/state';
  import { applyStack, CUSTOM, EFFECTS, type EffectId, type EffectStep, type Pixels } from '$lib/canvas/effects';
  import { addStep, controlFor, fitWithin, moveStep, removeStep, setParam, exportsSvg, stepLabel, stepParams, svgExport, toggleStep } from '$lib/canvas/effects/editor';
  import { addCustomStep, customPass, CustomStatus, statusOf } from '$lib/canvas/effects/custom';
  import { customEffectsOf } from '$lib/canvas/effects/custom-effects.svelte';
  import { glDrawer } from '$lib/canvas/effects/gl-drawer';
  import StudioParamControl from './StudioParamControl.svelte';
  import { ListMenu } from '$lib/components/ui/control/index.js';

  const PREVIEW_MAX_SIDE = 900;
  const PREVIEW_DEBOUNCE_MS = 80;
  const UNSAVED_PROMPT = 'Close without applying? Your changes to the stack will be lost.';

  type View = 'after' | 'before';

  let {
    initialSteps,
    inputUrl,
    inputKind = 'image',
    onapply,
    onclose
  }: {
    initialSteps: EffectStep[];
    inputUrl: string | null;
    inputKind?: 'image' | 'video';
    onapply: (steps: EffectStep[], output: Blob | null) => Promise<boolean>;
    onclose: () => void;
  } = $props();

  let steps = $state<EffectStep[]>(structuredClone($state.snapshot(initialSteps)) as EffectStep[]);
  let view = $state<View>('after');
  let busy = $state(false);
  let loadError = $state<string | null>(null);
  let canvas = $state<HTMLCanvasElement | null>(null);
  let bitmap = $state.raw<ImageBitmap | null>(null);
  let video = $state.raw<HTMLVideoElement | null>(null);
  let preview: Pixels | null = null;

  const effectIds = Object.keys(EFFECTS) as EffectId[];
  const CUSTOM_PREFIX = 'custom:';
  const customs = customEffectsOf(page.params.projectId);
  const drawer = glDrawer();
  const pass = $derived(customPass(customs.list, drawer.draw));
  let brokenRefs = $state<string[]>([]);

  function broken(step: EffectStep): boolean {
    if (step.id !== CUSTOM) {
      return false;
    }

    return statusOf(customs.list, step.ref) !== CustomStatus.Ready || brokenRefs.includes(step.ref);
  }
  const dirty = $derived(JSON.stringify(steps) !== JSON.stringify(initialSteps));

  async function loadBitmap(url: string): Promise<ImageBitmap> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`image unavailable (${res.status})`);
    }
    return createImageBitmap(await res.blob());
  }

  function pixelsOf(source: CanvasImageSource, size: { width: number; height: number }): Pixels {
    const scratch = document.createElement('canvas');
    scratch.width = size.width;
    scratch.height = size.height;
    const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(source, 0, 0, size.width, size.height);
    const image = ctx.getImageData(0, 0, size.width, size.height);
    return { width: image.width, height: image.height, data: image.data };
  }

  function draw(target: HTMLCanvasElement, pixels: Pixels) {
    target.width = pixels.width;
    target.height = pixels.height;
    target.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
  }

  function copyOf(pixels: Pixels): Pixels {
    return { width: pixels.width, height: pixels.height, data: new Uint8ClampedArray(pixels.data) };
  }

  $effect(() => {
    if (!inputUrl) {
      loadError = 'Connect an image to the node to see a preview';
      return;
    }

    let cancelled = false;
    if (inputKind === 'video') {
      const loaded = document.createElement('video');
      loaded.src = inputUrl;
      loaded.crossOrigin = 'anonymous';
      loaded.muted = true;
      loaded.loop = true;
      loaded.playsInline = true;
      loaded.onloadedmetadata = () => {
        if (cancelled) {
          return;
        }
        video = loaded;
        preview = pixelsOf(loaded, fitWithin(loaded.videoWidth, loaded.videoHeight, PREVIEW_MAX_SIDE));
        void loaded.play();
      };
      loaded.onerror = () => { loadError = 'Video cannot be read'; };
      return () => {
        cancelled = true;
        loaded.pause();
        loaded.removeAttribute('src');
        loaded.load();
        video = null;
      };
    }

    loadBitmap(inputUrl)
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        bitmap = loaded;
        preview = pixelsOf(loaded, fitWithin(loaded.width, loaded.height, PREVIEW_MAX_SIDE));
        redraw();
      })
      .catch((cause: unknown) => {
        loadError = cause instanceof Error ? cause.message : 'Image cannot be read';
      });

    return () => {
      cancelled = true;
    };
  });

  function redraw() {
    if (!canvas || !preview) {
      return;
    }
    if (video && video.readyState >= video.HAVE_CURRENT_DATA) {
      preview = pixelsOf(video, fitWithin(video.videoWidth, video.videoHeight, PREVIEW_MAX_SIDE));
    }
    draw(canvas, view === 'before' ? preview : applyStack(copyOf(preview), $state.snapshot(steps) as EffectStep[], pass));
    const failing = steps.flatMap((step) => (step.id === CUSTOM && drawer.broken(step.ref) ? [step.ref] : []));
    if (failing.join() !== brokenRefs.join()) {
      brokenRefs = failing;
    }
  }

  $effect(() => {
    if (!video) {
      return;
    }
    let frame = 0;
    const render = () => {
      redraw();
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  });

  $effect(() => {
    JSON.stringify(steps);
    void view;
    void pass;

    let frame = 0;
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(redraw);
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  });

  function close() {
    if (busy) {
      return;
    }
    if (dirty && !confirm(UNSAVED_PROMPT)) {
      return;
    }
    onclose();
  }

  function outputBlob(pixels: Pixels): Promise<Blob | null> {
    const full = document.createElement('canvas');
    draw(full, pixels);
    return new Promise((resolve) => full.toBlob(resolve, 'image/png'));
  }

  async function apply() {
    if ((!bitmap && !video) || busy) {
      return;
    }

    busy = true;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    try {
      const current = $state.snapshot(steps) as EffectStep[];
      const output = bitmap ? await outputBlob(applyStack(pixelsOf(bitmap, bitmap), current, pass)) : null;
      if (bitmap && !output) {
        loadError = 'Could not export the image';
        return;
      }
      if (await onapply(current, output)) {
        onclose();
      }
    } finally {
      busy = false;
    }
  }

  const svgReady = $derived(Boolean(bitmap) && exportsSvg(steps));

  function downloadSvg() {
    if (!bitmap) {
      return;
    }
    const svg = svgExport(pixelsOf(bitmap, bitmap), $state.snapshot(steps) as EffectStep[]);
    if (!svg) {
      return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    link.download = 'shape-mosaic.svg';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const effectItems = $derived([
    { id: 'effects', label: '', items: effectIds.map((id) => ({ value: id, label: EFFECTS[id].label })) },
    ...(customs.list.length ? [{ id: 'custom', label: 'Custom', items: customs.list.map((c) => ({ value: `${CUSTOM_PREFIX}${c.id}`, label: c.name })) }] : [])
  ]);

  function add(id: string) {
    const custom = id.startsWith(CUSTOM_PREFIX) ? customs.list.find((c) => c.id === id.slice(CUSTOM_PREFIX.length)) : null;
    steps = custom ? addCustomStep(steps, custom) : addStep(steps, id as EffectId);
  }

  function onkeydown(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === 'Escape') {
      close();
    }
  }
</script>

<div class="fx-backdrop" role="presentation" onclick={close}></div>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section class="fx-editor" role="dialog" aria-label="Effects editor" tabindex="-1" {onkeydown}>
  <header class="fx-head">
    <h2>Effects</h2>
    <button type="button" class="fx-icon" aria-label="Close" onclick={close}><X size={16} /></button>
  </header>

  <div class="fx-body">
    <div class="fx-preview">
      {#if loadError}
        <p class="fx-note">{loadError}</p>
      {/if}
      <canvas bind:this={canvas} class="fx-canvas" data-testid="effects-preview"></canvas>
      <div class="fx-toggle" role="group" aria-label="Confronto">
        <button type="button" class:is-on={view === 'before'} onclick={() => (view = 'before')}>Before</button>
        <button type="button" class:is-on={view === 'after'} onclick={() => (view = 'after')}>After</button>
      </div>
    </div>

    <aside class="fx-side">
      <div class="fx-add">
      <ListMenu label="Add effect" control="add-effect" groups={effectItems} value={null} onselect={add} triggerClass="w-full" contentClass="w-(--bits-floating-anchor-width)">
        {#snippet trigger()}
          <Plus class="size-3.5" aria-hidden="true" />
          <span>Add effect</span>
        {/snippet}
      </ListMenu>
      </div>

      <ol class="fx-stack">
        {#each steps as step, index (index)}
          <li class="fx-step" class:is-off={!step.enabled} class:is-broken={broken(step)} data-effect={step.id}>
            <div class="fx-step-head">
              <span class="fx-step-name">{stepLabel(step, customs.list)}</span>
              <button type="button" class="fx-icon" aria-label="Move up" disabled={index === 0} onclick={() => (steps = moveStep(steps, index, 'up'))}><ArrowUp size={14} /></button>
              <button type="button" class="fx-icon" aria-label="Move down" disabled={index === steps.length - 1} onclick={() => (steps = moveStep(steps, index, 'down'))}><ArrowDown size={14} /></button>
              <button type="button" class="fx-icon" aria-label={step.enabled ? 'Disattiva' : 'Attiva'} onclick={() => (steps = toggleStep(steps, index))}>
                {#if step.enabled}<Eye size={14} />{:else}<EyeOff size={14} />{/if}
              </button>
              <button type="button" class="fx-icon" aria-label="Rimuovi" onclick={() => (steps = removeStep(steps, index))}><Trash2 size={14} /></button>
            </div>
            {#each stepParams(step, customs.list) as param (param.name)}
              <StudioParamControl
                label={param.label}
                control={controlFor(param, step.params[param.name])}
                onchange={(value) => (steps = setParam(steps, index, param.name, value))}
              />
            {/each}
          </li>
        {:else}
          <li class="fx-note">No effects yet: add one from the menu.</li>
        {/each}
      </ol>

      <footer class="fx-foot">
        {#if svgReady}
          <button type="button" class="fx-button" onclick={downloadSvg} disabled={busy}>Download SVG</button>
        {/if}
        <button type="button" class="fx-button" onclick={close} disabled={busy}>Cancel</button>
        <button type="button" class="fx-button is-primary" onclick={apply} disabled={busy || (!bitmap && !video)}>
          {#if busy}<LoaderCircle size={14} class="fx-spin" />{/if}
          Applica
        </button>
      </footer>
    </aside>
  </div>
</section>

<style>
  .fx-add {
    padding: 12px;
  }

  .fx-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgb(0 0 0 / 0.12);
  }

  .fx-editor {
    position: fixed;
    top: 44px;
    left: 60px;
    right: 16px;
    bottom: 16px;
    z-index: 61;
    display: flex;
    flex-direction: column;
    background: var(--paper, #fff);
    border: 1px solid var(--line, #ededef);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
  }

  @media (max-width: 480px) {
    .fx-editor {
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }
    .fx-body {
      flex-direction: column;
    }
    .fx-side {
      flex-basis: auto;
      border-left: 0;
      border-top: 1px solid var(--line, #ededef);
    }
  }

  .fx-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--line, #ededef);
  }
  .fx-head h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .fx-body {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .fx-preview {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--paper-2, #f9f9f9);
  }

  .fx-canvas {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .fx-toggle {
    position: absolute;
    left: 50%;
    bottom: 12px;
    display: flex;
    transform: translateX(-50%);
    border: 1px solid var(--line, #ededef);
    background: var(--paper, #fff);
  }
  .fx-toggle button {
    padding: 4px 12px;
    font: inherit;
    font-size: 12px;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .fx-toggle button.is-on {
    background: var(--ink, #1d1d1f);
    color: var(--paper, #fff);
  }

  .fx-side {
    flex: 0 0 320px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-left: 1px solid var(--line, #ededef);
  }


  .fx-stack {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    margin: 0;
    padding: 0 12px;
    list-style: none;
  }

  .fx-step {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    margin-bottom: 8px;
    border: 1px solid var(--line, #ededef);
  }
  .fx-step.is-broken {
    border-color: var(--danger, #d92d20);
  }
  .fx-step.is-off {
    opacity: 0.5;
  }

  .fx-step-head {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .fx-step-name {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
  }

  .fx-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: 0;
    background: transparent;
    color: var(--ink-soft, #6e6e73);
    cursor: pointer;
  }
  .fx-icon:hover:not(:disabled) {
    background: var(--paper-2, #f9f9f9);
    color: var(--ink, #1d1d1f);
  }
  .fx-icon:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .fx-note {
    margin: 0;
    font-size: 12px;
    color: var(--ink-soft, #6e6e73);
  }
  .fx-preview .fx-note {
    position: absolute;
    top: 12px;
  }

  .fx-foot {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid var(--line, #ededef);
  }

  .fx-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    font: inherit;
    font-size: 13px;
    border: 1px solid var(--line, #ededef);
    background: var(--paper, #fff);
    cursor: pointer;
  }
  .fx-button.is-primary {
    background: var(--ink, #1d1d1f);
    color: var(--paper, #fff);
    border-color: var(--ink, #1d1d1f);
  }
  .fx-button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  :global(.fx-spin) {
    animation: fx-spin 900ms linear infinite;
  }
  @keyframes fx-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
