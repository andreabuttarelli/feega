# Farm: `Sandbox.list` con `sortBy: 'name'`

`/api/v1/canvas/runs/tick` falliva ogni minuto in produzione: l'API delle Sandbox rifiuta
`namePrefix` senza `sortBy: 'name'` ("namePrefix is only valid when sortBy is name"). `running()`
in `vercel-farm.ts` lo passa ora, e il reaper torna a vedere i worker vivi.
