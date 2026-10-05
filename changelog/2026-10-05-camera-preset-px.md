# Truck e Crane in px

**Perché.** Dopo #134 i valori della camera si leggono e scrivono in px, ma `amount` dei preset
Truck e Crane era ancora una frazione del frame (0.15, 0.2): un «200» pensato in px veniva
rifiutato o mandava la camera a duecento larghezze.

**Cosa.** `amount` di Truck e Crane è in px del frame (default 160 e 220); il preset divide per
larghezza o altezza prima di scrivere le chiavi. Il doc salvato non cambia.
