# Editor motion: gli edit dell'agente arrivano dal vivo, e view_frames non si blocca più

Tre difetti nello stesso flusso (turno agente → editor):

- **Edit invisibili fino a fine turno.** Il draft (#255) si aggiornava solo con una richiesta di
  frame. Ora `turn.ts` scrive `data-motion-doc` `{ edit, doc }` dopo ogni tool-result che ha
  applicato un edit; `agentDraft` lo adotta solo se `edit` è più alto (monotono). `doc` della
  pagina deriva dal draft: preview, timeline e inspector lo mostrano.
- **Ritorno al video vuoto/originale.** Uno stream tagliato (tab in background) faceva scattare
  `onTurnEnd` mentre il turno girava ancora: `pullHead` non trovava niente e il draft veniva
  buttato. Ora `onTurnEnd` parte solo a turno finito. A fine turno `landTurn`: head più nuovo →
  si mostra; nessun head → il draft resta e l'editor lo salva. Un salvataggio dell'agente in
  conflitto si riprova sull'head corrente (la revisione dell'utente resta nella storia) invece
  di perdersi. Durante il turno `pullExternalEdit` tace: decide `pullAgentEdit`.
- **view_frames muto dopo i primi.** `previewDriver.loaded` aspettava `ready` senza scadenza: un
  documento che non diventava pronto teneva la coda `exclusive` per sempre, e ogni cattura
  successiva del turno restava senza risposta. Ora scade come `shoot`.
- Lo stato vuoto sulla preview sparisce appena parte un turno (`showsStart`).

Scartato: una revisione ogni N edit. Ogni salvataggio intermedio alza la versione e manda in
conflitto l'autosave dell'utente; un reload a metà turno segue il turno (#256) e riceve l'head
alla fine.
