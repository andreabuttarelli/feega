# Il cursore del link shortener clicca dentro il bottone

Prima il cursore di `UiLinkShortener` andava a coordinate fisse (1080 - 140, 300 - 240): la
punta finiva sopra il bordo alto del bottone, e fuori del tutto appena testo del bottone,
etichetta o zoom cambiavano il layout. Nei video di lancio il click cadeva a vuoto.

Ora il bersaglio è letto dal layout del bottone (`offsetLeft/Top/Width/Height`) a ogni frame, e
la posizione dell'elemento cursore compensa la punta della freccia (4,2 nel viewBox 24 → 40 px).
L'arrivo è una molla critica (decelera fino a fermarsi sul bottone), la pressione scala cursore
e bottone insieme. Test: `src/lib/motion/ui-kit/kit.test.ts` verifica la punta dentro il bottone
in ogni frame premuto, con due layout diversi. Scartato: aspettare le spring di #211 (non su main).
