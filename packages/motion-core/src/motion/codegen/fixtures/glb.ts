type Part = { size: [number, number, number]; at: [number, number, number]; colour: [number, number, number] };

const PARTS: Part[] = [
  { size: [1.6, 0.3, 1], at: [0, 0, 0], colour: [0.85, 0.85, 0.82] },
  { size: [0.4, 1, 0.4], at: [-0.5, 0.65, 0], colour: [0.31, 0.27, 0.9] },
  { size: [0.5, 0.5, 0.5], at: [0.45, 0.4, 0.1], colour: [0.95, 0.45, 0.2] }
];

const FACES: { normal: [number, number, number]; corners: [number, number, number][] }[] = [
  { normal: [1, 0, 0], corners: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
  { normal: [-1, 0, 0], corners: [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]] },
  { normal: [0, 1, 0], corners: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { normal: [0, -1, 0], corners: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  { normal: [0, 0, 1], corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { normal: [0, 0, -1], corners: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] }
];

const CORNER_ORDER = [0, 1, 2, 0, 2, 3];
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const MAGIC = 0x46546c67;
const FLOAT = 5126;
const SHORT = 5123;
const ARRAY_BUFFER = 34962;
const ELEMENT_BUFFER = 34963;

const padded = (bytes: Uint8Array, fill: number) => {
  const out = new Uint8Array(Math.ceil(bytes.length / 4) * 4).fill(fill);
  out.set(bytes);
  return out;
};

export function toyGlb(): Uint8Array {
  const positions: number[] = [];
  const normals: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];
  for (const part of PARTS) {
    for (const face of FACES) {
      const base = positions.length / 3;
      for (const c of face.corners) {
        positions.push(...c.map((v, i) => (v * part.size[i]) / 2 + part.at[i]));
        normals.push(...face.normal);
        colours.push(...part.colour);
      }
      indices.push(...CORNER_ORDER.map((i) => base + i));
    }
  }
  const pos = new Uint8Array(new Float32Array(positions).buffer);
  const nor = new Uint8Array(new Float32Array(normals).buffer);
  const col = new Uint8Array(new Float32Array(colours).buffer);
  const idx = padded(new Uint8Array(new Uint16Array(indices).buffer), 0);
  const bin = new Uint8Array([...pos, ...nor, ...col, ...idx]);
  const count = positions.length / 3;
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, indices: 3, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.6 } }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: pos.length, target: ARRAY_BUFFER },
      { buffer: 0, byteOffset: pos.length, byteLength: nor.length, target: ARRAY_BUFFER },
      { buffer: 0, byteOffset: pos.length + nor.length, byteLength: col.length, target: ARRAY_BUFFER },
      { buffer: 0, byteOffset: pos.length + nor.length + col.length, byteLength: indices.length * 2, target: ELEMENT_BUFFER }
    ],
    accessors: [
      { bufferView: 0, componentType: FLOAT, count, type: 'VEC3', min: [-0.8, -0.15, -0.5], max: [0.8, 1.15, 0.5] },
      { bufferView: 1, componentType: FLOAT, count, type: 'VEC3' },
      { bufferView: 2, componentType: FLOAT, count, type: 'VEC3' },
      { bufferView: 3, componentType: SHORT, count: indices.length, type: 'SCALAR' }
    ]
  };
  const jsonBytes = padded(new TextEncoder().encode(JSON.stringify(json)), 0x20);
  const total = 12 + 8 + jsonBytes.length + 8 + bin.length;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, CHUNK_JSON, true);
  out.set(jsonBytes, 20);
  const at = 20 + jsonBytes.length;
  view.setUint32(at, bin.length, true);
  view.setUint32(at + 4, CHUNK_BIN, true);
  out.set(bin, at + 8);
  return out;
}
