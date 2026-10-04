# Motion editor: espressioni

Richiesta cliente: proprietà guidate da un'espressione per frame, come in After Effects.

**Dove vivono.** `clip.expressions: Record<prop, string>` e `camera.expressions`. Nessuna
migrazione: zod mette `{}` ai doc salvati. Solo proprietà numeriche (trasformazione, scena,
maschera, param numerici dei componenti custom e camera); i colori sono rifiutati.

**Linguaggio.** Non è `eval` né un sandbox JS: `expression/language.ts` è un parser e un
interprete propri. Grammatica: numeri, stringhe, `+ - * / % **`, confronti, `&& || !`, ternario,
`const/let`, liste, membri, chiamate. Niente cicli, funzioni, assegnamenti, template, `{}`: non si
possono scrivere. Gli unici nomi sono quelli dati dallo scope; i membri si leggono solo da
oggetti nostri (Math, handle di layer, liste), `constructor/__proto__/prototype` rifiutati.
Limiti deterministici al posto del timeout a orologio: 2000 caratteri, profondità 64, 4000 passi
per frame (wiggle pesa 64). Il risultato deve essere un numero finito, poi è portato nel range
della proprietà.

**Semantica.** `time`/`frame` sono locali al clip (la camera usa il tempo del video), così
`loopOut/loopIn` lavorano sui keyframe nello stesso tempo. `value` è il valore keyframato.
`wiggle` è value noise con hash intero, seme per `clipId.prop` (due layer non tremano uguali) o
passato a mano. `random(seed)` idem. `layer(id | name | index).prop` legge un altro clip allo
stesso frame; i cicli sono rilevati con una pila di visita e tornano come errore.

**Render.** `composeHtml` chiama `bakeExpressions`: ogni corsia con espressione diventa keyframe
lineari per frame, semplificati togliendo i punti collineari (tolleranza = step/100). Preview,
export dal browser e render su server passano tutti da `composeHtml`, quindi vedono lo stesso
HTML e restano deterministici al seek senza codice nuovo nel runtime. Scartato: valutare nel
browser a ogni frame (un secondo interprete da tenere uguale, e un percorso di sicurezza in più).

**UI e agente.** Bottone `=` accanto al diamante in inspector e camera inspector, campo codice,
errore o valore corrente sotto; tag `= prop` sulla barra in timeline. Tool `set_expression`
(clip o `camera: true`, `null` toglie), prompt con esempi (shake, rotazione continua, follow).
