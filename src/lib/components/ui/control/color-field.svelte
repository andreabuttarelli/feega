<script lang="ts">
  import type { ControlProps } from './types';

  let { label, value, onchange }: ControlProps = $props();
</script>

<label class="inline-flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
  <span class="uppercase">{String(value ?? '')}</span>
  <input
    type="color"
    aria-label={label}
    value={String(value ?? '#000000')}
    class="h-8 w-11 cursor-pointer border border-line-2 bg-background p-0.5"
    oninput={(e) => onchange(e.currentTarget.value)}
  />
</label>
