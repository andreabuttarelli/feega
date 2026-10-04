# Motion editor: il look 3D (luci, ombre, ambiente, materiali, testo e logo estrusi)

Richiesta: i clip 3D avevano tre preset di luce fissi e un'ombra disegnata come un cerchio nero.
Serviva un look da render di prodotto, controllabile da UI e da agente.

**`doc.look`** (nullable, default `null`: i video esistenti restano identici, nessuna migrazione).
Contiene `lights[]` (directional/point/spot/area, colore, intensità, posizione, keyframe per
`intensity x y z`, campionati con lo stesso `sampleTrack` della camera), `environment`
(preset, intensità, rotazione), `softShadows`, `contactShadow`. Schema in `look.ts`,
operazioni in `look-ops.ts`; agente: `set_look`, `set_light`, `remove_light`,
`set_light_keyframes`; UI: `LookInspector.svelte` sotto l'inspector camera e sotto ogni clip 3D.

**Ambiente.** `room` è il `RoomEnvironment` procedurale (zero rete). Gli altri sono HDRI 1k di
Poly Haven (CC0) presi dagli esempi di three.js su jsDelivr, fissati al tag `r181`. Scartati
`ferndale_studio_04` e `monochrome_studio_02`: non esistono a `r181`, e il primo, preso da
`dev`, dava una dominante verde al blu del brand. Tone mapping `Neutral` (Khronos PBR Neutral)
invece di ACES: ACES spostava `#0099ff` verso il ciano.

**Ombre.** Shadow map PCF soft a 512 su un disco `ShadowMaterial` + un blob radiale di contatto.
VSM scartato: bande. Con il look acceso le luci preset del clip sono dimezzate, perché l'ambiente
già illumina.

**Materiali.** Tabella `SURFACE` in `materials.ts` (original/metal/chrome/glass/plastic/matte),
applicata a ogni mesh (anche ai GLB) come `MeshPhysicalMaterial`.

**Testo e logo estrusi.** `Text3D`: il font si risolve con `fonts/outline.ts` (upload → il file
caricato; Google e built-in → il WOFF di Fontsource su jsDelivr al peso caricato più vicino),
opentype.js lo legge, i path passano da `SVGLoader.createShapes` (fill-rule nonzero: le
controforme di «e» e «a» restano buchi) ed `ExtrudeGeometry`. `Logo3D`: `SVGLoader` sull'asset,
o sul logo del brand. La Y si ribalta con `rotateX(π)`, non con `scale(1,-1,1)`: lo specchio
rovescia le normali e il logo usciva nero.

**Costo render (misurato, 90 frame 1920×1080, 1 worker, SwiftShader):** senza look 47 s; look
con ambiente, spot + area, ombre soft 140 s (171 s con shadow map 1024); senza ombre soft 91 s.
Le ombre sono metà del costo: si spengono con `softShadows: false`.
