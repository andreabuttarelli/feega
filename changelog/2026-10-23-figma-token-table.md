# user_figma_tokens

A Figma personal access token per user, sealed by the app (AES-256-GCM, `APP_SECRET`) before it
reaches the table. Used to fetch images when pasting from Figma. Per user, not per org: the token
is the person's own Figma access. RLS `user_id = auth.uid()`; the API never returns the token.

Not applied by the PR: the coordinator applies it. Code reading it tolerates a missing table.
