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
			uniform float cardAspect;
			uniform float mediaAspect;
			uniform float fit;
			uniform vec2 focus;
			uniform float solid;
			varying vec2 mediaUv;
			vec2 cropped(vec2 uv) {
				float r = cardAspect / max(mediaAspect, 0.0001);
				vec2 span = r > 1.0 ? vec2(1.0, 1.0 / r) : vec2(r, 1.0);
				if (fit > 0.5) {
					span = r > 1.0 ? vec2(r, 1.0) : vec2(1.0, 1.0 / r);
					return (uv - 0.5) * span + 0.5;
				}
				vec2 start = clamp(focus - span * 0.5, vec2(0.0), vec2(1.0) - span);
				return start + uv * span;
			}
			void main() {
				vec2 size = cardAspect >= 1.0 ? vec2(cardAspect, 1.0) : vec2(1.0, 1.0 / cardAspect);
				vec2 point = (mediaUv - 0.5) * size;
				vec2 edge = abs(point) - (size * 0.5 - radius);
				float distanceToEdge = length(max(edge, 0.0)) + min(max(edge.x, edge.y), 0.0) - radius;
				float mask = 1.0 - smoothstep(-0.008, 0.008, distanceToEdge);
				vec2 uv = cropped(mediaUv);
				float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
				vec4 media = hasTexture > 0.5 ? texture2D(mediaTexture, clamp(uv, 0.0, 1.0)) * inside : vec4(0.12, 0.12, 0.14, 1.0);
				if (solid > 0.5) media = vec4(1.0);
				if (media.a * mask * opacity < 0.02) discard;
				gl_FragColor = vec4(media.rgb, media.a * mask * opacity);
			}
		`;
