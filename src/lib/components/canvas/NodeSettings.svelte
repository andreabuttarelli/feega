<script lang="ts">
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { summaryOf, type ControlSection, type NodeControl, type SelectionPatch } from '$lib/canvas/node-controls';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import { CONTROL_HEIGHT, CONTROL_ROW } from '$lib/components/ui/control/index.js';
  import { cn } from '$lib/utils.js';
  import NodeControlField from './NodeControlField.svelte';

  let { controls, onchange }: { controls: NodeControl[]; onchange: (patch: SelectionPatch) => void } = $props();

  const SECTIONS: { id: ControlSection; label: string; collapsible: boolean }[] = [
    { id: 'output', label: 'Output', collapsible: false },
    { id: 'advanced', label: 'Advanced', collapsible: true }
  ];

  let advancedOpen = $state(false);

  const summary = $derived(summaryOf(controls) || 'Settings');
  const sections = $derived(
    SECTIONS.map((s) => ({ ...s, controls: controls.filter((c) => c.section === s.id) })).filter((s) => s.controls.length)
  );

  function expanded(section: { collapsible: boolean }): boolean {
    return !section.collapsible || advancedOpen;
  }
</script>

<Popover.Root>
  <Popover.Trigger
    aria-label={`Settings: ${summary}`}
    data-control="settings"
    class={cn(
      CONTROL_HEIGHT,
      'inline-flex min-w-0 max-w-64 items-center gap-1.5 border border-line-2 bg-background px-2 text-xs text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-muted'
    )}
  >
    <SlidersHorizontal class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    <span class="truncate tabular-nums">{summary}</span>
    <ChevronDown class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
  </Popover.Trigger>
  <Popover.Content class="w-80">
    <div class="min-h-0 overflow-y-auto py-1">
      {#each sections as section (section.id)}
        <section data-section={section.id} class="border-line-2 not-first:border-t">
          {#if section.collapsible}
            <button
              type="button"
              aria-expanded={advancedOpen}
              class={cn(CONTROL_ROW, 'flex w-full items-center gap-1 px-3 text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:bg-muted')}
              onclick={() => (advancedOpen = !advancedOpen)}
            >
              {#if advancedOpen}<ChevronDown class="size-3.5" aria-hidden="true" />{:else}<ChevronRight class="size-3.5" aria-hidden="true" />{/if}
              {section.label}
              <span class="ml-auto font-normal normal-case tracking-normal">{section.controls.length}</span>
            </button>
          {:else}
            <h3 class={cn(CONTROL_ROW, 'm-0 flex items-center px-3 text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase')}>
              {section.label}
            </h3>
          {/if}
          {#if expanded(section)}
            <div class="pb-2">
              {#each section.controls as control (control.id)}
                <NodeControlField {control} {onchange} />
              {/each}
            </div>
          {/if}
        </section>
      {/each}
    </div>
  </Popover.Content>
</Popover.Root>
