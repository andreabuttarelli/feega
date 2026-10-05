export const MEDIA_UNIFORMS = { radius: 0.075 } as const;
export const BEND_SEGMENTS = 24;

export const MEDIA_VERTEX_SHADER = `
			uniform float bend;
			varying vec2 mediaUv;
			void main() {
				mediaUv = vec2(uv.x, 1.0 - uv.y);
				vec3 p = position;
				if (bend > 0.0) {
					float a = p.x / bend;
					p = vec3(bend * sin(a), p.y, p.z + bend * (cos(a) - 1.0));
				}
				gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
			}
		`;

export const MEDIA_FRAGMENT_SHADER = `
			uniform sampler2D mediaTexture;
			uniform float hasTexture;
			uniform float radius;
			uniform float opacity;
			uniform float bend;
			varying vec2 mediaUv;
			void main() {
				vec2 uv = bend > 0.0 && !gl_FrontFacing ? vec2(1.0 - mediaUv.x, mediaUv.y) : mediaUv;
				vec2 edge = abs(uv - 0.5) - (0.5 - radius);
				float distanceToEdge = length(max(edge, 0.0)) + min(max(edge.x, edge.y), 0.0) - radius;
				float mask = 1.0 - smoothstep(-0.008, 0.008, distanceToEdge);
				vec4 media = hasTexture > 0.5 ? texture2D(mediaTexture, uv) : vec4(0.12, 0.12, 0.14, 1.0);
				if (media.a * mask * opacity < 0.02) discard;
				gl_FragColor = vec4(media.rgb, media.a * mask * opacity);
			}
		`;
