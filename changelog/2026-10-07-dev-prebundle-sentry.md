# Il primo avvio in dev non ricarica più la pagina a metà login

**Prima.** Al primo `vite dev` (cache di ottimizzazione vuota) Vite scopriva tardi
`@sentry/sveltekit`, importato in modo dinamico da `hooks.client.ts`, e ricaricava la pagina.
Se il reload cadeva durante il login, la pagina caricava due copie del runtime Svelte e la
console mostrava `effect_orphan` in `+layout.svelte` (prova supasito, 13:29:38).

**Ora.** `optimizeDeps.include` lo preottimizza all'avvio: nessuna ricarica, nessun errore.
Il test `scripts/dev-prebundle.test.ts` tiene allineati i pacchetti importati in ritardo dal
client e la lista. Solo dev: in produzione non cambia niente, quindi niente changelog pubblico.
