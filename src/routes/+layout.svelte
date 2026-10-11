<script lang="ts">
  import { ThemePref, applyTheme, parseThemePref, resolvedTheme } from '$lib/theme';
  import '../app.css';
  import { page } from '$app/stores';
  import { navigating } from '$app/state';
  import CookieBanner from '$lib/components/CookieBanner.svelte';
  import TermsUpdateNotice from '$lib/components/TermsUpdateNotice.svelte';
  import HowFeegaWorks from '$lib/components/onboarding/HowFeegaWorks.svelte';
  import { TourState, tourShowsOn } from '$lib/onboarding/tour';
  import AppEntryShimmer from '$lib/components/AppEntryShimmer.svelte';
  import CanvasEntryShimmer from '$lib/components/CanvasEntryShimmer.svelte';
  import {
    identifyUser,
    setAnalyticsOptOut,
    setInternalViewer,
    trackBookingClicks
  } from '$lib/analytics';
  import { initConsent } from '$lib/consent';
  import { onMount } from 'svelte';
  let { children, data } = $props();

  onMount(() => document.documentElement.removeAttribute('data-hydrating'));

  // Guard "chi sta guardando": il server ha già deciso (root +layout.server.ts), qui arriva solo il
  // booleano. Impostato SUBITO, fuori da un $effect: CookieBanner è un figlio e il suo onMount gira
  // prima degli effect di questo layout — se aspettassimo, PostHog sarebbe già stato schedulato.
  // L'effect serve solo a seguire il cambio di sessione (login/logout) durante la navigazione.
  setAnalyticsOptOut(data?.analyticsOptOut === true);
  $effect(() => {
    setAnalyticsOptOut(data?.analyticsOptOut === true);
  });

  // Stesso guard per Sentry: i giri di prova del founder in produzione non devono diventare
  // sessioni, transazioni o replay veri. Sentry è già partito quando arriviamo qui (hooks.client),
  // quindi il flag non impedisce l'init: scarta gli eventi in beforeSend* e impedisce che la
  // registrazione della sessione venga mai agganciata (che arriva alla prima interazione o dopo
  // 8–10s, quindi molto dopo questa riga). L'effect segue login/logout senza ricaricare la pagina.
  setInternalViewer(data?.internalViewer === true);
  $effect(() => {
    setInternalViewer(data?.internalViewer === true);
  });

  function appNavScope(pathname: string): string | null {
    const m = pathname.match(/^\/p\/([^/]+)/);
    return m ? `project:${m[1]}` : null;
  }

  // Optimistic entry into the app: show the destination shell immediately while loads /
  // redirect chains (/app → /p/<projectId>) finish. Same-project navigations skip it.
  const showAppEntry = $derived.by(() => {
    const to = navigating.to?.url.pathname;
    if (!to) return false;
    const from = navigating.from?.url.pathname ?? $page.url.pathname;
    if (to.startsWith('/p/') || to === '/app' || to.startsWith('/app/')) {
      const fromScope = appNavScope(from);
      const toScope = appNavScope(to);
      if (fromScope && toScope && fromScope === toScope) return false;
      return true;
    }
    // Logged-in Start → /login always bounces to the home project; cover that hop too.
    if ((to === '/login' || to.startsWith('/login/')) && data?.session) return true;
    return false;
  });

  const showCanvasEntry = $derived(showAppEntry && (navigating.to?.url.pathname ?? '').startsWith('/p/'));

  // Global navigation feedback: without it, any server-load wait reads as "the click did
  // nothing". Shown only when a navigation outlives 150ms so instant navs never flash a bar.
  // Suppressed while the full app-entry shell is up (avoids double chrome).
  let navBar = $state(false);
  $effect(() => {
    if (!navigating.to || showAppEntry) { navBar = false; return; }
    const t = setTimeout(() => (navBar = true), 150);
    return () => { clearTimeout(t); navBar = false; };
  });

  // Public brand blogs (custom domain / default path / preview) are served on the BRAND's turf —
  // never load feega's cookie banner or its (PostHog) analytics there. CookieBanner is what starts
  // anonymous analytics, so suppressing it keeps the brand's blog tracking-free by default.
  const isBlog = $derived(
    !!$page.route.id && (
      $page.route.id.startsWith('/_site') ||
      $page.route.id.startsWith('/blog/[site]') ||
      $page.route.id.startsWith('/blog-preview')
    )
  );

  // Stitch the anonymous session to the logged-in user so product events (onboarding, etc.) form a
  // per-user funnel. First-party, authenticated use only. Re-runs if the session changes client-side.
  $effect(() => {
    const user = data?.session?.user as { id?: string; email?: string } | undefined;
    if (user?.id) identifyUser(user.id, user.email ? { email: user.email } : undefined);
  });

  $effect(() => {
    if (!isBlog) {
      trackBookingClicks();
    }
  });

  $effect(() => {
    if (!isBlog) {
      initConsent();
    }
  });

  $effect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const resolve = () => {
      const pref = parseThemePref(root.getAttribute('data-theme-pref'));
      if (pref !== ThemePref.System) return applyTheme(pref);
      const saved = localStorage.getItem('theme');
      root.setAttribute('data-theme', saved === 'light' || saved === 'dark' ? saved : resolvedTheme(ThemePref.System, media.matches));
    };
    resolve();
    function onStorage(e: StorageEvent) { if (e.key === 'theme') resolve(); }
    window.addEventListener('storage', onStorage);
    media.addEventListener('change', resolve);
    return () => {
      window.removeEventListener('storage', onStorage);
      media.removeEventListener('change', resolve);
    };
  });

  // Web MCP: espone al browser gli stessi strumenti che il server MCP espone a un client esterno,
  // generati dal registry. Un agente che gira nella pagina lavora sul brand aperto con la sessione
  // di chi sta guardando — nessuna chiave API, nessun nostro server nel mezzo.
  //
  // Il rilevamento sta QUI e non nel modulo: senza `document.modelContext` — cioè in ogni browser
  // che non abbia l'origin trial acceso o un polyfill montato — l'import non parte, e né zod né i
  // descrittori entrano nel bundle. Costo zero finché la specifica non c'è.
  //
  // Il segnale toglie tutto: cambiando brand si abortisce il precedente, o un agente vedrebbe gli
  // strumenti di due brand con lo stesso nome.
  $effect(() => {
    const scope = appNavScope($page.url.pathname);
    const token = (data?.session as { access_token?: string } | undefined)?.access_token;
    if (!scope?.startsWith('brand:') || !token) return;
    if (typeof document === 'undefined' || !('modelContext' in document)) return;

    const brand = scope.slice('brand:'.length);

    const abort = new AbortController();
    import('$lib/webmcp')
      .then(({ registerBrandWebMcp }) => registerBrandWebMcp(brand, token, data.socialPublishing, abort.signal))
      .catch((error) => console.warn('web mcp registration failed', error));
    return () => abort.abort();
  });

  // Mark the app shell so marketing CSS (e.g. landing.css `section { padding: 110px }`)
  // does not leak onto /app routes after SPA navigation. Also mark while the optimistic
  // app-entry overlay is up (URL still points at marketing during the load).
  $effect(() => {
    if (typeof document === 'undefined') return;
    const path = $page.url.pathname;
    const isApp = showAppEntry || path.startsWith('/app') || path.startsWith('/p/');
    if (isApp) document.documentElement.setAttribute('data-shell', 'app');
    else document.documentElement.removeAttribute('data-shell');
  });
</script>

{#if navBar}
  <div class="nav-progress" aria-hidden="true"></div>
{/if}

{#if showCanvasEntry}
  <CanvasEntryShimmer />
{:else if showAppEntry}
  <AppEntryShimmer />
{/if}

{@render children()}
{#if !isBlog}<CookieBanner />{/if}
{#if !isBlog && data?.session}<TermsUpdateNotice version={data.termsNoticeVersion ?? null} />{/if}
{#if data?.session && tourShowsOn($page.url.pathname)}<HowFeegaWorks tour={data.tour ?? TourState.Seen} />{/if}

<style>
  /* Indeterminate top progress bar: sprints to ~80% then crawls, so long loads still feel alive.
     Uses the theme accent when defined, falls back to a neutral that works in both themes. */
  .nav-progress {
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    width: 100%;
    z-index: 9999;
    pointer-events: none;
    background: var(--accent, #6366f1);
    transform-origin: left;
    animation: nav-progress-grow 8s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
  }
  /* Thicker on mobile so a tap → wait is obvious under a thumb. */
  @media (max-width: 1023px) {
    .nav-progress {
      height: 4px;
    }
  }
  @keyframes nav-progress-grow {
    0% { transform: scaleX(0); }
    10% { transform: scaleX(0.4); }
    30% { transform: scaleX(0.8); }
    100% { transform: scaleX(0.98); }
  }
</style>
