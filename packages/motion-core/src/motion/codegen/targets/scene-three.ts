export const SCENE_RUNTIME = `const DEG = Math.PI / 180;

function at(channel, frame) {
  if (typeof channel === 'number') {
    return channel;
  }
  const last = channel.length - 1;
  const position = Math.min(Math.max(frame, 0), last);
  const index = Math.min(Math.floor(position), last - 1);
  return channel[index] + (channel[index + 1] - channel[index]) * (position - index);
}

function frameAt(spec, seconds) {
  const frame = seconds * spec.fps;
  return spec.loop ? frame % spec.frames : Math.min(frame, spec.frames);
}

function fitted(root, rig) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = rig.fit / Math.max(size.x, size.y, size.z, 1e-6);
  root.scale.multiplyScalar(scale);
  root.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  return root;
}

function dressed(base, spec) {
  return new THREE.MeshPhysicalMaterial({ color: base && base.color ? base.color : new THREE.Color(spec.colour), map: base ? base.map : null, ...spec.surface });
}

function finished(root, spec) {
  if (!spec.surface) {
    return root;
  }
  root.traverse((object) => {
    if (object.isMesh) {
      object.material = Array.isArray(object.material) ? object.material.map((m) => dressed(m, spec)) : dressed(object.material, spec);
    }
  });
  return root;
}

function shapeOf(spec) {
  const { rig } = spec;
  const mesh = new THREE.Mesh(new THREE[spec.geometry.kind](...spec.geometry.args), new THREE.MeshStandardMaterial({ color: spec.colour, roughness: rig.shapeRoughness, metalness: rig.shapeMetalness }));
  const root = new THREE.Group();
  root.add(mesh);
  return finished(root, spec);
}

function stage(spec) {
  const { rig, light } = spec;
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, light.ambient));
  const key = new THREE.DirectionalLight(0xffffff, light.key);
  key.position.set(...rig.key);
  const fill = new THREE.DirectionalLight(0xffffff, light.fill);
  fill.position.set(...rig.fill);
  scene.add(key, fill);
  if (spec.shadow) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(rig.shadowRadius, rig.shadowSegments), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: rig.shadowOpacity }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = rig.floor;
    scene.add(disc);
  }
  const pivot = new THREE.Group();
  const object = new THREE.Group();
  pivot.add(object);
  scene.add(pivot);
  if (spec.geometry) {
    pivot.rotation.set(...rig.tilt);
  }
  return { scene, pivot, object };
}

function mountScene(el, spec) {
  const { rig } = spec;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  el.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, rig.maxPixelRatio));
  const { scene, pivot, object } = stage(spec);
  const camera = new THREE.PerspectiveCamera(at(spec.fov, 0), 1, rig.near, rig.far);
  if (spec.src) {
    new GLTFLoader().load(spec.src, (gltf) => object.add(fitted(finished(gltf.scene, spec), rig)));
  } else {
    object.add(shapeOf(spec));
  }
  const resize = () => {
    if (el.clientWidth && el.clientHeight) {
      renderer.setSize(el.clientWidth, el.clientHeight, false);
      camera.aspect = el.clientWidth / el.clientHeight;
    }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(el);
  resize();
  const start = performance.now();
  renderer.setAnimationLoop(() => {
    const frame = frameAt(spec, (performance.now() - start) / 1000);
    pivot.rotation.y = at(spec.orbit, frame) * DEG;
    object.rotation.set(at(spec.rotateX, frame) * DEG, at(spec.rotateY, frame) * DEG, at(spec.rotateZ, frame) * DEG);
    camera.position.set(0, rig.height, rig.distance / at(spec.dolly, frame));
    camera.fov = at(spec.fov, frame);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  });
  return () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    renderer.dispose();
    canvas.remove();
  };
}
`;
