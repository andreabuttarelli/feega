# Testo libero sulla tela: visibile, nel box disegnato, tipografia nel pannello

Prima, un testo disegnato col tool Text sulla tela vuota restava invisibile o quasi:

- il clip `Text` nasceva col corpo di default (`size` 0.04 del lato corto): su un elemento alto
  100 px significava ~4 px di glifo, un puntino in mezzo al box tratteggiato;
- non si poteva scrivere subito: il focus restava sulla tela, il testo era "Text";
- dopo una modifica il canvas mostrava ancora il poster della revisione 1: `posterAssetId` non
  diceva di quale revisione fosse, e la cattura del tile partiva sull'HTML vecchio
  (`still()` scattava mentre `update()` aspettava il debounce di reload);
- l'inchiostro era `#111111` anche su tela scura.

Ora:

- `drawClip` dà al `Text` una `size` che riempie l'altezza del box (`fittedSize`, leading di
  default del componente) — vale dentro un frame e sulla tela, un modello solo;
- l'editor apre il testo appena disegnato con l'area Content a fuoco e selezionata
  (`freshText` in `motion-node.ts`, `typeInto` nell'inspector); Esc la lascia e salva;
- il poster porta `posterRevision`; il canvas usa il poster solo se è della revisione di testa
  (`posterFresh`; un poster senza revisione, salvato prima, resta valido per non ricatturare
  tutta la tela); `MotionNode` cattura solo con la preview della revisione giusta, e
  `previewDriver.fresh` fa aspettare a `still()` l'HTML corrente;
- il disegno porta `theme` (`light|dark`) e l'inchiostro segue la tela (`CANVAS_INK`);
- `Text` ha `sizing` (`fixed` va a capo nel box, `auto` tiene le righe intere), nella sezione
  Text accanto a font, peso, corpo, tracking, interlinea, allineamento. Limite: in `auto` il box
  dell'elemento non cresce ancora col testo.

Test: `tests/e2e/canvas-free-text.spec.ts` (click e drag, tela chiara e scura, pixel veri, reload;
Size dal pannello).

Dopo #673 (tile ottimistico): il fantasma del disegno in `catalogPosters` contava come poster e
bloccava la cattura, e per un testo era un rettangolo grigio. Ora il fantasma di un testo è il
testo stesso (`ghostText`, inchiostro del tema) e resta solo finché l'elemento è alla prima
revisione (`ghostShown`).
