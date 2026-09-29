<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import { Panel } from '$lib/components/ui/panel';
  import { Field } from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';
  import { Select } from '$lib/components/ui/select';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';

  let { data, form } = $props();

  let confirmName = $state('');
  const canDelete = $derived(confirmName === data.project.name);
  const createHref = $derived(
    `/p/${data.project.id}/brands/new?returnTo=${encodeURIComponent(page.url.pathname)}`
  );
</script>

{#if form?.renamed}<Notice tone="success">Renamed.</Notice>{/if}
{#if form?.error}<Notice tone="error">{form.error}</Notice>{/if}

<Panel title="Name">
  <form method="POST" action="?/rename" use:enhance class="flex gap-2">
    <Input name="name" type="text" value={data.project.name} required aria-label="Project name" class="h-9" />
    <Button variant="secondary" type="submit">Rename</Button>
  </form>
</Panel>

<Panel
  title="Brand"
  description={data.linkedBrand
    ? `Linked to ${data.linkedBrand.name}. Posts, calendar and connected accounts use this brand.`
    : 'No brand linked. The canvas works without one; link a brand when you are ready to publish.'}
>
  {#if data.orgBrands.length}
    <form method="POST" action="?/linkBrand" use:enhance class="flex gap-2">
      <Select name="brandId" required aria-label="Brand">
        <option value="" disabled selected={!data.linkedBrand}>Choose a brand</option>
        {#each data.orgBrands as b (b.id)}
          <option value={b.id} selected={b.id === data.linkedBrand?.id}>{b.name}</option>
        {/each}
      </Select>
      <Button type="submit">{data.linkedBrand ? 'Switch brand' : 'Link brand'}</Button>
    </form>
  {/if}

  <div class="flex flex-wrap items-center gap-2">
    <Button variant="secondary" href={createHref}>Create brand</Button>
    {#if data.linkedBrand}
      <form method="POST" action="?/unlinkBrand" use:enhance>
        <Button variant="ghost" type="submit">Unlink brand</Button>
      </form>
    {/if}
  </div>
</Panel>

<Panel title="Delete project" description="The project and its canvases disappear from your workspace. Brands and posts stay.">
  <form method="POST" action="?/delete" class="flex flex-col items-start gap-3">
    <Field label={`Type ${data.project.name} to confirm`} for="confirm-project-name" class="w-full">
      <Input id="confirm-project-name" name="confirmName" type="text" bind:value={confirmName} autocomplete="off" class="h-9" />
    </Field>
    <Button variant="danger" type="submit" disabled={!canDelete}>Delete project</Button>
  </form>
</Panel>
