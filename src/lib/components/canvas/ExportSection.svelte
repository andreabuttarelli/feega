<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus';
  import { IconButton, IconSize } from '$lib/components/ui/shell';

  let { onexport }: { onexport: () => void } = $props();
</script>

<section class="section ui-section" data-testid="export-section">
  <h3>Export</h3>
  <IconButton label="Export selection" size={IconSize.Sm} data-testid="export-add" onclick={onexport}><Plus /></IconButton>
</section>

<style>
  .section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 36px;
    padding: 0 12px;
    border-bottom: 1px solid var(--ui-line);
  }

  h3 {
    margin: 0;
    font-size: var(--ui-text-xs);
    font-weight: 600;
  }
</style>
