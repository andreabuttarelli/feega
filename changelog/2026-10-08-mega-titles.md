# Titoli di vista in mega type

DESIGN.md vuole il titolo che nomina una vista in mega type minuscolo. Prima ogni pagina
aveva il suo `h1` (20px in gallery e studio, 56px in home, i18n al login) e le pagine tool
(motion, compositions, upscaler) non ne avevano uno visibile: `PageHead` scrive solo nello
store della barra del canvas, che in `/app` nessuno disegna.

- Token `--ui-mega` (+ `-weight`, `-leading`, `-tracking`) in `src/app.css`; sotto 1024px
  passa a `clamp(36px, 10vw, 64px)`.
- `PageTitle.svelte` è l'unico `h1` di vista. Il minuscolo è nel testo
  (`toLocaleLowerCase`), non `text-transform`: screen reader, copia e DOM dicono la stessa
  cosa che si vede, e le traduzioni restano intatte.
- Classe `mega-title`, non `page-title`: `.page-title` esiste già globale in `app.css`.
- `page-title.test.ts` tiene la lista delle viste: nessun `h1` scritto a mano.
- Escluso l'editor composizione (`/app/compose/[nodeId]`): è chrome denso, non una vista.
