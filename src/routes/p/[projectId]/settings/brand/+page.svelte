<script lang="ts">
  import { enhance } from '$app/forms';
  import { RASTER_IMAGE_ACCEPT } from '$lib/raster-image';
  import { Panel } from '$lib/components/ui/panel';
  import { Field } from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Select } from '$lib/components/ui/select';
  import { Button, buttonVariants } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';

  let { data, form } = $props();

  let busy = $state(false);

  const withBusy = () => {
    busy = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      busy = false;
    };
  };
</script>

{#if form?.saved}<Notice tone="success">Saved.</Notice>{/if}
{#if form?.error}<Notice tone="error">{form.error}</Notice>{/if}

{#if !data.brand}
  <Panel title="No brand yet" description="This project has no brand attached. Pick one of your org's brands, or create a new one.">
    {#if data.orgBrands.length}
      <form method="POST" action="?/selectBrand" use:enhance={withBusy} class="flex flex-col gap-2 sm:flex-row">
        <Select name="brandId" aria-label="Brand">
          {#each data.orgBrands as brand (brand.id)}
            <option value={brand.id}>{brand.name}</option>
          {/each}
        </Select>
        <Button type="submit" disabled={busy}>Use this brand</Button>
      </form>
    {/if}

    <form method="POST" action="?/createBrand" use:enhance={withBusy} class="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Field label="New brand name" for="new-brand-name" class="flex-1">
        <Input id="new-brand-name" name="name" type="text" placeholder="Acme Coffee" required class="h-9" />
      </Field>
      <Button variant="secondary" type="submit" disabled={busy}>Create brand</Button>
    </form>

    <div>
      <Button variant="link" href={`/p/${data.project.id}/brands/new`}>Create a brand with the wizard</Button>
    </div>
  </Panel>
{:else}
  <Panel title="Brand">
    <div class="flex flex-wrap items-center gap-4">
      <span class="logo-slot" class:empty={!data.brand.logoUrl}>
        {#if data.brand.logoUrl}<img src={data.brand.logoUrl} alt="" />{:else}—{/if}
      </span>
      <form method="POST" action="?/uploadLogo" enctype="multipart/form-data" use:enhance={withBusy}>
        <label class={buttonVariants({ variant: 'secondary', size: 'sm' })}>
          <input
            type="file"
            name="file"
            accept={RASTER_IMAGE_ACCEPT}
            hidden
            onchange={(e) => e.currentTarget.form?.requestSubmit()}
          />
          {busy ? 'Saving…' : 'Upload logo'}
        </label>
      </form>
      {#if data.brand.logoUrl}
        <form method="POST" action="?/removeLogo" use:enhance={withBusy}>
          <Button variant="ghost" size="sm" type="submit" disabled={busy}>Remove</Button>
        </form>
      {/if}
    </div>

    <form method="POST" action="?/update" use:enhance={withBusy} class="flex flex-col gap-4">
      <Field label="Name" for="brand-name">
        <Input id="brand-name" name="name" type="text" value={data.brand.name} required class="h-9" />
      </Field>
      <Field label="Slug" for="brand-slug">
        <Input id="brand-slug" type="text" value={data.brand.slug} disabled class="h-9" />
      </Field>
      <Field label="Website" for="brand-website">
        <Input id="brand-website" name="website" type="url" inputmode="url" value={data.brand.website ?? ''} placeholder="https://example.com" class="h-9" />
      </Field>
      <Field label="Short description" for="brand-short">
        <Input id="brand-short" name="short_description" type="text" value={data.brand.shortDescription ?? ''} placeholder="One line about the brand" class="h-9" />
      </Field>
      <Field label="Content" for="brand-content">
        <Textarea id="brand-content" name="content" rows={8} placeholder="Anything else worth knowing about the brand" value={data.brand.content ?? ''} />
      </Field>
      <div class="flex justify-end">
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
      </div>
    </form>
  </Panel>
{/if}

<style>
  .logo-slot {
    width: 64px;
    height: 64px;
    border: 1px solid var(--line);
    background: var(--paper-2);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex: none;
  }
  .logo-slot.empty {
    color: var(--ink-faint);
  }
  .logo-slot img {
    max-width: 80%;
    max-height: 80%;
    object-fit: contain;
  }
</style>
