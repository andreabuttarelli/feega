# Unità delle proprietà del motion editor

**Perché.** Il doc salva posizione e dimensioni come frazioni della composizione (`x: 1` = una
larghezza intera), scala e opacità come moltiplicatori. L'inspector mostrava quei numeri crudi:
slider di Offset X da -2 a 2 con passo 0.01 (ogni tacca ~11 px su 1080), Mask X da -30 a 30
(6000 tacche), nessuna unità nel campo. Chi scriveva «12» pensando ai pixel mandava il clip a
dodici larghezze di distanza.

**Cosa.** Una tabella sola, `PROPERTY_UNITS` in `src/lib/motion/units.ts`: per ogni chiave
unità (px, %, °), base di conversione (larghezza, altezza, lato corto, ×100, identità) e
portata dello slider. Il doc non cambia: si converte in lettura (`toShown`) e in scrittura
(`toStored`), quindi i doc esistenti si rendono identici. Inspector (proprietà animabili, campi
range, profondità) e camera mostrano px della composizione, %, gradi, con passo 1 e l'unità
accanto al campo. I componenti Custom restano nei numeri del loro schema, tranne transform e
maschera (`propsOwner`).

**Agente.** Tutti i tool che leggono o scrivono valori (`get_motion_doc`, `list_components`,
`add_clip`, `set_props`, `set_transform`, `set_keyframes`, `set_ease_handles`, `set_mask`,
`set_mask_stack`, `set_path_tangent`, `set_camera`, `set_camera_keyframes`, `add_null`,
`add_shape`, `add_particles`) passano dalla stessa tabella; il prompt riporta `UNITS_GUIDE`.
Le espressioni vedono ancora i valori salvati, e il prompt lo dice.

**Scartato.** Migrare il doc in `parseMotionDoc`: avrebbe cambiato render, compositore,
espressioni e template in un colpo, per lo stesso risultato visibile. I preset camera Truck e
Crane hanno ancora `amount` in frazioni del frame.
