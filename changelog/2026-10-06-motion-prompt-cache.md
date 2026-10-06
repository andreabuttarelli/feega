# Il turno motion legge il prefisso dalla cache di Anthropic

Prima: ogni passo dell'agente motion rimandava system, tool e storia interi. Nel test Dub (Opus
5.5, reasoning low): 465.258 token di prompt, 0 in cache, $2,06 a turno, e il tetto da $1,50
fermava il turno a metà.

Ora `llmLanguageModel(id, PromptCache.On)` usa un client il cui fetch aggiunge un
`cache_control: {type: 'ephemeral'}` al livello più alto della richiesta (`withPromptCache`, solo
per `anthropic/*`). Su OpenRouter, Responses API, è il caching automatico di Anthropic: un
breakpoint sull'ultimo blocco, e al passo dopo la ricerca all'indietro ritrova il prefisso già
scritto (tool + system + messaggi). Verificato a mano su `claude-haiku-4.5` con un prefisso di 17k
token: secondo passo 17.008 token in cache, costo da $0,0170 a $0,0017.

Scartato: `cache_control` dentro le parti del messaggio di sistema (sulla Responses API di
OpenRouter non scrive nulla), e il caching per ogni chiamata del prodotto (una chiamata singola
paga la scrittura 1,25× senza mai rileggerla). Gli altri provider cachano da soli e ricevono la
richiesta intatta.
