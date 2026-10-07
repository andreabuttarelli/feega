# Device3D: UI vettoriale live sullo schermo

Lo schermo di un Device3D accettava solo immagine o video: la UI di un'app si renderizzava due
volte (prima come video, poi come texture 1024 px) e a 1080p il testo diventava illeggibile.

Ora `screenComp` mette sullo schermo una composizione del video (Shape, Title, Text, Custom, kit)
che resta DOM: `flattenComps` la espande come per ring e bento (host `<id>-scr<face>`, un host
per faccia: due sul pieghevole), il runtime three proietta i quattro angoli del mesh dello schermo
con la camera e applica una `matrix3d` (omografia, `quadMatrix`) alla faccia DOM. Faccia girata o
dietro la camera: nascosta (`faceShown`). Isola, foro e notch sono ridisegnati sopra in DOM.

- **Deterministico**: la posa si calcola nel `drawAt(time)` di three, il contenuto sta sulla
  timeline principale; preview, browser e render usano lo stesso HTML.
- **Nitidezza**: la faccia è un box di lato ≥ 2× l'ingombro del clip (× zoom/dolly massimo,
  tetto 4096 px), quindi Chrome la rasterizza almeno al doppio di quanto appare.
- **Costo** (render locale, 6 s 1080p30, due telefoni): 80 s, nessuna texture da caricare.
- **Scartato**: texture da un canvas offscreen della precomp. Non esiste un'API che disegni DOM
  su canvas in modo sincrono e deterministico (foreignObject è asincrono e sporca il canvas):
  servirebbe un secondo renderer della UI.
- **Limiti**: la faccia DOM sta sopra il canvas WebGL, quindi non riceve il riflesso del vetro né
  la sfocatura di profondità; un oggetto 3D dello stesso clip non la può coprire.
- `create_comp` crea una composizione vuota con un frame proprio (es. 390×848) e `edit_comp` ora
  converte le unità sul frame della composizione, non su quello del video.
