# Cron in dev solo su richiesta

**Perché.** `devCrons` girava a ogni `vite dev`: un dev server col `.env` sul DB remoto eseguiva il
tick dei run di produzione con il proprio codice (anche vecchio) e chiudeva per errore render
altrui. Visto dal vivo in un giro di verifica di #164 (`render reconcile failed` nel log).

**Cosa.** `DEV_CRONS=1` (o `true`) le accende; senza, il plugin non si applica. `cronMode` in
`scripts/dev-crons.ts`, test in `scripts/dev-crons.test.ts`, lezione in LESSONS.md.

**Scartato.** Accenderle solo con un DB locale riconosciuto dall'URL: fragile, e un DB usa e getta
remoto è un caso legittimo. Meglio un interruttore esplicito.
