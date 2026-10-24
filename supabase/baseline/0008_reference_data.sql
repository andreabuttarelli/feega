insert into public.billing_scopes (key) values ('standard'), ('uncensored') on conflict do nothing;

insert into public.feature_flags (key, enabled) values ('uncensored_mode', false), ('social_publishing', false) on conflict do nothing;
