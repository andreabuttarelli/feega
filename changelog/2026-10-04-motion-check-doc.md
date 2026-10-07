# Motion editor: il check dei componenti custom tornava sempre «failed»

Dopo le espressioni (#98) ogni componente custom falliva il check di determinismo con
`Cannot convert undefined or null to object`, e l'export restava bloccato. `checkDoc` costruiva il
suo clip come letterale, senza `expressions`; `composeHtml` → `bakeExpressions` leggeva
`Object.keys(clip.expressions)`.

Correzione: `newClip` in `doc.ts` è l'unico posto con i default di un clip; `addClip`,
`checkDoc` e `composition-draft` lo usano. Un campo nuovo dello schema si aggiunge lì una volta.
Test: il doc del check passa `parseMotionDoc` e si compone (`determinism.test.ts`).
