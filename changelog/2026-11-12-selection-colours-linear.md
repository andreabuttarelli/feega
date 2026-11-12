# Inspector: selection colours read the doc once

`scopeOf` in `selection-colours.ts` looked up each selected id with `findClip`, a walk of every
track per id. For a section of an imported page (hundreds of held ids in a 2,000-clip doc) that
is quadratic, and the inspector reruns it on every doc change, so on every pointer move of an
element drag (~230 ms of a 4 s drag in the landings profile). One id-to-clip map per call now.
