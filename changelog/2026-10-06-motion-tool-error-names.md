# Gli errori dei tool motion nominano il tool che risolve

Prima: `add_clip` con un font non registrato rispondeva `call set_font with the family`. `set_font`
esiste, ma vuole un `clip_id`: non può registrare un font prima che la clip esista. Nel test Dub
l'agente ha fallito 10 `add_clip` di fila prima di trovare `register_font`.

Ora l'errore, il prompt e le descrizioni di `register_font`/`analyze_site` indicano `register_font`
prima di `add_clip`. Due test in `motion-tool-references.test.ts`: ogni nome a forma di tool nei
sorgenti motion (errori, descrizioni, prompt) è un tool reale; e il tool suggerito dall'errore del
font, chiamato con la sola famiglia, fa passare la clip. L'audit non ha trovato altri nomi
inesistenti; i codici d'errore (`render_*`) e `parent_id` stanno nella lista `NOT_TOOLS`.

Scartato registrare il font in automatico dentro `add_clip`: nasconderebbe al modello una famiglia
scritta male invece di dirgliela.
