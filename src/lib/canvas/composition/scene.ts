import * as THREE from 'three';
import { CAMERA_PRESETS, type CameraPresetId } from './camera';
import { LAYOUTS } from './index';
import { instancesOf, poseAt, type PoseInput } from './pose';
import { MEDIA_FRAGMENT_SHADER, MEDIA_UNIFORMS, MEDIA_VERTEX_SHADER } from './shader';
import type { LayoutId, LayoutParams } from './types';

export type MediaKind = 'image' | 'video';

export type CompositionMedia = {
	url: string;
	kind: MediaKind;
	aspect: number;
};

export type CompositionSceneOptions = {
	media: CompositionMedia[];
	layout: LayoutId;
	layoutParams: LayoutParams;
	camera: CameraPresetId;
	cameraParams: LayoutParams;
	background: string;
	duration: number;
	onTextureReady?: () => void;
};

export type CompositionScene = {
	renderAt(t: number): void;
	resize(width: number, height: number): void;
	update(options: CompositionSceneUpdate): void;
	dispose(): void;
};

export type CompositionSceneUpdate = Pick<
	CompositionSceneOptions,
	'layout' | 'layoutParams' | 'camera' | 'cameraParams' | 'background' | 'duration'
>;

export function createCompositionScene(canvas: HTMLCanvasElement, options: CompositionSceneOptions): CompositionScene {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	const scene = new THREE.Scene();
	let current = options;
	setCanvasBackground(canvas, current.background);

	const camera = new THREE.PerspectiveCamera(CAMERA_PRESETS[current.camera].cameraAt(current.cameraParams, 0).fov, 1, 0.1, 500);

	const built: BuiltMedia[] = [];
	syncInstances();

	function renderAt(t: number): void {
		const meshes = built.map(({ mesh }) => mesh);
		const pose = poseAt(poseInput(), t, meshes.length);
		for (let i = 0; i < meshes.length; i++) {
			applyTransform(meshes[i], pose.transforms[i]);
		}

		const cameraState = pose.camera;
		camera.position.set(cameraState.position.x, cameraState.position.y, cameraState.position.z);
		camera.lookAt(cameraState.target.x, cameraState.target.y, cameraState.target.z);
		camera.fov = cameraState.fov;
		camera.updateProjectionMatrix();

		for (const { video } of built) {
			if (!video) {
				continue;
			}

			if (video.readyState >= video.HAVE_CURRENT_DATA) {
				video.currentTime = t % (video.duration || 1);
			}
		}

		renderer.render(scene, camera);
	}

	function resize(width: number, height: number): void {
		if (width <= 0 || height <= 0) {
			return;
		}

		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		syncInstances();
	}

	function update(next: CompositionSceneUpdate): void {
		current = { ...current, ...next };
		syncInstances();
		setCanvasBackground(canvas, current.background);
	}

	function dispose(): void {
		for (const item of built) {
			disposeMedia(item);
		}

		renderer.dispose();
	}

	function syncInstances(): void {
		const instances = instancesOf(poseInput());

		while (built.length > instances.length) {
			const item = built.pop();
			if (item) {
				scene.remove(item.mesh);
				disposeMedia(item);
			}
		}

		while (built.length < instances.length) {
			const mediaIndex = instances[built.length];
			const media = current.media[mediaIndex];
			if (!media) {
				break;
			}

			const item = createMesh(media, mediaIndex, current.onTextureReady);
			built.push(item);
			scene.add(item.mesh);
		}

		for (let index = 0; index < built.length; index++) {
			const mediaIndex = instances[index];
			if (built[index].mediaIndex === mediaIndex) {
				continue;
			}

			const media = current.media[mediaIndex];
			if (!media) {
				continue;
			}

			scene.remove(built[index].mesh);
			disposeMedia(built[index]);
			built[index] = createMesh(media, mediaIndex, current.onTextureReady);
			scene.add(built[index].mesh);
		}
	}

	function poseInput(): PoseInput {
		return {
			layout: current.layout,
			layoutParams: current.layoutParams,
			camera: current.camera,
			cameraParams: current.cameraParams,
			duration: current.duration,
			mediaCount: current.media.length,
			aspect: camera.aspect
		};
	}

	return { renderAt, resize, update, dispose };
}

type BuiltMedia = { mesh: THREE.Mesh; video: HTMLVideoElement | null; mediaIndex: number };

function createMesh(
	media: CompositionMedia,
	mediaIndex: number,
	onTextureReady?: () => void
): BuiltMedia {
	const geometry = new THREE.PlaneGeometry(media.aspect, 1);
	const material = createMediaMaterial();
	const mesh = new THREE.Mesh(geometry, material);

	if (media.kind === 'image') {
		const loader = new THREE.TextureLoader();
		loader.setCrossOrigin('anonymous');
		loader.load(media.url, (texture) => {
			configureMediaTexture(texture);
			material.uniforms.mediaTexture.value = texture;
			material.uniforms.hasTexture.value = 1;
			onTextureReady?.();
		});
		return { mesh, video: null, mediaIndex };
	}

	const video = createVideoElement(media.url);
	const texture = new THREE.VideoTexture(video);
	configureMediaTexture(texture);
	material.uniforms.mediaTexture.value = texture;
	material.uniforms.hasTexture.value = 1;
	video.addEventListener('loadeddata', () => onTextureReady?.(), { once: true });
	return { mesh, video, mediaIndex };
}

export function configureMediaTexture(texture: THREE.Texture): void {
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.flipY = false;
	texture.premultiplyAlpha = false;
	texture.needsUpdate = true;
}

function disposeMedia({ mesh, video }: BuiltMedia): void {
	mesh.geometry.dispose();
	const material = mesh.material as THREE.ShaderMaterial;
	const texture = material.uniforms.mediaTexture.value as THREE.Texture | null;
	texture?.dispose();
	material.dispose();

	if (video) {
		video.pause();
		video.removeAttribute('src');
		video.load();
	}
}

function createMediaMaterial(): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		transparent: true,
		side: THREE.DoubleSide,
		depthWrite: true,
		uniforms: {
			mediaTexture: { value: null },
			hasTexture: { value: 0 },
			radius: { value: MEDIA_UNIFORMS.radius },
			opacity: { value: 1 }
		},
		vertexShader: MEDIA_VERTEX_SHADER,
		fragmentShader: MEDIA_FRAGMENT_SHADER
	});
}

function setCanvasBackground(canvas: HTMLCanvasElement, background: string): void {
	canvas.style.background = background;
}

function createVideoElement(url: string): HTMLVideoElement {
	const video = document.createElement('video');
	video.src = url;
	video.crossOrigin = 'anonymous';
	video.muted = true;
	video.loop = true;
	video.playsInline = true;
	video.play().catch(() => {});
	return video;
}

function applyTransform(mesh: THREE.Mesh, transform: ReturnType<(typeof LAYOUTS)[LayoutId]['transforms']>[number]): void {
	mesh.position.set(transform.position.x, transform.position.y, transform.position.z);
	mesh.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
	mesh.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
	(mesh.material as THREE.ShaderMaterial).uniforms.opacity.value = transform.opacity ?? 1;
}
