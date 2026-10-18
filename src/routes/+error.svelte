<script lang="ts">
  import { HOME_PATH } from '$lib/home-path';
  // L'UNICA pagina d'errore del progetto — e una basta.
  //
  // Perché una sola: per una URL che non matcha nessuna rotta, SvelteKit monta SOLO il layout
  // radice e questo file (`respond_with_error` costruisce un branch di due nodi: 0 = root layout,
  // 1 = root error). Un `src/routes/app/+error.svelte` non verrebbe quindi mai usato per un 404.
  // Gli errori lanciati dentro /app arrivano comunque qui: il 404 "Brand not found" nasce in
  // `app/[brand]/+layout.server.ts`, cioè proprio nel layout che disegna topbar e sidebar —
  // renderlo dentro una shell che non ha caricato niente sarebbe peggio di una pagina intera.
  //
  // La destinazione dipende dalla SESSIONE, non dall'URL: `data.session` viene dal
  // `+layout.server.ts` radice, che `respond_with_error` esegue anche in stato d'errore. Se per
  // qualsiasi motivo non arriva, si va sulla home pubblica — mai un bottone che promette l'app
  // e sbatte sul login.
  import { page } from '$app/state';
  import { _ } from 'svelte-i18n';
  import { errorCopyFor } from '$lib/error-copy';
  import { isSiteHost } from '$lib/site/host';
  import SiteNotFound from '$lib/site/SiteNotFound.svelte';

  const NOT_FOUND = 404;

  const status = $derived(page.status);
  const loggedIn = $derived(Boolean(page.data?.session));
  const href = HOME_PATH;

  // 404 → non c'è; 401/403 → non è tua; tutto il resto → si è rotto da noi.
  // `$page.error.message` non si mostra MAI: è testo interno.
  const copy = $derived(errorCopyFor(status));
  const siteNotFound = $derived(status === NOT_FOUND && isSiteHost(page.url));
</script>

<svelte:head>
  {#if !siteNotFound}
    <title>{$_(copy.title)} · feega</title>
    <meta name="robots" content="noindex" />
  {/if}
</svelte:head>

{#if siteNotFound}
<SiteNotFound />
{:else}

<main class="err-page">
  <!-- Classi prefissate `err-`: app.css ha già `.card`, `.body` & co. come classi globali,
       e Svelte scopa le PROPRIE regole ma non impedisce a quelle globali di applicarsi. -->
  <div class="err-card">
    <p class="err-code">{status}</p>
    <h1>{$_(copy.title)}</h1>
    <p class="err-body">{$_(copy.body)}</p>
    <div class="err-acts">
      <a class="btn btn-primary" {href}>{loggedIn ? $_('error.toApp') : $_('error.toHome')}</a>
      {#if status >= 500}
        <button class="btn btn-ghost" onclick={() => location.reload()}>{$_('error.retry')}</button>
      {/if}
    </div>
  </div>
</main>
{/if}

<style>
  .err-page {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 40px 16px;
    background: var(--ui-panel);
    color: var(--ui-text);
    font-family: var(--sans);
  }
  .err-card {
    width: 100%;
    max-width: 520px;
    text-align: center;
  }
  .err-code {
    font-family: var(--ui-mono);
    font-size: var(--ui-type-caption);
    letter-spacing: 0.08em;
    color: var(--ui-text-tertiary);
    margin-bottom: var(--ui-space-3);
  }
  h1 {
    font-size: var(--ui-mega);
    font-weight: var(--ui-mega-weight);
    line-height: var(--ui-mega-leading);
    letter-spacing: var(--ui-mega-tracking);
    text-transform: lowercase;
    text-wrap: balance;
  }
  .err-body {
    margin: var(--ui-space-4) auto 0;
    max-width: 36ch;
    font-size: var(--ui-type-body);
    line-height: var(--ui-leading);
    color: var(--ui-text-secondary);
    text-wrap: pretty;
  }
  .err-acts {
    margin-top: var(--ui-space-6);
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-2);
    justify-content: center;
  }
  .err-acts .btn {
    display: inline-flex;
    align-items: center;
    height: var(--ui-row-lg);
    padding: 0 var(--ui-space-3);
    border: 0;
    border-radius: var(--ui-radius-sm);
    font: inherit;
    font-size: var(--ui-type-body);
    font-weight: var(--ui-weight-medium);
    text-decoration: none;
    cursor: pointer;
    transition: background var(--ui-dur-fast) var(--ui-ease);
  }
  .err-acts .btn:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }
  .err-acts .btn-primary {
    background: var(--ui-accent-solid);
    color: var(--ui-on-accent);
    border-radius: var(--ui-radius-sm);
  }
  .err-acts .btn-ghost {
    background: var(--ui-input);
    color: var(--ui-text);
    border-radius: var(--ui-radius-sm);
  }
  .err-acts .btn-ghost:hover {
    background: var(--ui-input-hover);
  }
  @media (pointer: coarse) {
    .err-acts .btn {
      height: 44px;
    }
  }
</style>
