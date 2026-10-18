# A frame's direct children take a single click

Refines the drill-in (#608) to match design tools: a frame is not a group. A click on a frame's direct
child selects it, closed or open; empty area or the title selects the frame. Double-click only goes
deeper (part, then text editing). Hover now uses the click row of `DRILL`, so it always outlines
what the click will select (a unit test checks hover against click at every depth).

On a closed frame the click is queued on pointerup when the pointer moved under 4 px; a drag still
moves the whole frame through xyflow. The editor replays the queued click after its first measure,
and only when nothing was selected meanwhile (a Layers pick wins).
