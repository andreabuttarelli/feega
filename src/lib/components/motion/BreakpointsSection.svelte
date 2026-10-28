<script lang="ts">
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import { addBreakpoint, BASE_BREAKPOINT, BreakpointPreset, removeBreakpoint, viewsOf } from '@feega/motion-core/motion/breakpoints/model';

  let { doc, active, onchange, onpick }: { doc: MotionDoc; active: string; onchange: (result: OpResult, summary: string) => void; onpick: (breakpointId: string) => void } = $props();

  const views = $derived(viewsOf(doc));
  const PRESETS = [BreakpointPreset.Tablet, BreakpointPreset.Phone];
  const PRESET_NAMES: Record<BreakpointPreset, string> = { [BreakpointPreset.Tablet]: 'Tablet 810', [BreakpointPreset.Phone]: 'Phone 390' };

  let menuOpen = $state(false);
  let custom = $state('');

  const newId = () => crypto.randomUUID().slice(0, 8);

  function add(spec: Parameters<typeof addBreakpoint>[1], summary: string) {
    menuOpen = false;
    onchange(addBreakpoint(doc, spec, newId()), summary);
  }

  function addCustom() {
    const width = Math.round(Number(custom));
    if (!Number.isFinite(width) || width <= 0) {
      return;
    }
    custom = '';
    add({ name: `${width}`, width }, `Added a ${width}px breakpoint`);
  }

  function remove(id: string) {
    if (active === id) {
      onpick(BASE_BREAKPOINT);
    }
    onchange({ ok: true, doc: removeBreakpoint(doc, id) }, 'Removed a breakpoint');
  }
</script>

<div class="breakpoints" data-testid="breakpoints-section">
  <header>
    <span>Breakpoints</span>
    <button type="button" class="add" aria-label="Add breakpoint" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)} data-testid="add-breakpoint">+</button>
  </header>
  {#if menuOpen}
    <div class="menu" role="menu" data-testid="breakpoint-menu">
      {#each PRESETS as preset (preset)}
        <button type="button" role="menuitem" onclick={() => add(preset, `Added the ${PRESET_NAMES[preset]} breakpoint`)} data-testid={`breakpoint-preset-${preset}`}>{PRESET_NAMES[preset]}</button>
      {/each}
      <form class="custom" onsubmit={(e) => (e.preventDefault(), addCustom())}>
        <input type="number" min="120" aria-label="Custom width" placeholder="Width" bind:value={custom} data-testid="breakpoint-custom-width" />
        <button type="submit">Add</button>
      </form>
    </div>
  {/if}
  {#if views.length > 1}
    {#each views as view (view.id)}
      <div class="view" class:active={active === view.id} data-testid="breakpoint-view">
        <button type="button" class="pick" aria-pressed={active === view.id} onclick={() => onpick(view.id)}>{view.name} <span class="width">{view.width}</span></button>
        {#if view.id !== BASE_BREAKPOINT}
          <button type="button" class="remove" aria-label={`Remove ${view.name}`} onclick={() => remove(view.id)}>Remove</button>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .breakpoints {
    display: grid;
    gap: 6px;
    padding: 12px;
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-2);
  }

  header,
  .view {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
  }

  .menu {
    display: grid;
    gap: 2px;
    padding: 4px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-md);
    background: var(--ui-surface);
  }

  .custom {
    display: flex;
    gap: 4px;
  }

  input {
    min-width: 0;
    flex: 1;
    height: 28px;
    padding: 0 6px;
    border: 1px solid transparent;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-ink);
    font: inherit;
  }

  button {
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  button:hover {
    background: var(--ui-hover);
  }

  .pick {
    flex: 1;
  }

  .active .pick {
    background: var(--ui-selected, var(--ui-hover));
  }

  .width {
    color: var(--ui-ink-3, var(--ui-ink-2));
    font-variant-numeric: tabular-nums;
  }
</style>
