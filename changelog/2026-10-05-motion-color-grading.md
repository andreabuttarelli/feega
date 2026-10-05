# Motion editor: color grading (LUT, levels, lift/gamma/gain)

Richiesta: effetto LUT (.cube caricato o preset), levels, lift/gamma/gain, applicabili anche
agli adjustment layer quando arriveranno.

**Dove vive.** Tre nuovi `EffectKind` nel registry degli effetti: nessun componente nuovo, così
un adjustment layer che applica lo stack di effetti ai livelli sotto li eredita senza lavoro.

**Levels e lift/gamma/gain** sono `feComponentTransfer` a tabella (17 punti); ogni parametro è
un parametro d'effetto, quindi keyframabile come gli altri (`fx.<id>.<param>`).

**LUT.** Un filtro SVG non sa fare una 3D LUT, e il render passa da html-to-image e dal producer
sul server: niente WebGL. Il .cube si compila una volta (`effects/lut.ts`): matrice affine 3×4
ai minimi quadrati più tre curve 1D a 17 nodi, che diventano `feColorMatrix` +
`feComponentTransfer`, mescolati con `amount`. Approssimazione: canale-separabile dopo il mix.
Una LUT d'identità torna identità (<1%), un mix di canali con contrasto resta entro 6%; look
che dipendono dalla tonalità (qualifier) non si rendono fedelmente. Il doc salva la LUT
compilata (`effect.lut`, ~70 numeri), non il .cube: un file da 2 MB non entra nel doc.
Preset: teal-orange, warm-film, cool-night, bleach-bypass, sepia.

**Agente.** `set_lut` (preset o testo .cube, amount); levels e lift-gamma-gain da `add_effect`.
Inspector: dentro l'effetto LUT, select dei preset e caricamento .cube.
