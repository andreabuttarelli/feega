# Titoli più piccoli su desktop, login piccolo

`--ui-mega` su desktop passa da `clamp(48px, 8vw, 128px)` a `clamp(40px, 4.5vw, 72px)`: a 128px
il titolo schiacciava la vista. Il mobile resta com'era.

Il login è l'unica vista col titolo piccolo (`TitleSize.Small`, 20px): non è una pagina che
interessa l'utente, il titolo non deve dominarla. La taglia è un enum di `PageTitle`, non un
secondo componente.
