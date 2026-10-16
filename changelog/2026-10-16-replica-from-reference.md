# Rifare un video di riferimento: formato, budget, lingua, niente chiacchiere interne

Il test dal vivo di "ricrea questo video" (PR #665) ha dato kinetic D/F/C+ e SaaS F: analisi ricca, build fallita.

- **Formato e durata dal riferimento.** Il breakdown chiede ora `aspectRatio`; `replicaTurn` (`server/motion/replica-turn.ts`) su un turno con video allegato e richiesta di rifarlo porta la tela vuota al formato e alla durata del riferimento (`replicaCanvas`). Prima restava il 9:16 di default.
- **Il video passa come allegato.** `ask_motion_agent`/`create_motion_video` mandavano solo l'id nel testo: il turno motion non vedeva il breakdown. Ora i video in `media` vanno come allegati (`referenceSources`).
- **Build scena per scena.** `REPLICA_BRIEF` (`lib/motion/replica.ts`): tempi delle scene, hex, scala tipografica (enorme condensato quando il riferimento riempie il quadro), transizioni e camera, nessuno spazio vuoto. Il gate blocca già un buco iniziale (`EmptyFrames`): ora c'è il test del caso SaaS (7,5 s di nero).
- **Budget.** `VIDEO_CAPS` in `brand-agent/limits.ts`, una tabella per `VideoKind`: standard $3 per video / $1,50 per turno, replica **$6 / $3**. Il tipo sta su `nodes.data.videoKind` e vale anche per i turni dopo. Una replica salta il director: il breakdown è il piano, il budget va alla build.
- **Lingua.** `REPLY_LANGUAGE_RULE` unica per chat e motion: la lingua del messaggio dell'utente, mai quella dell'allegato o della risposta del motion agent.
- **Chiacchiere interne.** Il prompt della chat dice che ogni testo fuori da un tool è mostrato all'utente: le istruzioni al motion agent vanno solo in `request`. Solo prompt: un filtro deterministico su frasi brevi imperative è stato scartato (troppi falsi positivi).

Lacune note, non costruite: illustrazioni e personaggi (il SaaS ne è pieno), musica non disponibile nello spazio di lavoro.
