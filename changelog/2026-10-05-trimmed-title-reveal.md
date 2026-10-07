# Le animazioni d'ingresso rispettano trimStart

Prima: i tween propri dei template (reveal di Title, fade-up di Text) partivano sempre da
`ctx.start`, ignorando `trimStart`. Tagliare l'inizio della clip, o di una Precomp che la
contiene, rifaceva l'ingresso: un loop con un titolo non poteva chiudere sul frame 0.

Ora `composeHtml` sposta quei tween indietro di `mediaStart`: quelli già finiti spariscono,
quelli a metà ripartono dall'inizio della clip con la durata residua, dallo stato iniziale.
Scartato il valore interpolato al punto di taglio: dipende dall'ease di ogni tween.
