# Canvas: opacity edits on a layer drawn as one group take the fast patch

`fastPatch` scales the opacity of the edited layer's items in the shown display list instead of
waiting for the worker rebuild. It refused any owned item that is a group. A layer with more than
one piece of content (two fills, fill and stroke) that is not fully opaque is drawn as one group
carrying its own opacity, so after the first opacity edit landed through the rebuild every later
edit on it was refused and waited for the worker (about 60 ms of build on the landings bench).

A group whose items all belong to the edited layer is now faded by its own opacity, which is what
the full build produces. Groups that hold other layers (blend or mask groups) still go to the
rebuild.
