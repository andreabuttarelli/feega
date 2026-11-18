<script lang="ts">
  import { goto } from '$app/navigation';
  import { postApi } from '$lib/dashboard/api';
  import { BRANDS_SETTINGS_API } from '$lib/settings/sections';
  import { brandSettingsHref } from '$lib/components/settings/platforms';
  import { Panel } from '$lib/components/ui/panel';
  import { Field } from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';
  import { EmptyState } from '$lib/components/ui/empty-state';

  let { data } = $props();

  const FIRST_SECTION = 'brand';

  let busy = $state(false);
  let failure = $state<string | null>(null);

  async function create(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    failure = null;

    const result = await postApi(BRANDS_SETTINGS_API, 'createBrand', new FormData(event.currentTarget as HTMLFormElement));
    busy = false;

    if (result.type === 'redirect') {
      await goto(result.location, { invalidateAll: true });
      return;
    }
    failure = result.type === 'failure' ? String(result.data?.error ?? 'Could not create the brand') : 'Could not create the brand';
  }
</script>

{#if failure}<Notice tone="error">{failure}</Notice>{/if}

<Panel title="New brand" description="A brand holds the kit, products and video settings that every project using it shares.">
  <form method="POST" onsubmit={create} class="flex flex-col gap-2 sm:flex-row sm:items-end">
    <Field label="Brand name" for="new-brand-name" class="flex-1">
      <Input id="new-brand-name" name="name" type="text" placeholder="Acme Coffee" required />
    </Field>
    <Button type="submit" disabled={busy}>Create brand</Button>
  </form>
</Panel>

<Panel title={`Brands (${data.brands.length})`}>
  {#if data.brands.length}
    <ul class="brands">
      {#each data.brands as brand (brand.id)}
        <li>
          <a class="brand-row" href={brandSettingsHref(brand.id, FIRST_SECTION)}>
            <span class="logo" class:empty={!brand.logoUrl}>
              {#if brand.logoUrl}<img src={brand.logoUrl} alt="" />{:else}{brand.name.slice(0, 1)}{/if}
            </span>
            <span class="name">{brand.name}</span>
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <EmptyState title="No brands yet" description="Create one above, then link it to a project from the project settings." />
  {/if}
</Panel>

<style>
  .brands {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .brand-row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: var(--touch-target);
    padding: 4px 8px;
    border-radius: var(--ui-radius-sm);
    color: var(--ui-text);
    text-decoration: none;
  }

  .brand-row:hover {
    background: var(--ui-wash);
  }

  .brand-row:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  .logo {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    flex: none;
    overflow: hidden;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    font-weight: var(--ui-weight-semibold);
    color: var(--ui-text-tertiary);
  }

  .logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
