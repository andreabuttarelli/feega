# La risposta della chat si scrive mentre nasce

Dopo #252 un turno lasciato a metà sopravviveva, ma al ritorno si vedeva solo il messaggio e
un'attesa: testo e tool del turno si salvavano a fine turno (`saveTurn`).

- **Migration** `20261008170000_chat_messages_reply_status.sql`: `chat_messages.status`
  (`streaming` | `done` | `failed`, default `done`) e `updated_at`. RLS invariata (la policy
  `org_isolation` copre già l'update). NON applicata dal deploy; tipi allineati a mano.
- **Server** `src/lib/server/repos/chat-reply.ts::openReply`: a inizio turno inserisce la riga
  assistant `streaming`; a ogni step finito la riscrive (testo + tool finora, scritture in coda);
  a fine turno `done`, su errore `failed` con gli step già fatti. La prima chiusura vince.
  Collegata nella chat di progetto (`onStepFinish`/`onFinish`, `failed` dopo `consumeStream`) e
  nel motion agent (`play` → `finishTurn`, `onError`).
- **Prima della migration**: l'insert con `status` torna `PGRST204`/`42703`; lo si impara una
  volta per istanza e si salva a fine turno come prima. Letture con `select('*')`, così
  `loadTurns`/`turnRunning` non rompono senza colonne.
- **`turnRunning`**: in corso = ultima riga utente o `streaming`, toccata da meno di
  `AGENT_MAX_DURATION_S` (una riga `streaming` di un server morto non resta viva per sempre).
- **Client**: `following()` in `chat-session.svelte.ts` mostra la riga `streaming` come risposta
  live invece di aggiungere un placeholder; al `done` la sostituisce la riga finale, stessa
  posizione, nessun duplicato.
- Granularità: per step, non per token. Scartati realtime (`chat_messages` non è in publication)
  e throttling dei delta: lo step è il punto in cui c'è qualcosa da mostrare.
