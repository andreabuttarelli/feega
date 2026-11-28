<script lang="ts">
  import { presetSize, typedSize, type FrameSize, type Limits } from './canvas-select';
  import { DEVICE_SIZES, PRESETS, SIZES, type Size } from './sizes';

  type Props = { name: string; size: FrameSize; limits: Limits; onsize: (size: FrameSize) => void; onopen: () => void };

  let { name, size, limits, onsize, onopen }: Props = $props();

  const OPTIONS = [...PRESETS, ...DEVICE_SIZES].filter((s) => presetSize(s) !== null);
  const CUSTOM = 'custom';

  const matching = $derived(OPTIONS.find((s) => presetSize(s)?.width === size.width && presetSize(s)?.height === size.height) ?? CUSTOM);

  function pick(value: string) {
    const next = value === CUSTOM ? null : presetSize(value as Size);
    if (next) {
      onsize(next);
    }
  }

  function type(side: keyof FrameSize, input: HTMLInputElement) {
    const next = typedSize(size, side, input.value, limits);
    if (next) {
      onsize(next);
    }
    input.value = String(next?.[side] ?? size[side]);
  }
</script>

<div class="sizebar" data-testid="canvas-sizebar">
  <span class="name" title={name}>{name}</span>
  <select aria-label="Device preset" data-testid="canvas-preset" value={matching} onchange={(e) => pick(e.currentTarget.value)}>
    <option value={CUSTOM}>Custom</option>
    {#each OPTIONS as option (option)}<option value={option}>{SIZES[option].label}</option>{/each}
  </select>
  <input aria-label="Width" data-testid="canvas-width" inputmode="numeric" value={size.width} onchange={(e) => type('width', e.currentTarget)} onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
  <span class="by">×</span>
  <input aria-label="Height" data-testid="canvas-height" inputmode="numeric" value={size.height} onchange={(e) => type('height', e.currentTarget)} onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
  <button type="button" data-testid="canvas-open-editor" title="Open in editor (Enter)" onclick={onopen}>Open in editor</button>
</div>

<style>
  .sizebar {
    position: absolute;
    bottom: 52px;
    left: 50%;
    z-index: 6;
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: calc(100% - 24px);
    padding: 4px 6px;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel);
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
    transform: translateX(-50%);
    user-select: none;
  }

  .name {
    max-width: 160px;
    overflow: hidden;
    color: var(--ui-text);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  select,
  input,
  button {
    height: 26px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
  }

  input {
    width: 56px;
    padding: 0 6px;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  select {
    padding: 0 4px;
  }

  button {
    padding: 0 10px;
    cursor: pointer;
  }

  button:hover {
    background: var(--ui-accent);
    color: var(--ui-accent-text, var(--ui-text));
  }
</style>
