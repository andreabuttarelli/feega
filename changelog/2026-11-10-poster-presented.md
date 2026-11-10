# A frame's poster counts as presented for vectors-before-images

The `VectorGate` (#1886) holds a frame's image version until every
on-screen frame has shown its vectors or cached thumbnail. A frame
showing its server poster (uploaded on save, #1876) did not count, so a
canvas with posters on every frame still held images until each frame's
vectors were uploaded. A poster card now counts when its list actually
carries the poster image (`showsPoster`); the blank stand-in card every
frame gets before a poster exists does not.
