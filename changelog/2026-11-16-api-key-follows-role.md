# API keys follow their owner's current role

API keys run on a service-role client, so the viewers-read-only RLS never applied to them. The
role was read once, at mint time, by the database insert policy only.

- `scopesOfHolder` (`src/lib/server/api-key-holder.ts`) re-derives scopes from `orgs_members` on
  every request, in both key resolvers (`cli-auth.ts`, `org-data/auth.ts`): no membership means
  401, a role that cannot `OrgAction.ManageApiKeys` loses `write`.
- The mint endpoint and the settings action check the same action before inserting, answering 403
  instead of a raw database error. The role table has one new row, `ManageApiKeys`.
- Nothing is revoked on demotion or removal: the key row stays, and works again if the role does.

Not done: revoking keys when a member is removed; moving API keys off the service role.
