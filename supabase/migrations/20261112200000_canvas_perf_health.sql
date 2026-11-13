begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

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
       props->'gestures' as gestures,
       props->>'sessionId' as session_id,
       props->>'platform' as platform,
       props->>'reason' as reason,
       (props->>'visible')::int as visible,
       (props->>'width')::int as width,
       (props->>'height')::int as height,
       (props->>'diedBefore')::int as died_before,
       props->>'lastError' as last_error,
       (props->'limits'->>'maxTexture')::int as max_texture,
       (props->'memory'->>'textureMb')::numeric as texture_mb,
       (props->'memory'->>'wasmMb')::numeric as wasm_mb,
       props->'before' as before
from public.product_events
where event = 'canvas_perf';

revoke all on public.canvas_perf_sessions from anon, authenticated;

commit;
