<script lang="ts">
  import type { Palette } from '../messages';
  import PluginNodes from './PluginNodes.svelte';
  import SectionHead from './SectionHead.svelte';
  import type { Plugins } from './plugins.svelte';
  import { foldKey, isOpen } from './section-folds';

  type Props = { plugins: Plugins; palette: Palette; closed: string[]; ontoggle: (key: string) => void };

  let { plugins, palette, closed, ontoggle }: Props = $props();

  const sections = $derived(
    plugins.rightBar
      .map((one) => ({ key: foldKey(one.plugin, one.entry.id), plugin: one.plugin, id: one.entry.id, title: one.entry.title ?? one.entry.id, tree: plugins.ui(one.plugin, one.entry.id) }))
      .filter((section) => section.tree.length)
  );

  const send = (plugin: string, id: string, control: string, value: string | number | boolean, live: boolean) => plugins.host.control(plugin, id, control, value, live);
</script>

{#each sections as section (section.plugin + section.id)}
  <section class="plugin" data-plugin={section.plugin} data-section={section.id}>
    <SectionHead title={section.title} open={isOpen(closed, section.key)} ontoggle={() => ontoggle(section.key)} />
    {#if isOpen(closed, section.key)}
      <PluginNodes plugin={section.plugin} id={section.id} tree={section.tree} {palette} onsend={send} />
    {/if}
  </section>
{/each}

<style>
  section.plugin {
    padding: 0 0 8px;
    border-bottom: 1px solid var(--ui-divider);
    font-size: var(--ui-text-sm);
  }

  section.plugin:has(:global(> .head [aria-expanded='false'])) {
    padding: 4px 0;
  }
</style>
