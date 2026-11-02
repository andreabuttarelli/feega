<script lang="ts">
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
  import { IconButton, IconSize } from '$lib/components/ui/shell';
  import SidePopover from '$lib/components/ui/shell/SidePopover.svelte';
  import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import type { AutoLayout } from '@feega/motion-core/motion/layout/model';
  import StackSettingsPanel from './StackSettingsPanel.svelte';

  let { doc, clip, commit }: { doc: MotionDoc; clip: MotionClip & { autoLayout: AutoLayout }; commit: (result: OpResult, summary: string) => void } = $props();

  let open = $state(false);
  let anchor = $state<HTMLElement | null>(null);
</script>

<span bind:this={anchor}><IconButton label="Advanced layout settings" size={IconSize.Sm} pressed={open} data-testid="auto-layout-advanced" onclick={() => (open = !open)}><SlidersHorizontal /></IconButton></span>

{#if open && anchor}
  <SidePopover {anchor} title="Layout settings" onclose={() => (open = false)}><StackSettingsPanel {doc} {clip} {commit} /></SidePopover>
{/if}
