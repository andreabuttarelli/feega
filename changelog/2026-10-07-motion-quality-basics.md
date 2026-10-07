# Motion: ritmo, nitidezza, immagini in movimento, bezel dei device

Il dub.co v3 è stato giudicato terribile. Quattro cause, quattro correzioni.

- **Ritmo.** Lo stile Apple minimal entrava in 0,6–1,2 s: testo moscio. Ora `STYLES` dice
  0,3–0,5 s su expo-out `(0.16,1,0.3,1)`, stagger 0,1 s, rise 2%, blur 6; le 18 scene
  seguono, il movimento lento resta a camera e prodotto. Scartato il reveal per parola
  (animator `word`): sul Title produceva frammenti di glifi nei primi frame.
- **Immagini ferme.** Nuova voce `Forbidden.Still`: un Image o un Device3D fermo per più di
  1 s viene nominato dal gate. Le scene con immagini hanno `drift` (push-in + pan) per tutta
  la durata.
- **Immagini sgranate.** `import_asset` accetta `capture: desktop | mobile`: una sandbox del
  farm (la base ha già puppeteer e Chrome) fotografa la pagina a 2× (1440×900 / 390×844) e
  fino a 4 sezioni sotto; bordo massimo 3840 px invece di 2048. Il gate riceve i pixel degli
  asset (`MotionAsset.width/height`) e nomina `soft-picture` (ingrandimento oltre 1,25×, con
  la scala massima = pixel sorgente / pixel a schermo) e `cropped-screen` (uno screenshot
  desktop su un telefono perde i lati). Nessun servizio di screenshot nel repo: il farm c'era.
- **Bezel.** Il bevel del corpo (1,76 mm) mangiava il bezel da 2,5 mm: girato, il lato
  lontano perdeva il bordo nero e lo schermo sembrava uscire dal telefono. Il bevel ora sta
  dentro il rim del vetro (`GLASS_RIM`), test in `devices.test.ts`.
