# Lettura anonima di `feature_flags` limitata a `social_publishing`

`20261008130000_social_publishing_flag.sql` apriva ad `anon` tutta `feature_flags`
(`using (true)`): chiunque con la chiave pubblica leggeva anche `nsfw_mode` e `uncensored_mode`,
funzioni non annunciate. Cron e MCP hanno bisogno solo di `social_publishing`: la nuova
`20261008140000_feature_flags_anon_scope.sql` ricrea la policy con `key = 'social_publishing'`.
Gli utenti autenticati continuano a leggere tutto, come prima. Da applicare a mano.
