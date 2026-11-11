# Landing hero ASCII: brighter, centred, organic

Feedback on #1963: too dark, clustered top-left, banded. Causes: the colour ran left→right into
dark mauve/blue, so the right half vanished on black; rows were sampled 3.4× denser than columns
(bands); density was squared, leaving most cells empty. Now colour and density follow a radial
`envelope` from the centre (orange core, brighter cool edges), sampling is isotropic in pixels,
alpha 0.3–0.75, and a radial CSS dim sits only behind the title.
