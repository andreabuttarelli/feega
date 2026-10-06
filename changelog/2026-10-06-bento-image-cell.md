# Le immagini compaiono nell'anteprima della composizione

Prima: nel nodo composizione la cella di un'immagine collegata restava grigia. L'anteprima gira in
un iframe `srcdoc` con origine opaca (`sandbox-origin="opaque"`): da lì la richiesta a
`/c/<canvasId>/assets/<id>` parte senza i cookie di sessione, la route risponde 303 → `/login` e
l'`<img>` riceve HTML. Le celle motion funzionavano perché `motionSource` restituisce già URL
firmati di Storage.

Ora `CompositionNode` chiede gli URL firmati delle sue card a `GET /c/<canvasId>/asset-urls`
(`assetsById` in `server/motion/editor.ts`, la stessa firma di `motionAssets`) e li passa al player
al posto dei percorsi relativi. Scartato aprire l'origine dell'iframe: la sandbox opaca è voluta.
