# Scene: niente pezzi di lettere all'ingresso, product reveal ritagliabile

- Il componente Title rivela ogni riga con una maschera (`yPercent` 105→0, 16 frame). Sommata
  all'opacità rapida delle scene, nei primi frame mostrava solo le cime dei glifi (barra della
  T, puntini delle i). Le scene usano ora `Text` (fade e rise, senza maschera); un test ricava
  i tween reali del template e rifiuta ogni testo con maschera.
- Product reveal: `fit: cover` con focus x/y esposti, per inquadrare una sezione della cattura.
  Uno zoom dentro il riquadro non esiste nel componente Image: `scale` ingrandisce il
  riquadro intero, provato e scartato (copriva la didascalia). Il gate ora conta anche `scale`.
- Titolo "in alto dopo l'accorciamento": non riprodotto. Accorciata o no, la scena mette il
  titolo a y 0,52; la lettura y≈0,1 veniva dal contact sheet, dove i bordi delle celle nere non
  si vedono.
