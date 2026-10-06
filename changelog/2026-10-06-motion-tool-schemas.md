# I tool motion che creano clip accettano la stessa collocazione

Prima: `add_clip` e `add_particles` accettavano `track_id`, `add_shape`, `add_device_row` e
`generate_voiceover` no; nessuno accettava effetti alla creazione, e solo `add_shape` restituiva il
`clip_id`. Nel test Dub `add_shape` ha rifiutato `track_id` e `blur`, il glow è finito sulla traccia
sbagliata e ci è voluto un `move_clip`. `set_look` rifiutava `studio`, il nome che il modello prova
per primo.

Ora `PLACED` (`track_id`) e `PLACED_PICTURE` (`track_id` + `effects`, stesso schema di
`add_effect`) si spargono nello schema di ogni tool di creazione, e ognuno restituisce `clip_id`
(`clip_ids` per `add_device_row`). Un effetto rifiutato non lascia la clip a metà: l'operazione
intera fallisce. `set_look` accetta `studio` come alias di `room` (`ENV_ALIASES` in `look.ts`) e
la descrizione di `add_shape` dice `fillKind`, il nome vero della prop.

Audit degli enum: i parametri a valori fissi dei tool sono già `z.enum`/`z.literal`; restano liberi
`prop` (chiavi dinamiche come `fx.<id>.<param>`) e le `props` per componente, i cui valori stanno
in `list_components`. Il test `motion-creation-tools.test.ts` tiene la tabella dei tool di
creazione.
