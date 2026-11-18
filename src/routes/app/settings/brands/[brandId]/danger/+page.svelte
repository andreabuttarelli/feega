<script lang="ts">
  import { _ } from 'svelte-i18n';
  import DeleteBrandDialog from '$lib/components/DeleteBrandDialog.svelte';
  import { Panel } from '$lib/components/ui/panel';
  import { Field, FieldLayout } from '$lib/components/ui/field';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';

  let { data } = $props();
  const brand = $derived(data.brand);
  let deleteOpen = $state(false);
</script>

<Panel title={$_('app.settings.del.title')}>
  {#if !data.isOwner}
    <div><Notice class="mb-0">{$_('app.settings.billing.membersNotice')}</Notice></div>
  {:else}
    <Field label={$_('app.settings.del.heading')} hint={$_('app.settings.del.desc')} layout={FieldLayout.Row}>
      <Button variant="danger" onclick={() => (deleteOpen = true)}>{$_('app.settings.del.cta')}</Button>
    </Field>
  {/if}
</Panel>

{#if data.isOwner && brand}
  <DeleteBrandDialog bind:open={deleteOpen} brand={{ name: brand.name, slug: brand.slug }} action="?/deleteBrand" />
{/if}
