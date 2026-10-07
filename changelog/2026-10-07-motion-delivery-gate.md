# L'agente motion non consegna con errori del gate aperti

Prima il gate di qualità (`docProblems`/`frameProblems`) restituiva solo testo all'agente: il turno su supasito.com si è chiuso con un frame "mostly white" mai ricontrollato e scene mai riguardate dopo l'ultima modifica.

Ora ogni problema ha una gravità, dichiarata in due tabelle accanto a `Quality` (`QUALITY_SEVERITY`, `STYLE_SEVERITY` in `direction.ts`). Errori: frame vuoti o bianchi, out-of-frame, soft-picture, logo alterato, musica mai suonata, unreadable-text, missing-story-beat. Il resto resta avviso.

`view_frames` salva l'esito in `session.gate`; `turn.ts` chiude solo se i frame sono stati guardati dopo l'ultima modifica e non restano errori. Altrimenti rimanda all'agente la lista degli errori da correggere e ricontrollare, fino a `MAX_DELIVERY_ATTEMPTS` (3). Dopo consegna, e aggiunge alla risposta (stream e turno salvato) la lista di ciò che resta aperto: la frase non dipende dal modello.

Scartato: bloccare senza limite (costo del turno senza tetto) e lasciare l'onestà al solo prompt.
