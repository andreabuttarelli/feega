<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import { mergeProps } from 'bits-ui';
  import { cn } from '$lib/utils.js';
  import Hint from './Hint.svelte';
  import { FOCUS_RING, ICON_SIZE, IconSize, Side, TONE, Tone } from './styles';

  let {
    label,
    shortcut,
    size = IconSize.Md,
    tone = Tone.Ghost,
    side = Side.Top,
    pressed,
    class: className,
    children: icon,
    ...rest
  }: Omit<HTMLButtonAttributes, 'children'> & {
    label: string;
    shortcut?: string;
    size?: IconSize;
    tone?: Tone;
    side?: Side;
    pressed?: boolean;
    children: Snippet;
  } = $props();
</script>

<Hint {label} {shortcut} {side}>
  {#snippet children(trigger)}
    <button
      {...mergeProps(rest, trigger)}
      type="button"
      data-slot="icon-button"
      aria-label={label}
      aria-pressed={pressed}
      class={cn(
        'inline-flex shrink-0 items-center justify-center rounded-sm transition-colors duration-(--ui-dur-fast) pointer-coarse:size-11 disabled:pointer-events-none disabled:text-ui-text-off aria-expanded:bg-ui-wash aria-pressed:bg-ui-selected aria-pressed:text-ui-accent-text [&_svg]:shrink-0',
        FOCUS_RING,
        ICON_SIZE[size],
        TONE[tone],
        className
      )}
    >
      {@render icon()}
    </button>
  {/snippet}
</Hint>
