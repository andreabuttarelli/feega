# La chat sopravvive al browser in background

Segnalazione: su telefono, mandata una richiesta e passati a un'altra app, la chat mostrava
"The agent didn't answer." e la risposta in corso spariva.

Il server non c'entrava: il turno continuava (in produzione si vedevano risposte salvate minuti
dopo un messaggio rimandato due volte). Il difetto era nel client:

- `ChatSession.#settleAfter` trattava un errore di rete sullo stream come turno fallito: toglieva
  la bolla dell'assistente (testo e tool già arrivati) e mostrava `failure.send`.
- "Retry" rimandava il messaggio mentre il primo turno girava ancora: due turni, doppio costo,
  messaggio utente duplicato nel thread.

Cosa cambia:

- Uno stream interrotto (non uno stop, non un errore HTTP) passa a `reconnecting`: la
  trascrizione resta e si interroga il GET finché il turno lavora. "The agent didn't answer."
  compare solo se il server ha chiuso il turno senza risposta, o se il messaggio non era arrivato.
- Il GET delle due chat risponde `running`: ultimo messaggio dell'utente, più giovane della durata
  massima di un turno (`turnRunning`). Nessuna migration: lo stato si deriva dalle righe. Scartata
  una colonna `status` su `chat_messages` (i deploy non applicano migration).
- `visibilitychange`, `pageshow`, `online` risvegliano subito il polling; un reload a turno in
  corso lo segue.
- `saveTurn` non riscrive lo stesso messaggio utente due volte di fila: il retry non duplica.
- I turni girano sotto `waitUntil` (`runInBackground`): su Vercel la funzione non si congela
  quando il client chiude.
- La bozza del composer sta in `sessionStorage`, per endpoint.

Resta: il testo parziale dell'assistente si salva solo a fine turno; tornando si vedono il
messaggio utente e l'attesa, poi la risposta completa.
