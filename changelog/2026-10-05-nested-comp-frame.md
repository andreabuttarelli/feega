# Composizioni annidate: frame, sfondo, loop

Tre difetti emersi dalle demo bento (ring, masking loop, card interattiva in un 9:16).

- **Frame.** Un motion 16:9 annidato in una composizione 9:16 veniva impaginato nel frame
  dell'ospite: posizioni e corpi del testo stirati. Ora `embedMotion` scrive `frame` sulla comp;
  le clip dentro una cella bento si compongono a quella misura (`cellFrames`, `ctxOf`) e la cella
  le scala. Il puntatore live attraversa la stessa conversione (`spec.ts`): i livelli dentro una
  cella con frame proprio lavorano nello spazio di quel frame.
- **Sfondo.** Un motion annidato perdeva il `background` del suo doc: la cella mostrava il proprio
  colore e un testo scuro spariva. La comp porta `background`; la cella lo dipinge (`brand` →
  colore brand, `transparent` → nessuno).
- **Loop.** Una precomp in loop metteva tutte le ripetizioni sulla stessa traccia: un bento o un
  ring annidato prendeva le celle di ogni giro alla prima ripetizione, le altre uscivano vuote.
  Ogni giro ha ora le sue tracce.

Scartato: dare `frame` e `background` a ogni precomp. Solo le comp nate da un motion esterno
hanno un frame diverso da quello dell'ospite.
