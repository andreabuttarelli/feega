alter table public.ai_models
  add column if not exists released_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists context_length integer,
  add column if not exists intelligence_index numeric;

comment on column public.ai_models.released_at is
  'OpenRouter `created`: when the model was published. Drives the recommended-models recency score.';
comment on column public.ai_models.expires_at is
  'OpenRouter `expiration_date`: a model past it is never recommended.';
comment on column public.ai_models.context_length is
  'OpenRouter `context_length` (chat only): capability signal for text recommendations.';
comment on column public.ai_models.intelligence_index is
  'OpenRouter `benchmarks.artificial_analysis.intelligence_index` (chat only): quality signal for text recommendations.';
