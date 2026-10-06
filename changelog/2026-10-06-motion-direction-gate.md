# Regia e gate di qualità per il motion agent

Prima: nel test Dub ("go all out") l'agente ha ripetuto un layout quattro volte, con tagli secchi,
senza audio, titoli in box piccoli e un device entrato da schermo bianco. Il prompt aveva uno
"house style" generico e `view_frames` restituiva solo le immagini.

Ora `src/lib/motion/direction.ts` tiene in un posto solo le regole di regia (`DIRECTION_RULES`,
inserite nel prompt come tabella numerata: storyboard prima della prima modifica, layout mai
ripetuti di seguito, transizioni vere con `set_clip_transition`, gerarchia tipografica, screenshot
ritagliati o zoomati, nessun frame vuoto, musica sul beat) e il gate che ne verifica una parte:

- dal doc (`docProblems`): scene consecutive con lo stesso layout (ruolo e lato di ogni clip),
  più di metà dei cambi scena senza transizione, Title con box sotto il 12% del frame, musica nel
  progetto mai suonata;
- dai frame (`frameProblems`, statistiche con sharp in `frame-stats.ts`): frame piatto
  (deviazione della luma < 4) e più del 15% del frame bianco pieno.

`view_frames` restituisce `quality` con i problemi; il self-check chiede di correggerli.

Ripresa la PR #148: la migration di `canvas-assets` (già applicata in produzione) e gli errori di
Storage visibili all'agente restano; `selfCheckChoice` è passato nella PR #177.

Scartato: un giudice LLM sui frame (costo per ogni view, e il modello di visione vede già le
immagini) e soglie per brand (nessun dato per tararle).
