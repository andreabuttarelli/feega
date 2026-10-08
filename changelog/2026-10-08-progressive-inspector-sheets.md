# Inspector a riassunti, fogli con detent

Ticket T6 di `touch-editor/SPEC.md`, senza l'export: il dialog di export è riprogettato da un
altro lavoro in parallelo e qui non si tocca.

- Inspector: per default è aperta solo la prima sezione (Content; 3D resta aperta sui livelli
  3D). Ogni sezione chiusa mostra nella testata un riassunto di una riga (`sectionSummary`, una
  tabella per sezione: "Scale 150% · Rotate 10°", "At 1s · 2s long", "1 animated"…). Prima erano
  aperte cinque sezioni: un muro da scorrere su telefono.
- Fogli su telefono (Properties, Agent): tre detent, peek / half / full (`sheet-detents.ts`).
  Half finisce sotto la preview, che resta visibile; il grabber si trascina (atterra sul detent
  più vicino) o si tocca (passa al successivo). Prima: 62vh fissi sopra la preview.
- Quando l'agente modifica il video, il foglio della chat scende a peek per mostrare il cambio.
- Camera/Look comparivano già solo senza selezione: invariato.

Corretto anche il tipo di `pickMode` (T3): `$state(PickMode.One)` restringeva il tipo al solo
valore iniziale e svelte-check segnalava il confronto con `Many`.

Scartato: tastiera numerica/fine-coarse del NumberField e composer sopra la tastiera
(`visualViewport`), rimandati.
