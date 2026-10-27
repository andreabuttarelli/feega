<script lang="ts">
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { Panel } from '$lib/components/ui/panel';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';
  import { apiCall, withOrg } from '$lib/api/client';
  import { orgFonts } from '$lib/fonts/org-font-store.svelte';
  import { fontFamilies } from '$lib/motion/fonts/library';

  let { data } = $props();

  const PATH = '/api/v1/org/fonts';
  const ACCEPT = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2';
  const HTTP_OK_MAX = 299;

  let busy = $state(false);
  let error = $state('');

  const families = $derived(fontFamilies(orgFonts.faces));

  onMount(() => void orgFonts.refresh());

  async function upload(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    busy = true;
    const base64 = btoa(Array.from(new Uint8Array(await file.arrayBuffer()), (b) => String.fromCharCode(b)).join(''));
    const answer = await apiCall<{ error?: string }>(withOrg(PATH), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: file.name, base64 }) });
    error = answer.status > HTTP_OK_MAX ? (answer.body.error ?? 'Upload failed') : '';
    await orgFonts.refresh();
    busy = false;
  }

  async function remove(family: string) {
    if (!confirm($_('app.settings.fonts.confirmDelete'))) {
      return;
    }

    const answer = await apiCall<{ error?: string }>(withOrg(PATH, new URLSearchParams({ family })), { method: 'DELETE' });
    error = answer.status > HTTP_OK_MAX ? (answer.body.error ?? 'Delete failed') : '';
    await orgFonts.refresh();
  }
</script>

<svelte:head>{@html `<style>${orgFonts.css}</style>`}</svelte:head>

{#if error}<Notice tone="error">{error}</Notice>{/if}

<Panel title={$_('app.settings.fonts.title')} description={$_('app.settings.fonts.subtitle')}>
  <ul class="m-0 flex list-none flex-col gap-2 p-0" data-testid="org-fonts">
    {#each families as font (font.family)}
      <li class="flex items-center gap-3 rounded-sm border border-border px-3 py-2">
        <div class="min-w-0 flex-1">
          <p class="m-0 text-[0.75rem] text-muted-foreground">{font.family} · {font.variants.length} {$_('app.settings.fonts.styles')}</p>
          <p class="m-0 truncate text-[1.25rem]" style={`font-family: ${JSON.stringify(font.family)}, system-ui`}>{$_('app.settings.fonts.preview')}</p>
        </div>
        {#if data.canEdit}
          <Button size="sm" variant="ghost" aria-label={`${$_('app.settings.fonts.delete')} ${font.family}`} onclick={() => remove(font.family)}>{$_('app.settings.fonts.delete')}</Button>
        {/if}
      </li>
    {:else}
      <li class="text-[0.8125rem] text-muted-foreground">{$_('app.settings.fonts.empty')}</li>
    {/each}
  </ul>

  {#if data.canEdit}
    <label class="mt-4 inline-flex cursor-pointer items-center gap-2 text-[0.8125rem]">
      <input class="sr-only" type="file" accept={ACCEPT} disabled={busy} aria-label={$_('app.settings.fonts.upload')} onchange={(e) => upload(e.currentTarget)} />
      <span class="rounded-sm border border-border px-3 py-1.5">{busy ? $_('app.settings.fonts.uploading') : $_('app.settings.fonts.upload')}</span>
    </label>
    <p class="m-0 mt-2 text-[0.75rem] text-muted-foreground">{$_('app.settings.fonts.hint')}</p>
  {/if}
</Panel>
