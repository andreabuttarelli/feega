# Video: poco testo, il titolo prende tutto lo schermo

Regola di gusto dell'utente: nei video poco testo; quando c'è, è un title card a schermo pieno e
la scena viene dopo. Titoli e scene si alternano, non stanno insieme.

- `DESIGN.md` §2, "words and pictures take turns".
- Gate (`style.ts`, severità in `direction.ts`): `Forbidden.TextOverScene` (Title/Text/Kicker
  con size ≥ 0.06 sovrapposto più di 0.5 s a Custom, Device3D, Video, Model3D o Image grande non
  velata; il Logo non è una scena, le label dentro la UI non sono clip di testo) e
  `Forbidden.TooMuchText` (> 1 parola al secondo, solo video ≥ 6 s: una scena singola non è un
  film). Entrambe **warning**, attive in launch film e apple minimal, non in UI morph.
- Prompt: `TITLE_CARD_RULE` nelle rules dei due stili, step 6 del trailer, descrizione di
  `write_script`.

Scartato blocking: quattro scene della libreria (`launch-device-fly`, `launch-device-orbit`,
`scene-device-split`, `scene-media-caption`) mettono per disegno una riga sopra la scena;
bloccarle avrebbe fermato ogni video che le usa. I loro test le esentano per nome: rifarle è
lavoro a parte.
