# Kit UI generico per i video di lancio

Il kit di #196 aveva solo pezzi di dub (link shortener, funnel, payouts, QR): per un prodotto diverso, come supasito, l'agente non trovava il pezzo giusto e ripiegava sugli screenshot.

Aggiunti dodici primitivi riusabili, stesso formato dei pezzi esistenti (Custom vettoriale, token di brand `font/ink/muted/paper/line/accent/radius`, `zoom`, `speed`): sidebar/app shell, hero di landing, prompt box/form, editor canvas, grid di card, pricing, chat, modale, toggle, upload, risultato generato, cursore da sovrapporre. Ognuno anima i propri stati: ingresso a cascata, testo che si digita, numeri che contano, click con cursore.

`add_ui` li elenca da solo (descrizione costruita da `UI_KIT`); il prompt del regista li nomina prima dei pezzi specifici.

Nuovo test `ui-kit/kit.test.ts`: ogni pezzo, su un DOM finto, disegna lo stesso stato per lo stesso tempo qualunque sia il tempo precedente (seek avanti e indietro) e si muove fra primo e ultimo frame. Scartato jsdom: è solo una dipendenza transitiva, senza tipi.
