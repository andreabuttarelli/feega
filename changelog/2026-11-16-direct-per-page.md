# Direct zoom: held scenes per page

The desktop direct path held one scene for the whole screen and rebuilt all of it when the zoom
left its room, which took about 30 ms at 1× CPU. Each page now holds its own scene; stale pages keep
drawing and rebuild on-screen first under a 4 ms budget per frame. Layer images still drawn
by a held scene are pinned, because cache sweeps could unregister them and leave a page's
effects blank. Phones stay on tiles: at 4× CPU one page build is still 50–110 ms. Numbers in
`docs/design/direct-gesture-zoom.md`, round 5.
