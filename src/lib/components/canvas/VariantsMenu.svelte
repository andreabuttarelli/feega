<script lang="ts">
  import Layers from '@lucide/svelte/icons/layers';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { VARIANT_DESTINATIONS, VariantInto } from '$lib/canvas/variants';
  import type { VariantsQuote } from '$lib/canvas/run-quote';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import { CONTROL_HEIGHT, ControlRow, Segmented } from '$lib/components/ui/control/index.js';
  import { cn } from '$lib/utils.js';

  let { quote, onchange }: { quote: VariantsQuote; onchange: (patch: { variants?: number; variantsInto?: VariantInto }) => void } = $props();

  const countOptions = $derived(quote.counts.map((count) => ({ value: String(count), label: `×${count}` })));
  const destination = $derived(VARIANT_DESTINATIONS.find((d) => d.value === quote.into));
</script>

<Popover.Root>
  <Popover.Trigger
    aria-label={`Variants: ${quote.count}, ${destination?.label ?? ''}`}
    data-control="variants"
    class={cn(
      CONTROL_HEIGHT,
      'inline-flex items-center gap-1.5 border border-line-2 bg-background px-2 text-xs text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-muted'
    )}
  >
    <Layers class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    <span class="tabular-nums">×{quote.count}</span>
    <ChevronDown class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
  </Popover.Trigger>
  <Popover.Content class="w-72">
    <div class="py-1">
      <ControlRow label="Variants" control="variants-count">
        <Segmented label="Variants" value={quote.count} options={countOptions} onchange={(value) => onchange({ variants: Number(value) })} />
      </ControlRow>
      {#if quote.count > 1}
        <ControlRow label="Put the results" control="variants-into">
          <Segmented label="Put the results" value={quote.into} options={[...VARIANT_DESTINATIONS]} onchange={(value) => onchange({ variantsInto: value as VariantInto })} />
        </ControlRow>
      {/if}
    </div>
  </Popover.Content>
</Popover.Root>
