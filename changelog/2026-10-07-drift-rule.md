# Una deriva lenta è camera, anche se dura meno di 2 s

`cutProblems` contava come animazione ogni movimento sotto i 2 s: una deriva di 1,8 s su un
device (dolly 1 → 1,04) bloccava con `no-hold`, mentre la regola "camera never rests"
(warning `still`) chiedeva proprio quella deriva. Le due regole si contraddicevano sui clip brevi.

Ora la regola è una, in `cuts.ts`: un segmento è deriva se dura almeno `DRIFT_SECONDS` (2 s, come
prima) **o** se la sua velocità sta sotto `DRIFT_RATE` per quella proprietà (scala 5%/s, dolly e
zoom 0,08/s, x/y 3% del quadro/s, rotazioni 6–12°/s). Una deriva non chiede tenuta e non blocca
il taglio; tutto il resto deve finire e tenere 1 s. La regola di stile lo dice con le stesse soglie.

Scartato: abbassare `DRIFT_SECONDS` (avrebbe esentato anche i movimenti veloci brevi).
