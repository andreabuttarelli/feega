<script lang="ts">
  import { enhance } from '$lib/settings/enhance';
  import { RASTER_IMAGE_ACCEPT } from '$lib/raster-image';
  import { Panel } from '$lib/components/ui/panel';
  import { Field } from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Select } from '$lib/components/ui/select';
  import { Button, buttonVariants } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';
  import { FONT_ROLES, LOGO_VARIANTS } from '$lib/brand-kit';

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
        <Input id="new-brand-name" name="name" type="text" placeholder="Acme Coffee" required />
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
        <Input id="brand-name" name="name" type="text" value={data.brand.name} required />
      </Field>
      <Field label="Slug" for="brand-slug">
        <Input id="brand-slug" type="text" value={data.brand.slug} disabled />
      </Field>
      <Field label="Website" for="brand-website">
        <Input id="brand-website" name="website" type="url" inputmode="url" value={data.brand.website ?? ''} placeholder="https://example.com" />
      </Field>
      <Field label="Short description" for="brand-short">
        <Input id="brand-short" name="short_description" type="text" value={data.brand.shortDescription ?? ''} placeholder="One line about the brand" />
      </Field>
      <Field label="Content" for="brand-content">
        <Textarea id="brand-content" name="content" rows={8} placeholder="Anything else worth knowing about the brand" value={data.brand.content ?? ''} />
      </Field>
      <div class="flex justify-end">
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
      </div>
    </form>
  </Panel>

  {#if data.kit}
    {@const kit = data.kit}
    <Panel title="Logo variants" description="Light, dark and mark versions a designer can drag from the Brands panel.">
      <div class="variants">
        {#each LOGO_VARIANTS.filter((v) => v !== 'primary') as variant (variant)}
          {@const logo = kit.logos.find((l) => l.variant === variant)}
          <div class="variant" data-variant={variant}>
            <span class="logo-slot" class:empty={!logo} class:dark={variant === 'light'}>
              {#if logo}<img src={logo.url} alt="" />{:else}—{/if}
            </span>
            <span class="variant-name">{variant}</span>
            <form method="POST" action="?/uploadLogoVariant" enctype="multipart/form-data" use:enhance={withBusy}>
              <input type="hidden" name="variant" value={variant} />
              <label class={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                <input type="file" name="file" accept={RASTER_IMAGE_ACCEPT} hidden onchange={(e) => e.currentTarget.form?.requestSubmit()} />
                Upload
              </label>
            </form>
            {#if logo}
              <form method="POST" action="?/removeLogoVariant" use:enhance={withBusy}>
                <input type="hidden" name="variant" value={variant} />
                <Button variant="ghost" size="sm" type="submit" disabled={busy}>Remove</Button>
              </form>
            {/if}
          </div>
        {/each}
      </div>
    </Panel>

    <Panel title="Palette and voice">
      <form method="POST" action="?/saveKit" use:enhance={withBusy} class="flex flex-col gap-4">
        <Field label="Palette" for="kit-palette" hint="One colour per line: hex, then an optional name. #1A2B3C Ink">
          <Textarea id="kit-palette" name="palette" rows={5} value={kit.fields.palette} placeholder="#1A2B3C Ink" />
        </Field>
        <Field label="Tone" for="kit-tone">
          <Textarea id="kit-tone" name="tone" rows={2} value={kit.fields.tone} placeholder="Warm, short, plain words" />
        </Field>
        <Field label="Do" for="kit-do" hint="One rule per line.">
          <Textarea id="kit-do" name="do" rows={3} value={kit.fields.do} />
        </Field>
        <Field label="Don't" for="kit-dont" hint="One rule per line.">
          <Textarea id="kit-dont" name="dont" rows={3} value={kit.fields.dont} />
        </Field>
        <div class="flex justify-end">
          <Button type="submit" disabled={busy}>Save palette and voice</Button>
        </div>
      </form>
    </Panel>

    <Panel title="Fonts" description="A Google Fonts family, or a font your org uploaded.">
      <form method="POST" action="?/saveFonts" use:enhance={withBusy} class="flex flex-col gap-4">
        {#each FONT_ROLES as role (role)}
          {@const pick = kit.fonts[role]}
          <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label={`${role[0].toUpperCase()}${role.slice(1)}`} for={`font-${role}`} class="flex-1">
              <Input id={`font-${role}`} name={`font_${role}`} type="text" value={pick?.google_family ?? ''} placeholder="Inter" />
            </Field>
            {#if kit.orgFonts.length}
              <Select name={`org_font_${role}`} aria-label={`Uploaded ${role} font`} value={pick?.org_font_id ?? ''}>
                <option value="">Google family</option>
                {#each kit.orgFonts as font (font.id)}
                  <option value={font.id}>{font.family}</option>
                {/each}
              </Select>
            {/if}
          </div>
        {/each}
        <div class="flex justify-end">
          <Button type="submit" disabled={busy}>Save fonts</Button>
        </div>
      </form>
    </Panel>

    <Panel title="Approved assets" description="Images cleared for this brand. They show in the Brands panel Kit tab.">
      {#if kit.assets.length}
        <div class="assets">
          {#each kit.assets as asset (asset.id)}
            <form method="POST" action="?/toggleApproved" use:enhance={withBusy}>
              <input type="hidden" name="assetId" value={asset.id} />
              <input type="hidden" name="approved" value={String(!asset.approved)} />
              <button type="submit" class="asset" class:approved={asset.approved} aria-pressed={asset.approved} aria-label={asset.approved ? 'Remove approval' : 'Approve for this brand'} disabled={busy}>
                {#if asset.thumb}<img src={asset.thumb} alt="" loading="lazy" />{/if}
              </button>
            </form>
          {/each}
        </div>
      {:else}
        <p class="muted">No images in this org yet.</p>
      {/if}
    </Panel>
  {/if}
{/if}

<style>
  .logo-slot {
    width: 64px;
    height: 64px;
    background: var(--ui-input);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex: none;
    border-radius: var(--ui-radius-md);
  }
  .logo-slot.empty {
    color: var(--ui-text-tertiary);
  }
  .logo-slot.dark {
    background: #111;
  }
  .variants {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .variant {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .variant-name {
    min-width: 48px;
    text-transform: capitalize;
  }
  .assets {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    gap: 8px;
  }
  .asset {
    width: 100%;
    aspect-ratio: 1;
    padding: 0;
    border: 2px solid transparent;
    border-radius: var(--ui-radius-md);
    overflow: hidden;
    background: var(--ui-input);
    cursor: pointer;
  }
  .asset.approved {
    border-color: var(--ui-accent);
  }
  .asset img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .muted {
    color: var(--ui-text-secondary);
  }
  .logo-slot img {
    max-width: 80%;
    max-height: 80%;
    object-fit: contain;
  }
</style>
