# Word entrance lands softly

Reported: titles in the motion templates looked like they took "a final step" at the end.

Measured at 60 fps (split-headline, sub-pixel centroid of the first word): the word was fully
faded in when only 4% of its rise was done, then hopped ~18 px. Cause: position eased with
expo in-out (nearly still for its first third) while opacity completed in the first 35%.
Rasterization was not the cause: with `will-change` the last frames move < 0.1 px.

Change: `wordIn` (`src/lib/motion/template/word-entrance.ts`) eases position with a quintic
out curve, moving during the fade and reaching zero speed at rest. Shared by floating-media,
feature-scroll, split-headline, image-globe; no local copies existed.
Discarded: keeping expo in-out and delaying the fade (word invisible for half its entrance).
