# Interpolazione per keyframe: bezier, lineare, hold, auto-bezier, continua, roving

**Perché.** Ogni keyframe aveva solo `ease` (la curva in uscita). Mancavano hold, il passaggio
morbido fra più chiavi (auto-bezier / continuous) e i keyframe roving di After Effects.

**Cosa.** `Keyframe` prende `in`/`out` (`Interp`) e `roving` (solo x/y/z), tutti opzionali:
un doc vecchio non cambia, perché l'assenza vale `bezier` e usa `ease` come prima — nessuna
migrazione di versione. `sampleTrack` resta autosufficiente (viene serializzato nella
composizione): rifà i tempi delle chiavi roving per distanza percorsa, poi ogni segmento è un
bezier nel piano (tempo, valore) con le maniglie prese dall'ease (lato bezier) o dalla
pendenza (lineare, auto con clamp agli estremi, continua). Il colore accetta solo
bezier/lineare/hold.

**Render.** `keyframeTweens` lascia i tween GSAP com'erano per le tracce semplici; una traccia
con hold/auto/roving si cuoce fotogramma per fotogramma dallo stesso campionatore, così preview,
render su server ed export non possono divergere e il ritiro di GSAP non tocca la logica.

**Agente.** `set_keyframes`/`set_camera_keyframes` prendono `in`/`out`/`roving`;
nuovo `set_key_interpolation`; `get_motion_doc` mostra i campi. **Timeline**: il popover
dell'ease ha i tipi in uscita e in entrata; il glifo del keyframe cambia (hold quadrato,
auto/continuous ottagono, roving tratteggiato). Copia/incolla li conserva.
