# Il gate vede i giri dei device e la UI sui loro schermi

- `noPeak` leggeva solo i keyframe (`objectRotateY`, `dolly`...): un Device3D che gira di 100°
  con `startAngle`/`endAngle` non contava come picco. Ora `PEAK_SPANS` (tabella, accanto a
  `PEAK_TRAVEL`) conta anche lo scarto fra due prop statiche: start/end angle ≥ 90°.
- `cutProblems` scendeva solo nei Precomp: una UI animata dentro uno `screenComp` poteva essere
  tagliata a metà senza che il gate lo dicesse. Ora `NESTED` dice, per componente, quale
  composizione annidata leggere: Precomp → `comp`, Device3D → `screenComp`.

- Anche il controllo del copione (`scriptDrift`) legge il testo sullo schermo di un device, con la
  stessa tabella (`nested.ts`): una riga del copione mostrata su un telefono contava come assente.

Trovati costruendo il video demo Ondrafo.
