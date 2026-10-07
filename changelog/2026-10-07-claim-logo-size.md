# Logo del claim: minimo leggibile, mai più piccolo dell'URL

Il test supasito.com chiudeva su un logo di ~60 px a 1920 con l'URL 5–6 volte più grande: il
template `builtin:launch-logo-build` metteva il logo in un box 0.18×0.32 e l'URL a `word(0.11)`.

- Nuovo controllo `small-logo` in `direction.ts`: in ogni composizione, un `Logo` che si
  sovrappone nel tempo a un testo con un indirizzo (`dominio.tld`) deve essere largo almeno il
  18% del frame (`MIN_LOGO_WIDTH`) e non meno dell'URL. La larghezza è quella disegnata
  (contain nel box, sui pixel dell'asset; senza pixel si assume un logo quadrato), per la scala
  statica: i keyframe d'entrata non contano.
- Il template ora ha logo 0.36×0.4, anello in proporzione e URL a `word(0.06)`.
- Test sul doc reale di supasito (fixture `supasito-claim.fixture.json`, solo il claim).

Scartato: misurare il bounding box opaco del PNG (margini trasparenti). Servirebbe leggere i
pixel lato server; per ora vale il box dell'asset.
