# Il giudice rifiuta solo ciò che viene chiesto

In produzione `alessiopallante.com` (video di lancio da URL) è stato bloccato: Jev non è
configurato (`jev_not_configured`, ogni controllo va al giudice LLM) e il giudice ha rifiutato
`real_person_sexual` "per precauzione", scrivendo lui stesso "No sexual content".

Ora il verdetto porta `requested`: il giudice dice se la richiesta chiede davvero il contenuto
della categoria. `judgeRefuses` rifiuta solo se `requested`, tranne le categorie con
`refuseWhen: RefuseWhen.Suspected` (minori, gore, animali) che restano a tolleranza zero. La regola
sta nella tabella `MODERATION_CATEGORIES`. Il prompt del giudice dice che URL, siti e nomi sono
materiale da leggere. `requested` assente vale `true`: un giudice vecchio o muto non apre varchi.

Scartato: cambiare il punto di controllo. Il messaggio del turno motion guida la generazione, va
screenato; il difetto era il giudice. `eval:moderation` ha tre casi nuovi (23/23, $0.20).
