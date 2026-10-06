function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  if (length < 1e-8) throw new Error('Cannot normalize a zero-length hard-surface vector');
  return vector.map(value => value / length);
}

function fallbackTangent(normal, edge) {
  const projected = [
    edge[0] - normal[0] * dot(edge, normal),
    edge[1] - normal[1] * dot(edge, normal),
    edge[2] - normal[2] * dot(edge, normal),
  ];
  if (Math.hypot(...projected) > 1e-8) return normalize(projected);
  const axis = Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return normalize(cross(axis, normal));
}

function triangleTangent(p0, p1, p2, uv0, uv1, uv2, normal) {
  const edge1 = subtract(p1, p0);
  const edge2 = subtract(p2, p0);
  const du1 = uv1[0] - uv0[0];
  const dv1 = uv1[1] - uv0[1];
  const du2 = uv2[0] - uv0[0];
  const dv2 = uv2[1] - uv0[1];
  const determinant = du1 * dv2 - dv1 * du2;
  if (Math.abs(determinant) < 1e-8) return fallbackTangent(normal, edge1);
  const inv = 1 / determinant;
  const raw = [
    (edge1[0] * dv2 - edge2[0] * dv1) * inv,
    (edge1[1] * dv2 - edge2[1] * dv1) * inv,
    (edge1[2] * dv2 - edge2[2] * dv1) * inv,
  ];
  return fallbackTangent(normal, raw);
}

function createBuilder(feature) {
  const positions = [];
  const normals = [];
  const tangents = [];
  const uvs = [];
  const indices = [];
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];

  const addTriangle = (points, texcoords) => {
    const edge1 = subtract(points[1], points[0]);
    const edge2 = subtract(points[2], points[0]);
    const normal = normalize(cross(edge1, edge2));
    const tangent = triangleTangent(points[0], points[1], points[2], texcoords[0], texcoords[1], texcoords[2], normal);
    const base = positions.length / 3;
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const point = points[vertex];
      positions.push(...point);
      normals.push(...normal);
      tangents.push(...tangent, 1);
      uvs.push(...texcoords[vertex]);
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], point[axis]);
        max[axis] = Math.max(max[axis], point[axis]);
      }
    }
    indices.push(base, base + 1, base + 2);
  };

  const addQuad = (points, texcoords = [[0, 0], [1, 0], [1, 1], [0, 1]]) => {
    addTriangle([points[0], points[1], points[2]], [texcoords[0], texcoords[1], texcoords[2]]);
    addTriangle([points[0], points[2], points[3]], [texcoords[0], texcoords[2], texcoords[3]]);
  };

  const finish = () => ({
    feature,
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    tangents: new Float32Array(tangents),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    min,
    max,
  });

  return { addTriangle, addQuad, finish };
}

export function createChamferedBoxGeometry({ width = 2.6, height = 0.5, depth = 1.8, chamfer = 0.18 } = {}) {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const bevel = Math.min(chamfer, halfWidth * 0.45, halfDepth * 0.45);
  const ring = [
    [-halfWidth + bevel, -halfDepth],
    [halfWidth - bevel, -halfDepth],
    [halfWidth, -halfDepth + bevel],
    [halfWidth, halfDepth - bevel],
    [halfWidth - bevel, halfDepth],
    [-halfWidth + bevel, halfDepth],
    [-halfWidth, halfDepth - bevel],
    [-halfWidth, -halfDepth + bevel],
  ];
  const builder = createBuilder('chamfered-solid');
  for (let index = 0; index < ring.length; index += 1) {
    const next = (index + 1) % ring.length;
    const [x0, z0] = ring[index];
    const [x1, z1] = ring[next];
    builder.addQuad([[x0, 0, z0], [x0, height, z0], [x1, height, z1], [x1, 0, z1]]);
  }
  const centerBottom = [0, 0, 0];
  const centerTop = [0, height, 0];
  for (let index = 0; index < ring.length; index += 1) {
    const next = (index + 1) % ring.length;
    const [x0, z0] = ring[index];
    const [x1, z1] = ring[next];
    const uv0 = [0.5 + x0 / width, 0.5 + z0 / depth];
    const uv1 = [0.5 + x1 / width, 0.5 + z1 / depth];
    builder.addTriangle([centerTop, [x1, height, z1], [x0, height, z0]], [[0.5, 0.5], uv1, uv0]);
    builder.addTriangle([centerBottom, [x0, 0, z0], [x1, 0, z1]], [[0.5, 0.5], uv0, uv1]);
  }
  return builder.finish();
}

export function createCylinderGeometry({ radius = 0.24, height = 1.3, segments = 20 } = {}) {
  if (!Number.isInteger(segments) || segments < 8) throw new Error(`Cylinder segments must be an integer >= 8; got ${segments}`);
  const builder = createBuilder('cylinder-pipe');
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    const angle0 = (index / segments) * Math.PI * 2;
    const angle1 = (next / segments) * Math.PI * 2;
    const p0 = [Math.cos(angle0) * radius, 0, Math.sin(angle0) * radius];
    const p1 = [Math.cos(angle1) * radius, 0, Math.sin(angle1) * radius];
    const p2 = [p1[0], height, p1[2]];
    const p3 = [p0[0], height, p0[2]];
    const u0 = index / segments;
    const u1 = (index + 1) / segments;
    builder.addQuad([p0, p3, p2, p1], [[u0, 0], [u0, 1], [u1, 1], [u1, 0]]);
    const capUv0 = [0.5 + p0[0] / (radius * 2), 0.5 + p0[2] / (radius * 2)];
    const capUv1 = [0.5 + p1[0] / (radius * 2), 0.5 + p1[2] / (radius * 2)];
    builder.addTriangle([[0, height, 0], p2, p3], [[0.5, 0.5], capUv1, capUv0]);
    builder.addTriangle([[0, 0, 0], p0, p1], [[0.5, 0.5], capUv0, capUv1]);
  }
  return builder.finish();
}

export function createWedgeGeometry({ width = 1.1, height = 0.68, depth = 0.56 } = {}) {
  const x0 = -width / 2;
  const x1 = width / 2;
  const z0 = -depth / 2;
  const z1 = depth / 2;
  const a = [x0, 0, z0];
  const b = [x1, 0, z0];
  const c = [x0, height, z0];
  const d = [x0, 0, z1];
  const e = [x1, 0, z1];
  const f = [x0, height, z1];
  const builder = createBuilder('wedge-extrusion');
  builder.addQuad([a, b, e, d]);
  builder.addQuad([a, d, f, c]);
  builder.addQuad([c, f, e, b]);
  builder.addTriangle([a, c, b], [[0, 0], [0, 1], [1, 0]]);
  builder.addTriangle([d, e, f], [[0, 0], [1, 0], [0, 1]]);
  return builder.finish();
}

export function createInsetPanelGeometry({ width = 1.2, height = 0.82, depth = 0.18, insetWidth = 0.78, insetHeight = 0.46, recess = 0.09 } = {}) {
  const outerX = width / 2;
  const outerY = height / 2;
  const innerX = Math.min(insetWidth / 2, outerX * 0.8);
  const innerY = Math.min(insetHeight / 2, outerY * 0.8);
  const frontZ = depth / 2;
  const backZ = -depth / 2;
  const recessZ = frontZ - Math.min(recess, depth * 0.8);
  const builder = createBuilder('inset-panel');

  builder.addQuad([[-outerX, -outerY, frontZ], [outerX, -outerY, frontZ], [innerX, -innerY, frontZ], [-innerX, -innerY, frontZ]]);
  builder.addQuad([[-innerX, innerY, frontZ], [innerX, innerY, frontZ], [outerX, outerY, frontZ], [-outerX, outerY, frontZ]]);
  builder.addQuad([[-outerX, -outerY, frontZ], [-innerX, -innerY, frontZ], [-innerX, innerY, frontZ], [-outerX, outerY, frontZ]]);
  builder.addQuad([[innerX, -innerY, frontZ], [outerX, -outerY, frontZ], [outerX, outerY, frontZ], [innerX, innerY, frontZ]]);

  builder.addQuad([[-innerX, -innerY, frontZ], [innerX, -innerY, frontZ], [innerX, -innerY, recessZ], [-innerX, -innerY, recessZ]]);
  builder.addQuad([[-innerX, innerY, recessZ], [innerX, innerY, recessZ], [innerX, innerY, frontZ], [-innerX, innerY, frontZ]]);
  builder.addQuad([[-innerX, -innerY, frontZ], [-innerX, -innerY, recessZ], [-innerX, innerY, recessZ], [-innerX, innerY, frontZ]]);
  builder.addQuad([[innerX, -innerY, recessZ], [innerX, -innerY, frontZ], [innerX, innerY, frontZ], [innerX, innerY, recessZ]]);
  builder.addQuad([[-innerX, -innerY, recessZ], [innerX, -innerY, recessZ], [innerX, innerY, recessZ], [-innerX, innerY, recessZ]]);

  builder.addQuad([[outerX, -outerY, backZ], [-outerX, -outerY, backZ], [-outerX, outerY, backZ], [outerX, outerY, backZ]]);
  builder.addQuad([[-outerX, -outerY, backZ], [outerX, -outerY, backZ], [outerX, -outerY, frontZ], [-outerX, -outerY, frontZ]]);
  builder.addQuad([[-outerX, outerY, backZ], [-outerX, outerY, frontZ], [outerX, outerY, frontZ], [outerX, outerY, backZ]]);
  builder.addQuad([[-outerX, -outerY, backZ], [-outerX, -outerY, frontZ], [-outerX, outerY, frontZ], [-outerX, outerY, backZ]]);
  builder.addQuad([[outerX, -outerY, backZ], [outerX, outerY, backZ], [outerX, outerY, frontZ], [outerX, -outerY, frontZ]]);
  return builder.finish();
}

export const HARD_SURFACE_REFERENCE_FEATURES = Object.freeze([
  'chamfered-solid',
  'cylinder-pipe',
  'wedge-extrusion',
  'inset-panel',
]);
