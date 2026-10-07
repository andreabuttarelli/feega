# Image: zoom e pan dentro il riquadro

Prima il componente Image poteva solo ritagliare (`fit` + `focusX/Y`); la `scale` del layout
ingrandisce il riquadro intero e copre ciò che sta intorno. Il product reveal non poteva
inquadrare una sezione leggibile di una cattura.

- Nuova prop `zoom` (1–4) sull'Image: l'immagine scala dentro il riquadro ritagliato, attorno a
  `focusX/focusY`. Tutte e tre sono `Source.Prop` animabili (variabili CSS `--kc-*` con il
  valore base come fallback), quindi `set_keyframes` fa push-in e pan interni.
- Il gate di nitidezza moltiplica `zoom` (prop e keyframe) nella scala mostrata.
- Product reveal espone `zoom`; la regola dello stile chiede di inquadrare la parte che conta.
