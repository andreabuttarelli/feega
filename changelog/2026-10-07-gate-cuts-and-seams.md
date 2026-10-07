# Il gate nomina i tagli a metà animazione e gli sfondi con il bordo

Il film di lancio Plinkora (dal golden dub v4) è stato bocciato per due difetti che il gate non
vedeva: le UI del kit venivano tagliate prima di finire (funnel a metà, toast mai arrivato), e
l'alone radiale dello sfondo, un'ellisse più piccola del frame, mostrava il bordo.

- `cut-mid-animation`: ogni pezzo del kit dichiara in `SETTLES` (`ui-kit/kit.ts`, una riga per
  pezzo) quando la sua animazione è finita, in funzione di props, durata e `speed`. Il gate
  chiede quel tempo più 1 s di tenuta prima della fine della clip. Per le clip con keyframe: un
  movimento ancora in corso a 1 s dal taglio è un difetto; una deriva lunga (≥ 2 s) e un'uscita
  che parte nell'ultimo secondo no.
- `background-seam`: uno Shape a gradiente grande (≥ metà del frame, scala compresa) deve coprire
  tutto il frame; per ellisse e cerchio la curva deve passare oltre i quattro angoli.

Gravità: su main non c'è una tabella unica (la #206 è aperta), quindi sono due voci di `Quality`
come le altre.
