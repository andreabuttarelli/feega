# Gallery: /app e /gallery in 500

La query delle card incorporava l'origine del remix con `gallery_items!gallery_items_remixed_from_fkey`:
su una self-join PostgREST non risolve il nome del vincolo (PGRST200), quindi ogni lettura della
galleria falliva e con lei /app. Ora l'hint è la colonna, `!remixed_from`.

La policy di lettura valeva per `anon` e chiamava `auth_org_ids()`, che `anon` non può eseguire:
un visitatore senza sessione riceveva 42501. Divisa in due: `anon` legge solo published/unlisted.
