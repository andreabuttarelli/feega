# Timeline a dito: scrub, pinch centrato, pan, trim

Ticket T4 di `touch-editor/SPEC.md`.

- Un dito su una lane vuota: dopo 8px l'asse si blocca (`lockAxis`); in orizzontale sposta il
  playhead, in verticale scorre le righe.
- Pinch: lo zoom resta ancorato al punto medio delle dita e due dita che si muovono insieme
  fanno pan (`pinchView`). Prima lo zoom teneva fermo il bordo sinistro.
- Un tocco su un clip non selezionato lo seleziona e basta: si sposta solo un clip già
  selezionato (niente drag accidentali mentre si scorre).
- Trim, fade e keyframe: disegnati piccoli, bersaglio 44px su `pointer: coarse`. I grip di trim
  esistono solo sul clip selezionato e mostrano una barra d'accento.
- Snap: raggio in pixel (`SNAP_RADIUS_PX`, 12 mouse / 20 dito) invece di 8px fissi; durante il
  drag una guida di 1px in accento e una vibrazione breve dove c'è.
- Tablet: il breadcrumb esce dalla barra (si sovrapponeva al trasporto con undo/redo in barra).

`pinched` resta in `timeline-layers.ts` per i suoi test; la timeline usa `pinchView`.
Scartato in questo ticket: i detent del pannello timeline su telefono (vanno con i fogli di T6).
