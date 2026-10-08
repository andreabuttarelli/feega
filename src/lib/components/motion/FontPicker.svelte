<script lang="ts">
  import { BuiltinFont, fontStack, nearestWeight, searchFonts, type CatalogueFont, type FontFace } from '$lib/motion/fonts/model';

  let {
    value,
    fonts,
    brand = [],
    onpick,
    onupload
  }: {
    value: string;
    fonts: FontFace[];
    brand?: string[];
    onpick: (family: string, catalogue: CatalogueFont[]) => void;
    onupload?: (file: File) => Promise<string | null>;
  } = $props();

  const RESULTS = 40;
  const PREVIEW_LINK = 'motion-font-previews';
  const REGULAR = 400;
  const ACCEPT = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2';

  let open = $state(false);
  let query = $state('');
  let catalogue = $state<CatalogueFont[]>([]);
  let uploading = $state(false);
  let uploadError = $state('');

  const results = $derived(searchFonts(catalogue, query, brand, RESULTS));
  const brandSet = $derived(new Set(brand));
  const inVideo = $derived([...Object.values(BuiltinFont), ...fonts.map((f) => f.family)]);

  async function toggle() {
    open = !open;
    if (open && !catalogue.length) {
      catalogue = (await import('$lib/motion/fonts/catalogue')).GOOGLE_FONTS;
    }
  }

  function previewHref(list: CatalogueFont[]): string | null {
    if (!list.length) {
      return null;
    }
    const families = list.map((f) => `family=${encodeURIComponent(f.f).replace(/%20/g, '+')}:wght@${nearestWeight(REGULAR, f.w)}`).join('&');
    const glyphs = [...new Set(list.map((f) => f.f).join(''))].join('');
    return `https://fonts.googleapis.com/css2?${families}&text=${encodeURIComponent(glyphs)}&display=swap`;
  }

  $effect(() => {
    const href = previewHref(results);
    if (!open || !href || typeof document === 'undefined') {
      return;
    }
    const link = (document.getElementById(PREVIEW_LINK) as HTMLLinkElement | null) ?? Object.assign(document.createElement('link'), { id: PREVIEW_LINK, rel: 'stylesheet' });
    link.href = href;
    document.head.appendChild(link);
  });

  function pick(family: string) {
    onpick(family, catalogue);
    open = false;
  }

  async function upload(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file || !onupload) {
      return;
    }
    uploading = true;
    uploadError = (await onupload(file)) ?? '';
    uploading = false;
    if (!uploadError) {
      open = false;
    }
  }
</script>

<div class="font-picker" data-testid="font-picker">
  <button type="button" class="current" style={`font-family: ${fontStack(value, fonts)}`} aria-expanded={open} aria-label={`Font ${value}`} onclick={toggle}>{value}</button>
  {#if open}
    <div class="panel" role="dialog" aria-label="Choose a font">
      <input type="search" placeholder="Search Google Fonts…" aria-label="Search fonts" bind:value={query} />
      <p class="group">In this video</p>
      <ul>
        {#each inVideo as family (family)}
          <li><button type="button" class:on={family === value} style={`font-family: ${fontStack(family, fonts)}`} onclick={() => pick(family)}>{family}</button></li>
        {/each}
      </ul>
      <p class="group">Google Fonts{brand.length ? ' · brand first' : ''}</p>
      <ul class="results" data-testid="font-results">
        {#each results as font (font.f)}
          <li>
            <button type="button" class:on={font.f === value} style={`font-family: '${font.f}', system-ui`} onclick={() => pick(font.f)}>
              {font.f}{#if brandSet.has(font.f)}<span class="tag">brand</span>{/if}
            </button>
          </li>
        {:else}
          <li class="muted">{catalogue.length ? 'No font matches.' : 'Loading the catalogue…'}</li>
        {/each}
      </ul>
      {#if onupload}
        <label class="upload">
          <input type="file" accept={ACCEPT} aria-label="Upload a font file" disabled={uploading} onchange={(e) => upload(e.currentTarget)} />
          {uploading ? 'Uploading…' : 'Upload a font (TTF, OTF, WOFF2)'}
        </label>
        <p class="muted">Upload only fonts your licence lets you use in videos.</p>
        {#if uploadError}<p class="error" role="alert">{uploadError}</p>{/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .font-picker {
    position: relative;
    width: 100%;
  }

  .current {
    width: 100%;
    text-align: left;
    padding: 4px 6px;
    border: 1px solid var(--border, #ddd);
    background: var(--ui-field);
    font-size: 14px;
  }

  .panel {
    position: absolute;
    z-index: 20;
    left: 0;
    right: 0;
    top: calc(100% + 2px);
    background: var(--background, #fff);
    border: 1px solid var(--border, #ddd);
    padding: 6px;
    display: grid;
    gap: 4px;
    max-height: 420px;
    overflow: auto;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li button {
    width: 100%;
    text-align: left;
    padding: 3px 4px;
    font-size: 16px;
  }

  li button.on {
    background: #a855f7;
    color: #fff;
  }

  .group {
    margin: 4px 0 0;
    font-size: 10px;
    text-transform: uppercase;
    color: var(--muted-foreground, #888);
  }

  .tag {
    margin-left: 6px;
    font-size: 10px;
    color: #a855f7;
    font-family: 'Fragment Mono', monospace;
  }

  .muted {
    font-size: 11px;
    color: var(--muted-foreground, #888);
    margin: 0;
  }

  .upload {
    font-size: 12px;
    display: grid;
    gap: 4px;
  }

  .error {
    color: #e11d48;
    font-size: 11px;
    margin: 0;
  }
</style>
