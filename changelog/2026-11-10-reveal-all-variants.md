# Loading screen waits longer for the whole first screen

On a real canvas the screen lifted at the 4 s cap with three frames
drawn and the rest, including mobile/tablet breakpoint views, still
white. The cap is now 8 s after the GPU is ready and the hard timeout
12 s, both in one rule (`revealDue`). Breakpoint views already count:
they are in the frame list CoreFrames checks once their base source
arrives, so the bar and the reveal include them.
