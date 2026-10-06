# Il pannello bento si chiude

Prima: `BentoPanel` stava aperto sopra la metà inferiore dell'anteprima della composizione, e su
telefono la copriva quasi tutta. Ora è un `<details>` chiuso di default ("Grid"): l'anteprima resta
libera, i controlli di griglia e celle si aprono quando servono. Scartato spostarlo fuori dal nodo:
la tile di SvelteFlow taglia ciò che esce dai suoi bordi.

L'etichetta dell'immagine che sfiorava la composizione negli screenshot veniva dallo script di
prova (nodi sovrapposti), non dal layout delle etichette.
