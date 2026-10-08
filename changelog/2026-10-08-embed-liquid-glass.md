# Embed: `<feega-liquid-glass>`

Il liquid glass dell'header, servito da feega come web component (`static/embed/liquid-glass.js`):
un sito lo usa con un `<script>` e un tag, invece di copiare shader e JS. Un aggiornamento qui
arriva a ogni sito che lo incorpora.

Il testo resta HTML vero dentro il tag (SEO, accessibilità, fallback senza WebGL); la tela lo
ridisegna sotto il vetro. Attributi `size` e `power`, colori e font con `--lg-ink`, `--lg-bg`,
`--lg-font`. Scartato lo snippet esportato: ogni copia sarebbe rimasta indietro.
