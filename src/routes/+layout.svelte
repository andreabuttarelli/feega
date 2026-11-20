<script lang="ts">
  import { ThemePref, applyTheme, parseThemePref, resolvedTheme } from '$lib/theme';
  import '../app.css';
  import { page } from '$app/stores';
  import CookieBanner from '$lib/components/CookieBanner.svelte';
  import { identifyUser, setAnalyticsOptOut, setInternalViewer, trackBookingClicks } from '$lib/analytics';
  import { initConsent } from '$lib/consent';
  import { onMount } from 'svelte';

  let { children, data } = $props();

  onMount(() => document.documentElement.removeAttribute('data-hydrating'));

  setAnalyticsOptOut(data?.analyticsOptOut === true);
  $effect(() => {
    setAnalyticsOptOut(data?.analyticsOptOut === true);
  });

  setInternalViewer(data?.internalViewer === true);
  $effect(() => {
    setInternalViewer(data?.internalViewer === true);
  });

  $effect(() => {
    const user = data?.session?.user as { id?: string; email?: string } | undefined;
    if (user?.id) identifyUser(user.id, user.email ? { email: user.email } : undefined, null);
  });

  $effect(() => {
    trackBookingClicks();
  });

  $effect(() => {
    initConsent();
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

  $effect(() => {
    if (typeof document === 'undefined') return;
    if ($page.url.pathname.startsWith('/app')) document.documentElement.setAttribute('data-shell', 'app');
    else document.documentElement.removeAttribute('data-shell');
  });
</script>

{@render children()}
<CookieBanner />
