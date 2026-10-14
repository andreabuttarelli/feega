# Nodes added from the bottom bar land on free canvas

The bar's Image/Video/Text buttons and the frame templates placed the new node at the centre of
the view, whatever was there. On a canvas the agent had already filled, two images added in a
row stacked exactly on top of each other and on the agent's nodes; the first was invisible.

`placeNear` (placement.ts) keeps the view centre when it is free, otherwise takes the nearest
free cell in rings of node-sized steps. `create` and `addFrame` use it; drops at the pointer are
unchanged.
