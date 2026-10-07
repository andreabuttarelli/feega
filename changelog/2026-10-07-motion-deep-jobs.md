# Motion: job Deep (regista, costruttore, critico) fuori dalla richiesta web

Prima: un turno dell'agente motion stava dentro una richiesta (tetto 300 s), chiudeva dopo 1–2
controlli e moriva con la tab. La qualità di un video nuovo dipendeva da un solo passaggio.

Ora una richiesta di creare un video (`deep/mode.ts`, regole in tabella; la chat veloce resta per
le modifiche piccole, `mode` nel body forza l'una o l'altra) risponde con un preventivo
(`data-motion-deep-quote`); alla conferma (`DeepPanel.svelte` → `POST .../agent/deep`) parte un
job su `node_runs` (`external_job_id` `motion-deep:`):

- `deep/loop.ts`: storyboard → asset → build → render → critica, almeno 2 e al massimo 4 giri,
  chiusura quando la rubrica passa, al tetto di giri o quando il budget non paga un altro giro.
  Checkpoint a ogni fase (params + heartbeat in `claimed_at`); il doc si salva come revisione dopo
  ogni build, quindi un timeout non perde lavoro.
- `deep/agent.ts`: regista e critico a reasoning alto, costruttore medio, sempre sul modello scelto
  dall'utente. Il critico vede i frame di un render vero sul farm (`launchStills`: render whole a
  scala 1, un JPEG ogni 0,25 s; ogni secondo più i due lati di ogni taglio al modello), più i fatti
  misurati: `docProblems`, `frameProblems`, immagini ferme oltre 1 s (`stillSpans`). Il verdetto è
  JSON (`parseVerdict`); un problema misurato fa fallire qualunque voto.
- Durata: le rotte Deep e di ripresa hanno `maxDuration` 1800 s (beta Vercel per Pro, per singola
  funzione, nodejs22.x; oltre 800 s non vale come default di progetto). Il job si mette in pausa
  prima di una fase che non ci sta; il tick (`deep/resume.ts`) riprende i job con heartbeat
  vecchio di 3 minuti chiamando `/api/v1/motion/deep/resume` col CRON_SECRET, al massimo 6 volte.
- Costo: preventivo da `deep/budget.ts` (token stimati per fase × tariffa del gateway, ×4 di
  `CHAT_MULTIPLIER`, più i render), tetto 1,5×. Ogni fase scrive la sua riga in `ai_calls` con
  `threadId` e `agentKey`, quindi l'addebito reale passa dal moltiplicatore esistente.
- Stop: `POST .../agent/deep/stop` mette `stop` nei params; il loop lo legge fra le fasi e il
  costruttore fra i passi.
- Tool nuovi, anche per la chat veloce: `capture_site` (hyperframes capture su una sandbox del farm
  a rete aperta, screenshot 1920×1080 importati come asset) e `generate_music`.

Scartato: frame dal browser quando la tab è aperta (il job non ha un canale verso la pagina; il
render sul farm costa ~45 s e vale sempre); clip video AI dalle foto prodotto con conferma a metà
job (richiede una seconda conferma e la coda video: non fatto).
