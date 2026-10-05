# Motion editor: particelle deterministiche

Richiesta: un clip Particles con seed, simulazione funzione pura del tempo, parametri
keyframabili e preset (scintille, polvere, coriandoli, bokeh, neve).

**Modello.** `Particles` è un componente di libreria: `seed`, `emitter` (point, line, box, ring),
`shape` (circle, square, triangle, streak, sprite), `sprite` (immagine), `prewarm`, e una tabella
di numeri in `particles/model.ts` (emettitore, rate, vita, velocità, direzione, spread, gravità,
drag, wobble, spin, dimensione/opacità iniziale e finale, softness) più due colori. La tabella
genera sia lo schema zod sia le `AnimProp` (`Source.Param`): ogni numero e colore prende
keyframe ed espressioni. Il seed no: cambiarlo cambia la dispersione, non si anima. `emitterX` /
`emitterY` invece di `x`/`y`, che sono già l'offset del transform.

**Purezza.** `particlesAt(bake, frame)` non tiene stato: rifà le nascite dal primo frame
(integrale del rate per frame, così un rate animato resta esatto) e calcola ogni particella viva
in forma chiusa (drag esponenziale, gravità, wobble sinusoidale) con un hash di (seed, indice,
canale). Le proprietà di una particella si leggono alla riga del suo frame di nascita. Il seek
diretto a un frame e la riproduzione fino a lì danno lo stesso array: è un test.

**Runtime.** Come le shape: il server fa la bake (una riga di parametri, o una per frame se c'è un
keyframe), il runtime incolla `particlesAt` e `drawParticles` via `toString()` e disegna su un
`<canvas>` a ogni `onUpdate` del timeline e a ogni `hf-seek`. Lo stesso HTML va in preview,
export dal browser (html-to-image clona il canvas) e render sul server.

**Scartato.** Three.js/GPU: non deterministico fra macchine e pesante per un 2D. Una bake
completa delle posizioni per frame: centinaia di KB per clip, contro poche righe di parametri.

**Agente.** `add_particles` (preset + props sopra) e `apply_particle_preset`; i keyframe passano
dal solito `set_keyframes`. Tabella di parità aggiornata. Inspector: i campi arrivano dallo
schema con il diamante dei keyframe; i preset sono bottoni (`ParticlePresets.svelte`).
