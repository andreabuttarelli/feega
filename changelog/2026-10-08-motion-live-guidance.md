# L'agente sa quando un componente è live

`componentContract` (prompt dell'agente motion) e lo schema di `write_component` spiegano la
differenza deterministic / live: quando scegliere live (giochi, pezzi generativi che cambiano a
ogni visione, hero interattivi — roba per l'embed), cosa si sblocca (loop, caso, `input`,
`onPause`/`onResume`/`onDestroy`), che nel video c'è uno still (primo frame seminato o
`{ still(t) }`) e un pattern minimo per LittleJS, KAPLAY e p5 live. Il KAPLAY suggerito muove le
posizioni a mano: `body()` + `move()` inciampa in un bug della 3001.0.19.

App → CLI → MCP: nessun tool nuovo; le descrizioni di `publish_motion_embed` e `render_video`
(MCP) e lo skill `feega` (due copie) dicono che i componenti live girano nell'embed e nel video
diventano uno still.
