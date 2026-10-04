# Motion editor: Google Fonts, pesi, corsivo, font caricati

Richiesta cliente: tutto il catalogo Google Fonts nel motion editor, con peso e stile, i font
del brand per primi e i font propri caricati.

**Catalogo.** Nessuna chiave Google Fonts API nel `.env`: `scripts/google-fonts-catalogue.mjs`
legge `https://fonts.google.com/metadata/fonts` (pubblico, senza chiave) e scrive
`src/lib/motion/fonts/google-catalogue.json` (1729 famiglie open source, per popolarità; 99 KB:
famiglia, categoria, pesi, corsivo). È versionato e si rigenera a mano: generarlo al build
avrebbe legato ogni deploy alla rete e a un endpoint non documentato. Il client lo carica con un
`import()` solo quando si apre il selettore.

**Modello.** `doc.fonts` registra le famiglie usate (`google` con pesi reali e corsivo,
`upload` con `assetId`). Il prop `font` dei componenti di testo è un nome di famiglia (default
`sans`, `mono` restano built-in); nuovi `weight` (100–900) e `italic`. Un clip non può puntare a
una famiglia non registrata (rifiutato da `addClip`/`setProps` e al parse): `set_font` registra e
imposta in un colpo. I param `font` dei componenti custom diventano `format: 'font'` e arrivano
al codice come stack CSS.

**Caricamento deterministico.** `composeHtml` chiede a Google solo i pesi che la famiglia ha
(il più vicino; `ital,wght@` ordinato), dichiara gli upload con `@font-face` sull'URL dell'asset,
e `window.__fontsReady` aspetta il foglio di stile, poi `document.fonts.load` di ogni faccia. Il
boot dei componenti custom e la cattura aspettano quella promessa; dopo il boot la timeline si
ri-renderizza al tempo corrente. Una sonda invisibile in `#root` usa ogni faccia, così l'export
dal browser (html-to-image) le incorpora tutte fin dal primo frame. CSP: `font-src` ammette
`'self'` e l'origine degli asset.

**Il renderer su server sostituiva i font.** Il producer HyperFrames, per ogni famiglia senza
`@font-face` nella pagina, ne inietta una sua: per un elenco di alias usa font impacchettati
(`Bebas Neue` → League Gothic, Playfair dalla sua copia). Server e browser divergevano (PSNR 19
dB sul frame in Bebas). Ogni famiglia Google usata ha ora una `@font-face` segnaposto
(`font-weight:1; unicode-range:U+0`, non corrisponde a niente) che il producer vede come già
dichiarata; il font vero resta quello del foglio Google. Dopo: 31–33 dB su tutti i frame.

**Upload.** Il client carica in `canvas-assets` sotto la cartella dell'org (RLS esistente),
l'azione `uploadFont` verifica percorso, peso (10 MB) e firma dei byte (WOFF2, WOFF, OTF, TTF:
il nome non conta), cancella ciò che non è un font e registra un asset `document` con mime
`font/*`; nessuna migrazione. Il selettore ricorda di caricare solo font con licenza per video.

**UI e agente.** `FontPicker`: ricerca su tutto il catalogo, anteprima di ogni nome nel suo font
(`&text=`), brand per primi (famiglie del catalogo nominate nel testo del brand), font del video,
upload. Tool `list_fonts`, `set_font`, `register_font`, `remove_font`; `fonts` nel riassunto e
nella parità.
