# Forme liquide: wave, blob, gooey e «Morph to…»

**Perché.** Le shape SVG avevano wiggle e zig zag, ma niente di organico: niente gocce che si
fondono, bordi che ondeggiano, blob che respirano. E il morph cerchio → quadrato (#123) chiedeva
tre passi: aggiungere il target, mettere un keyframe `morph` a 0, spostarsi e metterne uno a 1.

**Cosa.** Tre modificatori nuovi nella tabella `MODIFIERS` (`shape/modifiers.ts`):

- `wave`: spostamento lungo la normale `amp·sin(2π(onde·u − velocità·t))`, onde intere sui
  contorni chiusi così il bordo si richiude; periodico, ricampionato e liscio (Catmull-Rom).
- `blob`: tre armoniche con fase dal seed e velocità diverse, stesso spostamento, curve lisce.
- `goo`: non tocca la geometria; dà al gruppo un filtro SVG metaball (`feGaussianBlur` + soglia
  alfa in `feColorMatrix`), regione in `userSpaceOnUse` larga tre box per lato perché i
  repeater escono dal box.

La tabella guadagna due colonne: `moves` (il modificatore si muove da solo: sostituisce il caso
speciale `wiggles` in `hyperframes/shapes.ts`) e `filter`. Tutto resta funzione pura di
`(look, tempo)` e passa dal bake per frame già esistente: preview, export dal browser e render
sul server leggono lo stesso SVG per frame.

Preset (`shape/presets.ts`): blob, ripple, liquid (blob + repeater + goo, con l'offset del
repeater che va e torna, così le gocce si separano e si rifondono). Un preset sostituisce i
modificatori della shape e le loro chiavi.

Morph: `morphHere` aggiunge il target e mette le chiavi dal playhead per un secondo; il select
dell'inspector si chiama «Morph to…» e fa quello in un clic.

**Agente.** `apply_shape_preset`; `add_modifier` elenca wave/blob/goo; prompt aggiornato. Test
di parità: ogni `ModifierKind` e ogni preset sono raggiungibili dall'agente e si rileggono.

**Verifica.** Doc di demo (blob, ripple, liquid, morph cerchio → quadrato), 120 frame a 1080²:
preview contro export dal browser (html-to-image) 55–57 dB, preview contro render del producer
hyperframes 39–41 dB (H.264).

**Scartato.** Gooey tra clip diverse: il filtro dovrebbe stare sul contenitore della traccia,
dentro `#world` (vedi LESSONS, appiattimento 3D). Il composite `atop` con la sorgente lasciava
un bordo scuro: il filtro esce dalla soglia e basta.
