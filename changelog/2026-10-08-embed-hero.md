# Embed liquid glass: hero intero

`<feega-liquid-glass>` non ridisegna più solo il titolo: ogni testo e ogni sfondo dentro il tag
(sottotitolo, bottone `.lg-cta` a spigoli vivi, link `.lg-link`) finisce nella texture, parola per
parola dalla posizione reale nel DOM, quindi il vetro li deforma tutti. La tela è opaca sopra il
DOM e non intercetta i click: bottone e link restano veri.

Il tag riempie il contenitore (`width/height: 100%`, prima nei Framer embed restava quadrato) e
centra il contenuto senza padding verticale.
