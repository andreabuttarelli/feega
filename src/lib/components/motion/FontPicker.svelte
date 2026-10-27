<script lang="ts">
  import { BuiltinFont, fontStack, nearestWeight, searchFonts, type CatalogueFont, type FontFace } from '@feega/motion-core/motion/fonts/model';
  import { FIELD_INPUT } from '$lib/components/ui/shell';
  import { MAX_FONT_MB, type FontLibrary } from '$lib/motion/fonts/library';
  import { FontOrigin, LocalFonts, readLocalFonts, type LocalFontsRead } from '$lib/motion/fonts/local';

  let {
    value,
    fonts,
    brand = [],
    onpick,
    library = null
  }: {
    value: string;
    fonts: FontFace[];
    brand?: string[];
    onpick: (family: string, catalogue: CatalogueFont[], origin: FontOrigin) => void;
    library?: FontLibrary | null;
  } = $props();

  const TRIGGER = 'h-(--ui-row) w-full min-w-0 cursor-pointer truncate px-2.5 text-left text-ui-label transition-colors duration-(--ui-dur-fast)';
  const GROUP = 'm-0 mt-1 text-[10px] uppercase text-ui-text-3';
  const MUTED = 'm-0 text-[11px] text-ui-text-3';
  const TAG = 'ml-1.5 font-mono text-[10px] text-ui-text-3';
  const ROW = 'w-full cursor-pointer truncate rounded-sm px-2 py-1 text-left text-base text-ui-text hover:bg-ui-wash';
  const rowClass = (selected: boolean) => (selected ? `${ROW} bg-ui-selected` : ROW);

  const RESULTS = 40;
  const PREVIEW_LINK = 'motion-font-previews';
  const REGULAR = 400;
  const ACCEPT = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2';

  let open = $state(false);
  let query = $state('');
  let catalogue = $state<CatalogueFont[]>([]);
  let uploading = $state(false);
  let uploadError = $state('');
  let renaming = $state<string | null>(null);
  let installed = $state<LocalFontsRead | null>(null);
  let reading = $state(false);

  const LOCAL_NOTE = {
    [LocalFonts.Unsupported]: 'Installed fonts need Chrome or Edge on desktop.',
    [LocalFonts.Denied]: 'Access to installed fonts was refused. Allow it in the browser site settings to try again.',
    [LocalFonts.Ready]: 'Only on this computer: other computers and server renders show a fallback font.'
  };

  const uploaded = $derived((library?.families ?? []).filter((f) => f.family.toLowerCase().includes(query.trim().toLowerCase())));
  const missing = $derived(library?.missing.includes(value) ?? false);

  const installedMatches = $derived(installed?.state === LocalFonts.Ready ? installed.families.filter((f) => f.toLowerCase().includes(query.trim().toLowerCase())).slice(0, RESULTS) : []);

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

  async function pickInstalled(family: string) {
    if (installed?.state === LocalFonts.Ready) {
      await installed.load(family);
    }
    pick(family, FontOrigin.Local);
  }

  function pick(family: string, origin: FontOrigin = FontOrigin.Catalogue) {
    onpick(family, catalogue, origin);
    open = false;
  }

  async function showInstalled() {
    reading = true;
    installed = await readLocalFonts(window);
    reading = false;
  }

  async function upload(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file || !library) {
      return;
    }
    uploading = true;
    const uploadedFont = await library.upload(file);
    uploading = false;
    uploadError = uploadedFont.ok ? '' : uploadedFont.error;
    if (uploadedFont.ok) {
      pick(uploadedFont.family);
    }
  }

  async function rename(family: string, to: string) {
    if (renaming !== family) {
      return;
    }
    renaming = null;
    if (!library || !to.trim() || to.trim() === family) {
      return;
    }
    uploadError = (await library.rename(family, to.trim())) ?? '';
  }

  async function remove(family: string) {
    if (!library || !confirm(`Delete the uploaded font ${family} for everyone in the workspace? Videos using it fall back to a system font.`)) {
      return;
    }
    uploadError = (await library.remove(family)) ?? '';
  }
</script>

<div class="font-picker relative w-full" data-testid="font-picker">
  <button type="button" class={`${TRIGGER} rounded-sm bg-ui-input text-ui-text hover:bg-ui-input-hover`} style={`font-family: ${fontStack(value, fonts)}`} aria-expanded={open} aria-label={`Font ${value}`} onclick={toggle}>{value}</button>
  {#if missing}<p class="m-0 mt-0.5 text-[11px] text-amber-700 dark:text-amber-400" role="status" data-testid="font-missing">The file of {value} is gone: a fallback font is showing.</p>{/if}
  {#if open}
    <div class="absolute inset-x-0 top-[calc(100%+2px)] z-20 grid max-h-[420px] gap-1 overflow-auto rounded-md bg-ui-raised p-1.5 text-ui-text shadow-ui-float" role="dialog" aria-label="Choose a font">
      <input type="search" class={`${FIELD_INPUT} w-full`} placeholder="Search Google Fonts…" aria-label="Search fonts" bind:value={query} />
      <p class={GROUP}>In this video</p>
      <ul class="m-0 list-none p-0">
        {#each inVideo as family (family)}
          <li><button type="button" class={rowClass(family === value)} aria-current={family === value} style={`font-family: ${fontStack(family, fonts)}`} onclick={() => pick(family)}>{family}</button></li>
        {/each}
      </ul>
      {#if library}
        <p class={GROUP}>Uploaded</p>
        <ul class="m-0 list-none p-0" data-testid="font-uploaded">
          {#each uploaded as font (font.family)}
            <li class="flex gap-0.5">
              {#if renaming === font.family}
                <input class={`${FIELD_INPUT} w-full`} value={font.family} aria-label={`Rename ${font.family}`} {@attach (el) => el.focus()} onkeydown={(e) => (e.key === 'Enter' ? rename(font.family, e.currentTarget.value) : e.key === 'Escape' ? (renaming = null) : null)} onblur={(e) => rename(font.family, e.currentTarget.value)} />
              {:else}
                <button type="button" class={`${rowClass(font.family === value)} flex-1`} aria-current={font.family === value} style={`font-family: '${font.family}', system-ui`} onclick={() => pick(font.family)}>{font.family}<span class={TAG}>{font.variants.length > 1 ? `${font.variants.length} styles` : 'uploaded'}</span></button>
                <button type="button" class="rounded-sm px-1 text-[10px] text-ui-text-3 hover:bg-ui-wash" aria-label={`Rename ${font.family}`} onclick={() => (renaming = font.family)}>Rename</button>
                <button type="button" class="rounded-sm px-1 text-[10px] text-ui-text-3 hover:bg-ui-wash" aria-label={`Delete ${font.family}`} onclick={() => remove(font.family)}>Delete</button>
              {/if}
            </li>
          {:else}
            <li class={MUTED}>{library.families.length ? 'No uploaded font matches.' : 'No uploaded fonts yet.'}</li>
          {/each}
        </ul>
      {/if}
      <p class={GROUP}>Installed on this computer</p>
      {#if installed?.state === LocalFonts.Ready}
        <ul class="m-0 list-none p-0" data-testid="font-installed">
          {#each installedMatches as family (family)}
            <li><button type="button" class={rowClass(family === value)} aria-current={family === value} style={`font-family: '${family}', system-ui`} onclick={() => pickInstalled(family)}>{family}<span class={TAG}>local</span></button></li>
          {:else}
            <li class={MUTED}>No installed font matches.</li>
          {/each}
        </ul>
      {:else if !installed}
        <button type="button" class="rounded-sm px-1 text-left text-[10px] text-ui-text-3 hover:bg-ui-wash" data-testid="font-installed-show" disabled={reading} onclick={showInstalled}>{reading ? 'Reading installed fonts…' : 'Show installed fonts…'}</button>
      {/if}
      {#if installed}<p class={MUTED} data-testid="font-installed-note">{LOCAL_NOTE[installed.state]}</p>{/if}
      <p class={GROUP}>Google Fonts{brand.length ? ' · brand first' : ''}</p>
      <ul class="m-0 list-none p-0" data-testid="font-results">
        {#each results as font (font.f)}
          <li>
            <button type="button" class={rowClass(font.f === value)} aria-current={font.f === value} style={`font-family: '${font.f}', system-ui`} onclick={() => pick(font.f)}>
              {font.f}{#if brandSet.has(font.f)}<span class={TAG}>brand</span>{/if}
            </button>
          </li>
        {:else}
          <li class={MUTED}>{catalogue.length ? 'No font matches.' : 'Loading the catalogue…'}</li>
        {/each}
      </ul>
      {#if library}
        <label class="grid gap-1 text-xs">
          <input type="file" accept={ACCEPT} aria-label="Upload a font file" disabled={uploading} onchange={(e) => upload(e.currentTarget)} />
          {uploading ? 'Uploading…' : 'Upload font…'}
        </label>
        <p class={MUTED}>TTF, OTF, WOFF or WOFF2, up to {MAX_FONT_MB}MB. Everyone in the workspace can use it; upload only fonts your licence allows.</p>
        {#if uploadError}<p class="m-0 text-[11px] text-red-600 dark:text-red-400" role="alert">{uploadError}</p>{/if}
      {/if}
    </div>
  {/if}
</div>
