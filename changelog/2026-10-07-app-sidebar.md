# Sidebar fissa in /app, dashboard senza bordi, dark su #000

**Prima:** `/app` aveva un header (`AppHeader`) con il `CanvasMenu` ad hamburger; i tool si
raggiungevano solo dalle card della dashboard. La dashboard separava tutto con bordi da 1px.

**Ora:**
- `src/lib/app-nav.ts` è la tabella delle voci della sidebar: sezione, tipo (link, legal, theme,
  logout), bisogno di un progetto, caricamento pieno, badge, metadato crediti. I tool vengono da
  `TOOLS`. Nessuna voce del vecchio menu in `/app` è persa (settings, billing, changelog, report,
  legal, theme, sign out); le scorciatoie tastiera erano già nascoste in modalità pagina.
- `AppSidebar.svelte` la disegna: fissa a 220px da 1024px in su, in un drawer (`Sheet`, bits-ui:
  focus trap, Esc) sotto. Cambio workspace e utente stanno in fondo.
- `AppHeader.svelte` è rimosso: nessuna rotta in `/app` impostava `pageMeta`.
- Dashboard: superfici al posto dei bordi, card con anteprima 16:10 ed etichetta piccola, `h1`.
- Token dark: `--ui-bg` #000, `--ui-surface` #0a0a0a, `--ui-hover` #161616, linee
  #1a1a1a/#2a2a2a, `--ui-ink-3` alzato a #77776f per il contrasto sul nero.

**Scartato:** riusare `CanvasMenu` nella sidebar (è un dropdown, non una lista); sidebar
comprimibile a icone su desktop (non richiesta).

Test: `src/lib/app-nav.test.ts`, `src/lib/components/app/app-sidebar-render.test.ts`,
`tests/e2e/app-sidebar.spec.ts` (`E2E_REAL_STACK=1`).
