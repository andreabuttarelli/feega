# Canvas: shadows of off-screen cards reach into view

A group with a filter, blur or feathered mask was kept when its reach overlapped the render, but
its children were culled against the render alone. A card just outside the screen or a tile kept
its group and lost its body, so the shadow it casts into view was missing (and #1924 then skipped
the empty layer). Children of such a group are now laid out against the render inflated by the
group's reach (`shade_reach` in `groups.rs`: blur and feather times the blur reach, plus the
filter reach); an unbounded filter (SVG with its own region) keeps all its children.

Landings, CPU 1x: settled screenshots vs dev differ by at most 1 (the fixture's shadows are faint);
gestures and load within noise, tiles off and on.
