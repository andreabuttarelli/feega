import React, { useContext, useEffect, useState } from 'react';
import { ThreeCanvas } from '@remotion/three';
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion';
import { Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ThreeElements } from '@react-three/fiber';
import { resolveColor } from '../brand';
import { angleAt, boxOf } from '../layout';
import { Kit, type PropsOf } from './kit';

const TARGET_HEIGHT = 2;
const CAMERA_DISTANCE = 4.6;
const CAMERA_LIFT = 0.3;
const FOV = 35;
const SHADOW_Y = -1.05;
const DEG = Math.PI / 180;

type Light = { ambient: number; key: number; fill: number };

const LIGHTING: Record<PropsOf<'Model3D'>['lighting'], Light> = {
  studio: { ambient: 2.6, key: 3, fill: 1 },
  soft: { ambient: 3.4, key: 1.2, fill: 1.2 },
  dramatic: { ambient: 0.6, key: 5, fill: 0.2 }
};

const BACKDROP: Record<PropsOf<'Model3D'>['backdrop'], string | null> = {
  transparent: null,
  brand: 'brand.background',
  dark: '#0a0a0a',
  light: '#f5f5f3'
};

function useModel(url: string | null): Group | null {
  const [scene, setScene] = useState<Group | null>(null);

  useEffect(() => {
    if (!url) {
      return;
    }

    const handle = delayRender('Loading 3D model');
    new GLTFLoader().load(
      url,
      (gltf) => {
        const root = gltf.scene;
        const size = new Box3().setFromObject(root).getSize(new Vector3());
        const center = new Box3().setFromObject(root).getCenter(new Vector3());
        const scale = TARGET_HEIGHT / Math.max(size.x, size.y, size.z, 1e-6);
        root.scale.setScalar(scale);
        root.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        const pivot = new Group();
        pivot.add(root);
        setScene(pivot);
        continueRender(handle);
      },
      undefined,
      () => continueRender(handle)
    );
  }, [url]);

  return scene;
}

type Camera = PropsOf<'Model3D'>;

const Stage: React.FC<{ p: Camera | PropsOf<'Shape3D'>; children: (angle: number) => React.ReactNode }> = ({ p, children }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const { tokens } = useContext(Kit);
  const box = boxOf(p, { width, height });
  const light = LIGHTING[p.lighting];
  const backdrop = BACKDROP[p.backdrop];
  const angle = angleAt(p, frame, durationInFrames, fps) * DEG;

  return (
    <AbsoluteFill style={{ background: backdrop ? resolveColor(backdrop, tokens) : 'transparent' }}>
      <div style={{ position: 'absolute', ...box }}>
        <ThreeCanvas width={Math.round(box.width)} height={Math.round(box.height)} camera={{ position: [0, CAMERA_LIFT, CAMERA_DISTANCE / p.zoom], fov: FOV }}>
          <ambientLight intensity={light.ambient} />
          <directionalLight position={[3, 4, 5]} intensity={light.key} />
          <directionalLight position={[-4, 2, -3]} intensity={light.fill} />
          {p.shadow ? <ContactShadow /> : null}
          {children(angle)}
        </ThreeCanvas>
      </div>
    </AbsoluteFill>
  );
};

const ContactShadow: React.FC = () => {
  const props: ThreeElements['mesh'] = { rotation: [-Math.PI / 2, 0, 0], position: [0, SHADOW_Y, 0] };
  return (
    <mesh {...props}>
      <circleGeometry args={[1.1, 48]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.22} />
    </mesh>
  );
};

const ModelScene: React.FC<{ p: Camera }> = ({ p }) => {
  const url = useContext(Kit).assetUrl(p.assetId);
  const scene = useModel(url);
  return <Stage p={p}>{(angle) => (scene ? <primitive object={scene} rotation={[0.1, angle, 0]} /> : null)}</Stage>;
};

const GEOMETRY: Record<PropsOf<'Shape3D'>['shape'], () => React.ReactNode> = {
  cube: () => <boxGeometry args={[1.4, 1.4, 1.4]} />,
  sphere: () => <sphereGeometry args={[0.95, 64, 64]} />,
  torus: () => <torusGeometry args={[0.8, 0.32, 48, 128]} />,
  cone: () => <coneGeometry args={[0.9, 1.6, 64]} />
};

const ShapeScene: React.FC<{ p: PropsOf<'Shape3D'> }> = ({ p }) => {
  const color = resolveColor(p.fill, useContext(Kit).tokens);
  return (
    <Stage p={p}>
      {(angle) => (
        <mesh rotation={[0.35, angle, 0.1]}>
          {GEOMETRY[p.shape]()}
          <meshStandardMaterial color={color} roughness={0.35} metalness={0.1} />
        </mesh>
      )}
    </Stage>
  );
};

type ThreeProps = { kind: 'model'; p: Camera } | { kind: 'shape'; p: PropsOf<'Shape3D'> };

export default function ThreeKit(props: ThreeProps) {
  return props.kind === 'model' ? <ModelScene p={props.p} /> : <ShapeScene p={props.p} />;
}
