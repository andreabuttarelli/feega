# "Make A/B pair" non crea un terzo nodo

Il bottone compariva anche sul gemello, e premuto lì creava un altro nodo con il lato opposto.

`cutoutTwin` (`src/lib/canvas/effects-node.ts`) riconosce il gemello: un nodo Effects alimentato
dalla stessa sorgente, con la pila uguale a `counterpart` della propria. La tela nasconde il
bottone quando il gemello esiste; `makeEffectsPair` (chat, MCP, action) restituisce il gemello
esistente invece di crearne un altro.
