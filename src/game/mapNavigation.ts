import type { LocationId } from './campaign';
import type { CombatObject, SimState, Vec2 } from './sim';

export type NavigationRoute = { id: string; kind: 'primary' | 'secondary' | 'connector'; points: Vec2[] };
export type NavigationLandmark = { id: string; label: string; x: number; y: number; scale?: number };
export type MapNavigationPlan = { routes: NavigationRoute[]; landmarks: NavigationLandmark[] };

const point = (x: number, y: number): Vec2 => ({ x, y });

const sharedRoutes = (variant: number): NavigationRoute[] => {
  const upper = 300 + variant * 14;
  const middle = 515 - variant * 8;
  const lower = 745 + variant * 10;
  return [
    { id: 'primary-spine', kind: 'primary', points: [point(250, middle), point(650, middle), point(1030, middle), point(1400, middle), point(1730, middle), point(2110, middle)] },
    { id: 'upper-loop', kind: 'secondary', points: [point(330, middle), point(430, upper), point(870, upper), point(1060, middle), point(1260, upper), point(1430, upper)] },
    { id: 'lower-loop', kind: 'secondary', points: [point(350, middle), point(520, lower), point(930, lower), point(1110, middle), point(1280, lower), point(1430, lower)] },
    { id: 'deep-upper', kind: 'secondary', points: [point(1545, middle), point(1710, upper), point(2100, upper)] },
    { id: 'deep-lower', kind: 'secondary', points: [point(1550, middle), point(1760, lower), point(2110, lower)] },
    { id: 'cross-a', kind: 'connector', points: [point(590, upper), point(590, lower)] },
    { id: 'cross-b', kind: 'connector', points: [point(1160, upper), point(1160, lower)] },
    { id: 'cross-c', kind: 'connector', points: [point(1910, upper), point(1910, lower)] },
  ];
};

const variants: Record<LocationId, number> = {
  'orbital-station': 0,
  'damaged-vessel': -2,
  'asteroid-refinery': 2,
  'spin-habitat': -1,
  'jovian-harvester': 1,
  'ice-mine': -3,
  'solar-yard': 3,
  'lattice-annex': -1,
  'momentum-exchange': 2,
  'cryo-reserve': -2,
  'parallax-array': 1,
};

export function getMapNavigationPlan(location: LocationId): MapNavigationPlan {
  const variant = variants[location] ?? 0;
  const routes = sharedRoutes(variant);
  const labels: Record<LocationId, [string, string, string]> = {
    'orbital-station': ['SPIN ACCESS', 'TRANSFER BAY', 'CRANE WELL'],
    'damaged-vessel': ['FORE HAB', 'CARGO SPINE', 'ENGINE VAULT'],
    'asteroid-refinery': ['CRUSHER DECK', 'ORE TRANSFER', 'REACTOR GANTRY'],
    'spin-habitat': ['RIM HAB', 'SPOKE TRANSIT', 'AXIS HUB'],
    'jovian-harvester': ['PRESSURE LOCK', 'SKIMMER DECK', 'COMPRESSOR CROWN'],
    'ice-mine': ['ACCESS BORE', 'EXTRACTION TUNNEL', 'SUBGLACIAL VAULT'],
    'solar-yard': ['SHADE GANTRY', 'FABRICATION SPINE', 'SUNWARD YARD'],
    'lattice-annex': ['METROLOGY RING', 'REFERENCE GALLERY', 'SAMPLE VAULT'],
    'momentum-exchange': ['BRAKE DECK', 'TRANSFER TUNNEL', 'COUNTERMASS CRADLE'],
    'cryo-reserve': ['SERVICE COLLAR', 'PROPELLANT GALLERY', 'UMBRA TANK FARM'],
    'parallax-array': ['NEAR BASELINE', 'CROSS-TRACK GALLERY', 'DEEP REFERENCE'],
  };
  const [a, b, c] = labels[location];
  return {
    routes,
    landmarks: [
      { id: 'zone-a', label: a, x: 455, y: 205, scale: 1 },
      { id: 'zone-b', label: b, x: 1100, y: 205, scale: 1 },
      { id: 'zone-c', label: c, x: 1860, y: 205, scale: 1 },
    ],
  };
}

export function solidNavigationObject(object: CombatObject) {
  return object.active && (object.kind === 'cover' || object.kind === 'conduit' || object.kind === 'coolant' || object.kind === 'breachPlate' || object.kind === 'anchorNode');
}

function distancePointToSegment(pointValue: Vec2, a: Vec2, b: Vec2) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 <= 0.001) return Math.hypot(pointValue.x - a.x, pointValue.y - a.y);
  const t = Math.max(0, Math.min(1, ((pointValue.x - a.x) * vx + (pointValue.y - a.y) * vy) / len2));
  return Math.hypot(pointValue.x - (a.x + vx * t), pointValue.y - (a.y + vy * t));
}

function rectRouteDistance(object: CombatObject, a: Vec2, b: Vec2) {
  const samples = [
    point(object.x, object.y),
    point(object.x + object.w, object.y),
    point(object.x, object.y + object.h),
    point(object.x + object.w, object.y + object.h),
    point(object.x + object.w / 2, object.y + object.h / 2),
  ];
  return Math.min(...samples.map(sample => distancePointToSegment(sample, a, b)));
}

export function reserveNavigationLanes(state: SimState, location: LocationId) {
  const plan = getMapNavigationPlan(location);
  const protectedIds = new Set(['boss-gate', 'boss-seal', 'service-plate', 'door-control', 'gravity-control', 'service-seal', 'boarding-lock', 'grid-isolator-a', 'grid-isolator-b', 'gravity-control-a', 'gravity-control-b', 'salvage-node-a', 'salvage-node-b', 'salvage-node-c', 'capture-drum-a', 'capture-drum-b', 'purge-valve-a', 'purge-valve-b', 'reference-node-a', 'reference-node-b', 'reference-node-c', 'mega-optional-cache']);
  const routes = plan.routes.filter(route => route.kind !== 'connector');
  let relocationIndex = 0;
  const pads = [
    point(500, 215), point(690, 800), point(920, 210), point(1080, 800), point(1300, 215), point(1410, 800),
    point(1710, 215), point(1780, 800), point(2020, 225), point(2110, 785),
  ];

  for (const object of state.objects) {
    if (!solidNavigationObject(object) || protectedIds.has(object.id) || object.id.startsWith('enemy-tether') || object.id.startsWith('foundry-anchor') || object.id.startsWith('field-anchor') || object.id.startsWith('lattice-reference')) continue;
    let tooClose = false;
    for (const route of routes) {
      for (let index = 0; index < route.points.length - 1; index += 1) {
        if (rectRouteDistance(object, route.points[index], route.points[index + 1]) < 78) { tooClose = true; break; }
      }
      if (tooClose) break;
    }
    if (!tooClose) continue;
    const pad = pads[relocationIndex % pads.length];
    relocationIndex += 1;
    object.x = Math.max(120, Math.min(2180 - object.w, pad.x - object.w / 2));
    object.y = Math.max(175, Math.min(900 - object.h, pad.y - object.h / 2));
    if (object.w > 150) object.w = 150;
    if (object.h > 150) object.h = 150;
  }
}

export type NavigationAudit = { reachable: boolean; reachableObjectives: number; objectiveCount: number; reachableRatio: number; visitedCells: number; totalWalkableCells: number };

export function auditNavigation(state: SimState, objectives: CombatObject[] = []): NavigationAudit {
  const cell = 44;
  const clearance = 31;
  const minX = 105;
  const maxX = 2215;
  const minY = 185;
  const maxY = 915;
  const cols = Math.floor((maxX - minX) / cell) + 1;
  const rows = Math.floor((maxY - minY) / cell) + 1;
  const solids = state.objects.filter(solidNavigationObject).filter(object => object.id !== 'boss-gate');
  const blocked = (x: number, y: number) => solids.some(object => x >= object.x - clearance && x <= object.x + object.w + clearance && y >= object.y - clearance && y <= object.y + object.h + clearance);
  const key = (cx: number, cy: number) => cy * cols + cx;
  const cellPoint = (cx: number, cy: number) => point(minX + cx * cell, minY + cy * cell);
  let startX = Math.round((state.player.x - minX) / cell);
  let startY = Math.round((state.player.y - minY) / cell);
  startX = Math.max(0, Math.min(cols - 1, startX));
  startY = Math.max(0, Math.min(rows - 1, startY));
  const queue: Array<[number, number]> = [];
  const visited = new Set<number>();
  const start = cellPoint(startX, startY);
  if (!blocked(start.x, start.y)) {
    queue.push([startX, startY]);
    visited.add(key(startX, startY));
  }
  for (let index = 0; index < queue.length; index += 1) {
    const [cx, cy] = queue[index];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const id = key(nx, ny);
      if (visited.has(id)) continue;
      const p = cellPoint(nx, ny);
      if (blocked(p.x, p.y)) continue;
      visited.add(id);
      queue.push([nx, ny]);
    }
  }
  let totalWalkableCells = 0;
  for (let cy = 0; cy < rows; cy += 1) for (let cx = 0; cx < cols; cx += 1) {
    const p = cellPoint(cx, cy);
    if (!blocked(p.x, p.y)) totalWalkableCells += 1;
  }
  let reachableObjectives = 0;
  for (const objective of objectives) {
    const ox = objective.x + objective.w / 2;
    const oy = objective.y + objective.h / 2;
    let reachable = false;
    for (let cy = 0; cy < rows && !reachable; cy += 1) for (let cx = 0; cx < cols; cx += 1) {
      if (!visited.has(key(cx, cy))) continue;
      const p = cellPoint(cx, cy);
      if (Math.hypot(p.x - ox, p.y - oy) <= 110 + Math.max(objective.w, objective.h) / 2) { reachable = true; break; }
    }
    if (reachable) reachableObjectives += 1;
  }
  const objectiveCount = objectives.length;
  const reachableRatio = totalWalkableCells > 0 ? visited.size / totalWalkableCells : 0;
  return { reachable: visited.size > 0 && reachableObjectives === objectiveCount, reachableObjectives, objectiveCount, reachableRatio, visitedCells: visited.size, totalWalkableCells };
}
