begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.product_events drop constraint if exists product_events_event_check;

alter table public.product_events add constraint product_events_event_check check (event in (
  'landing_prompt_sent', 'login_started', 'signup_completed', 'handoff_resumed', 'canvas_created',
  'agent_started', 'agent_first_output', 'agent_failed', 'credits_exhausted', 'import_failed',
  'canvas_perf'
)) not valid;

alter table public.product_events validate constraint product_events_event_check;

create or replace view public.canvas_perf_sessions with (security_invoker = true) as
select id,
       created_at,
       user_id,
       props->>'canvasId' as canvas_id,
       props->>'device' as device,
       props->>'backend' as backend,
       (props->>'fallbacks')::int as fallbacks,
       (props->>'deviceLost')::int as device_lost,
       (props->>'frames')::int as frames,
       (props->>'nodes')::int as nodes,
       (props->>'docBytes')::bigint as doc_bytes,
       (props->>'sessionMs')::bigint as session_ms,
       (props->'load'->>'firstContent')::numeric as first_content_ms,
       (props->'load'->>'allFrames')::numeric as all_frames_ms,
       (props->'load'->>'sharp')::numeric as sharp_ms,
       (props->'edit'->>'p50')::numeric as edit_p50_ms,
       (props->'edit'->>'p95')::numeric as edit_p95_ms,
       props->'gestures' as gestures
from public.product_events
where event = 'canvas_perf';

revoke all on public.canvas_perf_sessions from anon, authenticated;

commit;
