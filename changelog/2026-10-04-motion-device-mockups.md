# Motion editor: device mockup 3D

Richiesta: telefoni, laptop, monitor, tablet e finestra browser con uno schermo che porta
un'immagine o un video, mappato bene in ogni rotazione, con riflessi, spessore, ombra e
animazioni pronte.

**Geometria nostra, nomi generici.** Le bezel Apple vietano animazione, ombre, riflessi e ogni
simulazione 3D; il device art Google esclude i marchi. Quindi niente asset terzi: ogni device è
costruito in three.js da una tabella sola (`devices.ts`: corpo, schermo dalla diagonale e dai
pixel ufficiali, isola/foro/notch, layout fotocamere, tasti, base, stand) con le misure delle
pagine specifiche ufficiali (link nel campo `sources`). Dettagli non pubblicati (raggi, isola,
posizione lenti) stimati dalle foto stampa e verificati nel foglio QC. Decisione in
`docs/legal-review-checklist.md`.

**Schermo.** Un canvas 2D (max 1024 px) disegna la sorgente in modalità cover, o scorre
(`screenScroll`) se è più alta dello schermo, e diventa `CanvasTexture` su una forma
arrotondata con UV normalizzate: resta incollato in ogni rotazione. Il video è un `<video>`
nascosto che il runtime HyperFrames sincronizza; al render il producer mette accanto un
`<img class="__render_frame__">` col frame esatto e lo disegniamo noi (MutationObserver +
`decode()`), così il frame dello schermo è quello del tempo, non quello prima.

**Trappole pagate.** (1) Gli strati vetro/schermo/riflesso distanti 0.05 mm facevano z-fighting
sul laptop (lo schermo «sbiancato»): ora la distanza scala con il device e c'è il
polygonOffset. (2) `envMapIntensity` è ignorato quando c'è `scene.environment`: il riflesso
si regola con `specularIntensity` (`SCREEN_REFLECTION`). (3) Le lenti del retro vanno
specchiate (+x davanti = sinistra vista da dietro).

**Preset** (`device-presets.ts`, una tabella): spin-in con assestamento a 3/4, hero turn,
apertura del coperchio (solo laptop, chiave `lid`), scroll dello schermo; `addDeviceRow` mette
tre device sfalsati che girano a velocità diverse. Agente: `apply_device_preset`,
`add_device_row`; UI: `DevicePresets.svelte` sotto l'inspector di un Device3D.

Non fatto: componente custom nello schermo (solo immagine o video).
