# Niente banner dopo il resync della tela

Dopo una riconnessione il resync mostrava "This canvas was updated elsewhere — refreshed.". Il
pallino di connessione (#506) dice già lo stesso: il banner era rumore.

- `VERDICT_NOTICE` in `src/lib/canvas/staleness.ts` è la tabella unica: `Resync` → `null`,
  nessun banner. Canvas/progetto cancellati altrove mantengono il loro messaggio.
- I conflitti di salvataggio dei nodi (`outcome === 'conflict'`) passano da un'altra strada e
  restano invariati.
