# A disposed DOM reader no longer stalls the player

The gpu player mounts a DOM reader iframe for custom clips (the Saturn embed is a three.js
Custom). When fonts load it remounts: the old iframe is removed. A read already sent to it never
got an answer and kept the player `busy` until the 60 s timeout, then the rejection was taken as
a backend failure and triggered the fallback. The embed stayed blank.

Now `dispose()` rejects reads still waiting, and the player ignores a rejection from reads it
already replaced and asks again. Read ids are a counter instead of `crypto.randomUUID`, which
does not exist when the embed sits in a non-secure host page.
