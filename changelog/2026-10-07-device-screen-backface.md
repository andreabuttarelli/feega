# Uno schermo screenComp di spalle non compare più piatto e gigante

La faccia DOM di uno schermo `screenComp` si nascondeva con `visibility: hidden` (all'inizio e
quando `faceShown` dice di spalle). Il runtime hyperframes però scrive `visibility: visible` su
ogni clip nel suo range, anche quelli dentro la faccia: la UI restava visibile, senza la
`matrix3d` della proiezione, a 2× la dimensione dello schermo. Nel video Ondrafo: 6 frame grigi
pieni schermo all'ingresso del laptop che gira da −100°.

Ora la faccia si nasconde con `opacity: 0`, che i figli non possono scavalcare, sia nell'html
iniziale sia in `placeFaces`. La visibilità resta ereditata dal clip del device (#221).
Verificato con lo stesso build prima e dopo, render locale.
