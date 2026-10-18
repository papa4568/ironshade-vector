import { createChamferedBoxGeometry } from './hard-surface-geometry.mjs';

// P28-F2: real, locally generated hard-surface vertices; never byte padding or
// a runtime tessellation modifier. Every added primitive is bound to a live node.
function finish(feature, positions, normals, tangents, uvs, indices) {
  if (positions.length / 3 > 65535) throw new Error(`${feature}: Uint16 vertex range exceeded`);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], positions[i + axis]);
      max[axis] = Math.max(max[axis], positions[i + axis]);
    }
  }
  return {
    feature,
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    tangents: new Float32Array(tangents),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    min, max,
  };
}

// Stepped annulus with a physically open bore and rolled front/rear lips.
// All faces receive valid unit normals, tangent-space vectors, and UV0.
export function createMachinedFlangeGeometry({ outerRadius, innerRadius, height, segments = 56 }) {
  if (!(outerRadius > innerRadius && innerRadius > 0 && height > 0) || segments < 12 || !Number.isInteger(segments)) {
    throw new Error('Invalid refinery machined-flange dimensions');
  }
  const half = height / 2;
  const shoulder = Math.min(height * 0.18, (outerRadius - innerRadius) * 0.32);
  const profile = [
    [innerRadius, -half],
    [outerRadius * 0.78 + innerRadius * 0.22, -half],
    [outerRadius * 0.94, -half + shoulder * 0.42],
    [outerRadius, -half + shoulder],
    [outerRadius, half - shoulder],
    [outerRadius * 0.94, half - shoulder * 0.42],
    [outerRadius * 0.78 + innerRadius * 0.22, half],
    [innerRadius, half],
    [innerRadius, -half],
  ];
  const positions = [], normals = [], tangents = [], uvs = [], indices = [];
  const add = (theta, r, y, normal, u, v) => {
    positions.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
    normals.push(...normal);
    tangents.push(-Math.sin(theta), 0, Math.cos(theta), 1);
    uvs.push(u, v);
    indices.push(indices.length);
  };
  for (let section = 0; section < profile.length - 1; section += 1) {
    const [r0, y0] = profile[section];
    const [r1, y1] = profile[section + 1];
    const dr = r1 - r0, dy = y1 - y0;
    const size = Math.hypot(dr, dy);
    for (let segment = 0; segment < segments; segment += 1) {
      const theta0 = segment * Math.PI * 2 / segments;
      const theta1 = (segment + 1) * Math.PI * 2 / segments;
      const normalAt = theta => [dy * Math.cos(theta) / size, -dr / size, dy * Math.sin(theta) / size];
      const a = [theta0, r0, y0, normalAt(theta0), segment / segments, section / 8];
      const b = [theta0, r1, y1, normalAt(theta0), segment / segments, (section + 1) / 8];
      const c = [theta1, r1, y1, normalAt(theta1), (segment + 1) / segments, (section + 1) / 8];
      const d = [theta1, r0, y0, normalAt(theta1), (segment + 1) / segments, section / 8];
      for (const v of [a, b, c, a, c, d]) add(...v);
    }
  }
  return finish('machined-open-flange', positions, normals, tangents, uvs, indices);
}

// Separate chamfered louver bars, parallel raised ribs, and frame members
// leave open negative space. There is no solid card behind the slits.
export function createRecessedLouverGeometry({ width, height, depth, slats = 11 }) {
  if (!(width > 0 && height > 0 && depth > 0) || !Number.isInteger(slats) || slats < 5) {
    throw new Error('Invalid refinery open-louver dimensions');
  }
  const positions = [], normals = [], tangents = [], uvs = [], indices = [];
  const append = (size, center) => {
    const geom = createChamferedBoxGeometry({
      width: size[0], height: size[1], depth: size[2],
      chamfer: Math.min(...size) * 0.18,
    });
    const base = positions.length / 3;
    for (let i = 0; i < geom.positions.length; i += 3) {
      positions.push(geom.positions[i] + center[0], geom.positions[i + 1] + center[1] - size[1] / 2, geom.positions[i + 2] + center[2]);
    }
    normals.push(...geom.normals);
    tangents.push(...geom.tangents);
    uvs.push(...geom.uvs);
    for (const index of geom.indices) indices.push(base + index);
  };
  const margin = Math.min(width, height) * 0.085;
  const rail = Math.min(width, height) * 0.065;
  for (const side of [-1, 1]) {
    append([rail, height, depth], [side * (width - rail) / 2, 0, 0]);
    append([width - 2 * rail, rail, depth], [0, side * (height - rail) / 2, 0]);
  }
  const step = (height - margin * 2 - rail * 2) / (slats + 1);
  for (let i = 1; i <= slats; i += 1) {
    const y = -height / 2 + margin + rail + i * step;
    const w = width - 2 * (margin + rail);
    // Offset pairs create deep, legible shadow gaps instead of a flat texture.
    append([w, Math.min(step * 0.30, rail * 0.72), depth * 0.55], [0, y, depth * 0.24]);
    if (i % 3 === 0) {
      append([rail * 0.8, step * 0.75, depth * 0.72], [-w * 0.24, y, -depth * 0.10]);
      append([rail * 0.8, step * 0.75, depth * 0.72], [w * 0.24, y, -depth * 0.10]);
    }
  }
  return finish('open-machined-louver', positions, normals, tangents, uvs, indices);
}

const ROTATE_Y_90 = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
const ROTATE_Z_NEG_90 = [0, 0, -Math.SQRT1_2, Math.SQRT1_2];
const ROTATE_X_90 = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];

// Authored on each existing mechanical assembly; coordinates are inside its
// original visual bounds and do not change hitboxes, pivots or cue anchors.
const HERO_DETAILS = Object.freeze({
  processor: {
    label: 'refinery-processor',
    flange: [0.275, 0.207, 0.14, 64],
    ringPlaces: [[-0.62, 2.76, 0.54], [-0.62, 3.28, 0.54]],
    vent: [0.68, 0.70, 0.060, 15],
    ventPlaces: [[[0.99, 1.12, 0.28], ROTATE_Y_90], [[0.99, 1.12, -0.28], ROTATE_Y_90]],
  },
  serviceConduit: {
    label: 'refinery-service-conduit',
    flange: [0.148, 0.108, 0.07, 56],
    ringPlaces: [[-0.68, 0.30, 0], [0.38, 0.30, 0], [0.98, 0.30, 0]],
    ringRotation: ROTATE_Z_NEG_90,
    vent: [0.28, 0.24, 0.045, 9],
    ventPlaces: [[[0.08, 0.63, -0.16], undefined]],
  },
  gantry: {
    label: 'refinery-smelter-gantry',
    flange: [0.205, 0.13, 0.09, 56],
    ringPlaces: [[-1.25, 3.11, 0], [1.25, 3.11, 0]],
    ringRotation: ROTATE_Z_NEG_90,
    vent: [0.34, 0.72, 0.06, 17],
    ventPlaces: [[[-2.59, 1.75, 0.17], undefined], [[2.59, 1.75, 0.17], undefined]],
  },
  floor: {
    label: 'refinery-floor-panel',
    flange: [0.095, 0.052, 0.018, 48],
    ringPlaces: [[-1.63, 0.08, -1.63], [1.63, 0.08, -1.63], [-1.63, 0.08, 1.63], [1.63, 0.08, 1.63]],
    vent: [1.18, 0.58, 0.030, 17],
    ventPlaces: [[[0, 0.08, -0.83], ROTATE_X_90]],
  },
  floorGrate: {
    label: 'refinery-floor-service-grate',
    flange: [0.10, 0.055, 0.018, 48],
    ringPlaces: [[-1.60, 0.12, -1.60], [1.60, 0.12, 1.60]],
    vent: [1.18, 0.68, 0.035, 17],
    ventPlaces: [[[0, 0.12, 0.80], ROTATE_X_90]],
  },
  bulkhead: {
    label: 'refinery-bulkhead',
    flange: [0.11, 0.052, 0.05, 52],
    ringPlaces: [[0.05, 0.43, -1.55], [0.05, 2.46, -1.55], [0.05, 0.43, 1.55], [0.05, 2.46, 1.55]],
    ringRotation: ROTATE_Y_90,
    vent: [0.28, 0.66, 0.05, 15],
    ventPlaces: [[[0.22, 1.36, -1.65], ROTATE_Y_90], [[0.22, 1.36, 1.65], ROTATE_Y_90]],
  },
  wallPanel: {
    label: 'refinery-wall-service-panel',
    flange: [0.078, 0.044, 0.032, 48],
    ringPlaces: [[0.14, 0.39, -0.99], [0.14, 2.15, -0.99], [0.14, 0.39, 0.99], [0.14, 2.15, 0.99]],
    ringRotation: ROTATE_Y_90,
    vent: [0.36, 0.84, 0.048, 19],
    ventPlaces: [[[0.145, 1.32, -0.54], ROTATE_Y_90], [[0.145, 1.32, 0.54], ROTATE_Y_90]],
  },
  pipeRack: {
    label: 'refinery-pipe-rack',
    flange: [0.22, 0.175, 0.075, 64],
    ringPlaces: [[-0.62, 1.12, 0.38], [0.56, 1.12, 0.38], [-0.62, 1.72, -0.38], [0.56, 1.72, -0.38]],
    ringRotation: ROTATE_Z_NEG_90,
    vent: [0.72, 0.30, 0.045, 9],
    ventPlaces: [[[0, 1.42, 0.16], undefined]],
  },
  cableTray: {
    label: 'refinery-cable-tray',
    flange: [0.10, 0.064, 0.035, 48],
    ringPlaces: [[0.02, 0.46, -0.98], [0.02, 0.46, 0.98]],
    ringRotation: ROTATE_X_90,
    vent: [0.38, 0.62, 0.036, 13],
    ventPlaces: [[[0.20, 0.84, -0.40], ROTATE_Y_90], [[0.20, 0.84, 0.40], ROTATE_Y_90]],
  },
  terminal: {
    label: 'refinery-terminal',
    flange: [0.087, 0.052, 0.032, 56],
    ringPlaces: [[0.295, 0.38, 0.23], [0.295, 0.38, -0.23]],
    ringRotation: ROTATE_Y_90,
    vent: [0.40, 0.40, 0.030, 11],
    ventPlaces: [[[-0.26, 0.83, 0], ROTATE_Y_90]],
  },
  crate: {
    label: 'refinery-crate',
    flange: [0.063, 0.031, 0.023, 48],
    ringPlaces: [[0.47, 0.70, 0.31], [0.47, 0.70, -0.31], [-0.45, 0.70, 0.31], [-0.45, 0.70, -0.31]],
    vent: [0.38, 0.24, 0.032, 9],
    ventPlaces: [[[0.535, 0.30, 0], ROTATE_Y_90], [[-0.49, 0.30, 0], ROTATE_Y_90]],
  },
});

export const REFINERY_HERO_DETAIL_FAMILIES = Object.freeze(Object.keys(HERO_DETAILS));

export function appendRefineryHeroDetails(geometries, nodes, family) {
  const spec = HERO_DETAILS[family];
  if (!spec) throw new Error(`Unknown P28-F2 refinery family: ${family}`);
  const base = geometries.length;
  geometries.push(
    {
      meshName: `${spec.label}-lod0-p28f2-machined-flange`,
      geometry: createMachinedFlangeGeometry({
        outerRadius: spec.flange[0], innerRadius: spec.flange[1],
        height: spec.flange[2], segments: spec.flange[3],
      }),
      material: 0,
    },
    {
      meshName: `${spec.label}-lod0-p28f2-open-louver`,
      geometry: createRecessedLouverGeometry({
        width: spec.vent[0], height: spec.vent[1],
        depth: spec.vent[2], slats: spec.vent[3],
      }),
      material: 1,
    },
  );
  spec.ringPlaces.forEach((translation, index) => nodes.push({
    name: `${spec.label}-p28f2-machined-flange-${index + 1}`,
    mesh: base,
    translation,
    ...(spec.ringRotation ? { rotation: spec.ringRotation } : {}),
  }));
  spec.ventPlaces.forEach(([translation, rotation], index) => nodes.push({
    name: `${spec.label}-p28f2-open-louver-${index + 1}`,
    mesh: base + 1,
    translation,
    ...(rotation ? { rotation } : {}),
  }));
}
