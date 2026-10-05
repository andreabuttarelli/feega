# Motion: nome delle tracce, animatori con unità diverse, device non ritagliati

Tre mancanze emerse costruendo lo showcase.

- **`add_track` ignorava `name`**: le tracce uscivano «Video 1..4». Lo schema del tool ora lo
  accetta e lo passa ad `addTrack`, che già lo supportava.
- **Animatori di testo con unità diverse.** Prima tutti gli animatori di una clip dovevano avere
  la stessa unità (`apply_text_preset blur-up` per carattere + colore per parola erano
  incompatibili). Ora il testo si divide per l'unità più fine presente; ogni pezzo porta `--p`
  (la sua posizione) e, per le unità più grosse usate, `--pw`/`--pl` (posizione della sua
  parola/riga). Il selettore di ogni animatore legge la variabile della propria unità. Con una
  sola unità l'HTML è identico a prima. Limite: rotazione e scala di un animatore per parola
  applicate a una divisione per carattere ruotano ogni lettera, non la parola intera.
- **Device3D ritagliato dalla sua scatola** quando il dolly cresceva (tastiera, supporto
  tagliati). La tela del device ora è più grande della scatola di metà per lato
  (`DEVICE_OVERSCAN`), centrata, e il FOV si allarga di conseguenza (`wider`) così il device
  resta della stessa misura e posizione. Costo: più pixel da pulire, non da ombreggiare.
