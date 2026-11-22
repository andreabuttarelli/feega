begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

insert into public.plugins (id, name, summary, author, tier, latest_version, manifest)
values
  (
    'mesh-gradient',
    'Mesh gradient',
    'Drag colour points over an element and get a plain CSS mesh gradient.',
    'Feega',
    'free',
    '1.0.0',
    '{"id":"feega.mesh-gradient","name":"Mesh gradient","version":"1.0.0","permissions":["selection","edit.style"],"contributions":{"rightBar":[{"id":"mesh","title":"Mesh gradient"}],"overlay":[{"id":"points"}]}}'::jsonb
  ),
  (
    '3d-object',
    '3D object',
    'Add a cube, sphere, torus knot, 3D text or a .glb model and edit its material and lights.',
    'Feega',
    'free',
    '1.0.0',
    '{"id":"feega.object-3d","name":"3D object","version":"1.0.0","permissions":["selection","project","edit.insert","edit.attributes","edit.dependency","edit.asset","file.pick"],"contributions":{"addMenu":[{"id":"shape:cube","title":"Cube","category":"3D object"},{"id":"shape:sphere","title":"Sphere","category":"3D object"},{"id":"shape:torus","title":"Torus knot","category":"3D object"},{"id":"shape:text","title":"3D text","category":"3D object"},{"id":"shape:model","title":"Model (.glb)…","category":"3D object"}],"rightBar":[{"id":"scene","title":"3D object"}]}}'::jsonb
  )
on conflict (id) do update
set
  name = excluded.name,
  summary = excluded.summary,
  author = excluded.author,
  tier = excluded.tier,
  latest_version = excluded.latest_version,
  manifest = excluded.manifest,
  updated_at = now();

commit;
