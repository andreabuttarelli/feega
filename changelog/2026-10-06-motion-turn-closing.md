# Il turno motion chiude guardando i frame e con un riepilogo

Prima: il self-check (`view_frames` sui fotogrammi chiave) partiva solo se il turno era sotto
`MOTION_TURN_CAP_USD`, e forzava il tool con `tool_choice`, che i modelli con reasoning attivo
rifiutano. Nel test Dub il turno ha speso $2,06, il self-check è saltato, e la risposta salvata era
la concatenazione delle note di lavoro senza spazio ("adding text.The glow").

Ora `turn.ts` ha tre round, ciascuno con i suoi stop e la sua scelta di tool in una tabella:

- `Edit`: si ferma a budget o `CLOSING_RESERVE_MS` (60 s) prima della scadenza, per lasciare tempo
  alla chiusura;
- `SelfCheck`: ignora il budget, fino a due nudge finché c'è una modifica non guardata; forza
  `view_frames` solo senza reasoning (`selfCheckChoice`, ripreso dalla PR #148);
- `Summary`: un passo con `toolChoice: 'none'` e la richiesta di un riepilogo per l'utente. Salta
  solo se il modello ha già chiuso da sé con un testo e nessun self-check è seguito.

`view_frames` resta limitato a `MAX_VIEWS_PER_TURN`, ma accetta un'occhiata in più quando c'è una
modifica dopo l'ultima: il turno non chiude su un cambiamento mai visto. `finishedTurn` separa con
una riga vuota due step che non portano spazio fra loro.

Scartato: forzare `view_frames` con `tool_choice: required` (stesso rifiuto con il thinking), e un
riepilogo generato da un secondo modello (perde il contesto del turno, che è già in cache).
