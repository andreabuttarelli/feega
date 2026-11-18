export const SCENE_COMPONENT = `import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type Channel = number | number[];

type Vec3 = [number, number, number];

export type SceneSpec = {
  src: string | null;
  geometry: { kind: string; args: number[] } | null;
  colour: string;
  surface: Record<string, number> | null;
  light: { ambient: number; key: number; fill: number };
  shadow: boolean;
  fps: number;
  frames: number;
  loop: boolean;
  orbit: Channel;
  dolly: Channel;
  fov: Channel;
  rotateX: Channel;
  rotateY: Channel;
  rotateZ: Channel;
  rig: { fit: number; height: number; distance: number; floor: number; key: Vec3; fill: Vec3; near: number; far: number; tilt: Vec3; shapeRoughness: number; shapeMetalness: number; shadowRadius: number; shadowSegments: number; shadowOpacity: number; maxPixelRatio: number };
};

const DEG = Math.PI / 180;

function at(channel: Channel, frame: number): number {
  if (typeof channel === 'number') {
    return channel;
  }
  const last = channel.length - 1;
  const position = Math.min(Math.max(frame, 0), last);
  const index = Math.min(Math.floor(position), last - 1);
  return channel[index] + (channel[index + 1] - channel[index]) * (position - index);
}

function frameAt(spec: SceneSpec, seconds: number): number {
  const frame = seconds * spec.fps;
  return spec.loop ? frame % spec.frames : Math.min(frame, spec.frames);
}

function fitted(root: THREE.Object3D, fit: number): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = fit / Math.max(size.x, size.y, size.z, 1e-6);
  root.scale.multiplyScalar(scale);
  root.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  return root;
}

function dressed(base: THREE.Material, spec: SceneSpec): THREE.Material {
  const own = base as THREE.MeshStandardMaterial;
  return new THREE.MeshPhysicalMaterial({ color: own.color ?? new THREE.Color(spec.colour), map: own.map ?? null, ...spec.surface });
}

function finished(root: THREE.Object3D, spec: SceneSpec): THREE.Object3D {
  if (!spec.surface) {
    return root;
  }
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => dressed(m, spec)) : dressed(mesh.material, spec);
    }
  });
  return root;
}

function Model({ spec }: { spec: SceneSpec }) {
  const gltf = useLoader(GLTFLoader, spec.src!);
  const root = useMemo(() => fitted(finished(gltf.scene.clone(true), spec), spec.rig.fit), [gltf, spec]);
  return <primitive object={root} />;
}

function Shape({ spec }: { spec: SceneSpec }) {
  const root = useMemo(() => {
    const { kind, args } = spec.geometry!;
    const geometry = new (THREE as unknown as Record<string, new (...a: number[]) => THREE.BufferGeometry>)[kind](...args);
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: spec.colour, roughness: spec.rig.shapeRoughness, metalness: spec.rig.shapeMetalness })));
    return finished(group, spec);
  }, [spec]);
  return <primitive object={root} />;
}

function Stage({ spec }: { spec: SceneSpec }) {
  const { rig, light } = spec;
  const pivot = useRef<THREE.Group>(null);
  const object = useRef<THREE.Group>(null);
  useFrame(({ camera, clock }) => {
    const frame = frameAt(spec, clock.elapsedTime);
    const lens = camera as THREE.PerspectiveCamera;
    pivot.current!.rotation.y = at(spec.orbit, frame) * DEG;
    object.current!.rotation.set(at(spec.rotateX, frame) * DEG, at(spec.rotateY, frame) * DEG, at(spec.rotateZ, frame) * DEG);
    lens.position.set(0, rig.height, rig.distance / at(spec.dolly, frame));
    lens.fov = at(spec.fov, frame);
    lens.updateProjectionMatrix();
  });
  return (
    <>
      <ambientLight intensity={light.ambient} />
      <directionalLight intensity={light.key} position={rig.key} />
      <directionalLight intensity={light.fill} position={rig.fill} />
      {spec.shadow && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, rig.floor, 0]}>
          <circleGeometry args={[rig.shadowRadius, rig.shadowSegments]} />
          <meshBasicMaterial color="black" transparent opacity={rig.shadowOpacity} />
        </mesh>
      )}
      <group ref={pivot} rotation={spec.geometry ? rig.tilt : undefined}>
        <group ref={object}>
          <Suspense fallback={null}>{spec.src ? <Model spec={spec} /> : <Shape spec={spec} />}</Suspense>
        </group>
      </group>
    </>
  );
}

export function Scene3D({ scene }: { scene: SceneSpec }) {
  const { rig } = scene;
  return (
    <Canvas flat dpr={[1, rig.maxPixelRatio]} camera={{ fov: at(scene.fov, 0), position: [0, rig.height, rig.distance / at(scene.dolly, 0)], rotation: [0, 0, 0], near: rig.near, far: rig.far }}>
      <Stage spec={scene} />
    </Canvas>
  );
}
`;
