# Motion path: posizione come curva nello spazio

**Perché.** x e y erano due animazioni indipendenti: niente traiettorie curve né orientamento.

**Cosa.** `clip.path` (nullable): con x/y chiavati agli stessi tempi la posizione diventa un
bezier spaziale (x,y,z) liscio fra le chiavi; tangenti esplicite per chiave (`tangents`, in
frazioni di frame). Il tempo di percorrenza lo danno i keyframe di x (ease, in/out, roving),
applicati alla lunghezza d'arco: tabella di 64 passi per segmento. `autoOrient` somma l'angolo
di marcia a rotateZ. `bakePaths` prima della composizione riscrive x/y/z/rotateZ fotogramma per
fotogramma: il renderer non conosce i path, quindi parenting, camera e ritiro di GSAP restano
invariati. Overlay sulla preview con traiettoria, chiavi e maniglie trascinabili (specchiate);
interruttori nell'inspector. Agente: `set_motion_path`, `set_path_tangent`; `get_motion_doc`
mostra `path`. Demo renderizzata sul farm.
