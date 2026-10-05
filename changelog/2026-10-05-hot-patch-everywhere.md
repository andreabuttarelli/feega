# Patch a caldo della preview per ogni tipo di clip

**Prima:** `composeHtml` spegneva la patch a caldo (#131) appena la pagina conteneva 3D,
Composition, camera, particelle o componenti custom: ogni modifica ricaricava l'iframe
(debounce 250 ms + caricamento completo).

**Ora:** la patch vale sempre.

- `HotPatch` porta anche `modules`: gli script `type="module"` (three.js, Composition, custom con
  THREE) vengono rieseguiti in ordine dopo quelli classici. Chromium non emette `load` per un
  modulo inline, quindi ogni modulo segnala la fine con un evento; timeout di 3 s come rete.
- `hotScope(key)`: ogni script rieseguito smonta la corsa precedente (listener `hf-seek`, scene).
  Prima shapes e particelle accumulavano un listener per patch.
- three.js e Composition riusano canvas e `WebGLRenderer` per id di clip (stessa dimensione),
  liberano geometrie, materiali e texture della scena vecchia, rilasciano i renderer di clip
  sparite (`forceContextLoss`). Il font del Text3D è in cache per URL.
- Il `world` della camera e lo stile `perspective` stanno dentro la regione patchata.
- Custom: `bootCustom` rimpiazza il listener `error` e azzera l'elenco errori a ogni boot.

**Misura** (Chromium headless, SwiftShader, CDN in cache; reload = caricamento pagina senza il
debounce di 250 ms né l'iframe del player, quindi sottostimato):

| clip | reload | patch |
|---|---|---|
| Text3D | 689 ms | 474 ms |
| Shape3D | 419 ms | 507 ms |
| Particelle | 236 ms | 13 ms |
| Composition | 309 ms | 16 ms |
| Custom | 359 ms | 14 ms |
| Camera | 360 ms | 15 ms |

Per il 3D il tempo è dominato dalla ricompilazione degli shader (scena nuova, stesso renderer):
niente reload né flash, ma non istantaneo. In ogni caso la patch dà 0 pixel diversi rispetto al
caricamento a freddo dello stesso documento, e dopo 10 patch i canvas restano 1.

I render non cambiano: l'export carica sempre la pagina da zero, e alla prima esecuzione il codice
fa le stesse chiamate di prima.
