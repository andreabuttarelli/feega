# Fisica sui clip del motion editor

**Perché.** Un rimbalzo credibile si otteneva solo a mano, chiave per chiave, e non reggeva un
cambio di altezza o di durata. Serviva gravità vera su qualsiasi clip, senza perdere il seek
deterministico su cui poggiano preview, export dal browser e render sul server.

**Cosa.** Campo `physics` sul clip (`physics/model.ts`, opzionale, `null` = spenta): gravità
(px/s²), restituzione, attrito, velocità iniziale X/Y (px/s), massa, `bounds` (`floor`, `box`,
`none`) e `collide`. La simulazione (`physics/simulate.ts`) è una funzione pura del doc: passo
fisso (8 sottopassi per frame), integrazione di Eulero semi-implicita, rimbalzo sui bordi della
composizione con soglia di quiete, attrito sul contatto, urti AABB tra i clip con `collide`
(correzione di posizione e impulso pesati dall'inverso della massa, ordine fisso). Ogni clip
diventa una chiave `x`/`y` lineare per frame, sommata al suo movimento: `bakePhysics` entra in
`composeHtml` dopo path ed espressioni, come già `bakePaths`, quindi ogni percorso di render
legge le stesse chiavi e il seek cade sempre nello stesso punto.

Preset: drop & bounce, throw, float. Inspector: sezione Physics (preset, valori, bordi, urti,
rimozione). Agente: `set_physics`, `apply_physics_preset`, `physics` in `get_motion_doc`, riga
nella tabella di parità.

**Verifica.** Doc di demo (drop, throw su un Title, float, due palle che si urtano), 150 frame a
1080²: preview contro render del producer hyperframes 37–44 dB (H.264); preview contro export
dal browser 35–60 dB, dove la differenza è solo l'antialias del testo, le posizioni coincidono.

**Scartato.** Simulare nel runtime della pagina: il seek all'indietro avrebbe richiesto di
rigiocare la simulazione dal frame 0 in ogni renderer. Rotazione e urti tra forme non
rettangolari: fuori dal primo taglio.

**Unità.** Dopo #134 la sezione Physics e i tool passano da `PROPERTY_UNITS`: rimbalzo e attrito
in %, velocità in px/s, gravità in px/s²; nel doc restano 0..1 e px.
