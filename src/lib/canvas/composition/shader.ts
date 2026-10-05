export const MEDIA_UNIFORMS = { radius: 0.075 } as const;

export const MEDIA_VERTEX_SHADER = `
			varying vec2 mediaUv;
			void main() {
				mediaUv = vec2(uv.x, 1.0 - uv.y);
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`;

export const MEDIA_FRAGMENT_SHADER = `
			uniform sampler2D mediaTexture;
			uniform float hasTexture;
			uniform float radius;
			uniform float opacity;
			varying vec2 mediaUv;
			void main() {
				vec2 edge = abs(mediaUv - 0.5) - (0.5 - radius);
				float distanceToEdge = length(max(edge, 0.0)) + min(max(edge.x, edge.y), 0.0) - radius;
				float mask = 1.0 - smoothstep(-0.008, 0.008, distanceToEdge);
				vec4 media = hasTexture > 0.5 ? texture2D(mediaTexture, mediaUv) : vec4(0.12, 0.12, 0.14, 1.0);
				if (media.a * mask * opacity < 0.02) discard;
				gl_FragColor = vec4(media.rgb, media.a * mask * opacity);
			}
		`;
