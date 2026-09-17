const locations$1 = [
  { id: "orbital-station", name: "Orbital Industrial Station" },
  { id: "damaged-vessel", name: "Damaged Freight Vessel" },
  { id: "asteroid-refinery", name: "Asteroid Refinery" },
  { id: "spin-habitat", name: "Rotating Spin Habitat" },
  { id: "jovian-harvester", name: "Jovian Gas-Harvester Platform" },
  { id: "ice-mine", name: "Subsurface Ice-Mining Installation" },
  { id: "solar-yard", name: "Solar-Orbit Fabrication Yard" }
];
function locationNameFor(id) {
  var _a;
  return ((_a = locations$1.find((location) => location.id === id)) == null ? void 0 : _a.name) ?? (id === "lattice-annex" ? "Khepri Survey Annex" : id === "momentum-exchange" ? "Cislunar Momentum Exchange" : id === "cryo-reserve" ? "Umbra Cryogenic Propellant Reserve" : id);
}
function authoredObjective(location, mode) {
  var _a;
  const copy = {
    "spin-habitat": {
      "pressure-recovery": { objective: "Seal a rim pressure leak before emergency spindown drags atmosphere toward the axis.", steps: ["Cross the rotating rim to the pressure manifold.", "Seal the leaking ring segment with ACT.", "Hold through spindown until pressure recovers."] },
      "grid-isolation": { objective: "Isolate the rim and spoke power branches before spin imbalance cascades through the drive bus.", steps: ["Reach both spin-bus isolators.", "Isolate each branch with ACT.", "Clear the ring while the drive bus stabilizes."] },
      "gravity-stabilization": { objective: "Calibrate rim and spoke gravity trims so the habitat survives its emergency spindown cycle.", steps: ["Calibrate the rim gravity trim.", "Calibrate the spoke gravity trim.", "Hold the habitat through the gravity transition."] },
      "machinery-recovery": { objective: "Tag the bearing-control and attitude-flywheel packages without losing them during spindown.", steps: ["Reach both rotating machinery packages.", "Tag each package with ACT.", "Clear the recovery path before extraction."] },
      "emergency-boarding": { objective: "Cycle the spoke and axis pressure locks while the habitat transitions between gravity states.", steps: ["Reach the spoke pressure interlock.", "Cycle the axis pressure lock.", "Break the boarding line and secure the ring."] },
      "deep-salvage": { objective: "Tag recovery caches on the rim, spoke, and axis hub before the next spin transition.", steps: ["Tag the rim recovery cache.", "Tag the spoke recovery cache.", "Tag the axis cache and clear the ring."] }
    },
    "jovian-harvester": {
      "pressure-recovery": { objective: "Seal the storm-deck relief breach before the pressure shear strips the maintenance lane.", steps: ["Reach the storm relief manifold.", "Seal the active deck breach.", "Hold until the maintenance deck repressurizes."] },
      "grid-isolation": { objective: "Isolate both electrostatic harvesting branches before storm charge feeds the damaged grid.", steps: ["Reach the skimmer bus isolator.", "Reach the compressor bus isolator.", "Isolate both branches and clear the deck."] },
      "gravity-stabilization": { objective: "Calibrate both deck mass trims so pressure shear cannot throw the platform out of alignment.", steps: ["Calibrate the maintenance-deck trim.", "Calibrate the compressor-crown trim.", "Hold the platform through the shear window."] },
      "machinery-recovery": { objective: "Tag an intact skimmer compressor and separator package before the storm vent cycle returns.", steps: ["Reach both exposed machinery packages.", "Tag each package with ACT.", "Clear the maintenance route for extraction."] },
      "emergency-boarding": { objective: "Cycle both storm-rated pressure locks and reopen the maintenance route.", steps: ["Cycle the inner storm lock.", "Cycle the outer maintenance lock.", "Clear the boarding line before the next vent pulse."] },
      "deep-salvage": { objective: "Tag three skimmer assemblies distributed across unequal-pressure maintenance decks.", steps: ["Tag the intake package.", "Tag the separator package.", "Tag the compressor package and clear the deck."] }
    },
    "ice-mine": {
      "pressure-recovery": { objective: "Seal a fractured bore pressure line before volatile-rich tunnel gas vents through the mine.", steps: ["Reach the bore pressure manifold.", "Seal the fractured service line.", "Hold until the tunnel pressure margin recovers."] },
      "grid-isolation": { objective: "Isolate both thaw-grid branches before damaged heating lines destabilize the bore walls.", steps: ["Reach both thaw-grid isolators.", "Isolate each heating branch with ACT.", "Clear the tunnel after the grid drops."] },
      "gravity-stabilization": { objective: "Calibrate the haulage and deep-bore gravity trims before the tunnel fracture cycle peaks.", steps: ["Calibrate the haulage trim.", "Calibrate the deep-bore trim.", "Hold the route through the fracture event."] },
      "machinery-recovery": { objective: "Tag the cryobore cutter and volatile separator while brittle tunnel supports remain passable.", steps: ["Reach the cutter package.", "Reach the separator package.", "Tag both and clear the extraction tunnel."] },
      "emergency-boarding": { objective: "Cycle the upper and lower bore locks before brittle supports collapse into the boarding route.", steps: ["Cycle the access-bore lock.", "Cycle the deep-tunnel lock.", "Clear the narrowed boarding route."] },
      "deep-salvage": { objective: "Tag three buried recovery cores along the access bore, extraction tunnel, and subglacial vault.", steps: ["Tag the access-bore cache.", "Tag the extraction-tunnel cache.", "Tag the vault cache and clear the mine."] }
    },
    "solar-yard": {
      "pressure-recovery": { objective: "Seal the radiator-manifold breach before the sunward fabrication spine loses its pressure margin.", steps: ["Reach the radiator pressure manifold.", "Seal the service rupture.", "Hold until the fabrication spine repressurizes."] },
      "grid-isolation": { objective: "Isolate both solar-bus branches before a thermal cycle feeds the exposed fabrication grid.", steps: ["Reach the shade-side bus isolator.", "Reach the sunward bus isolator.", "Isolate both branches and clear the yard."] },
      "gravity-stabilization": { objective: "Calibrate the shade gantry and fabrication-spine gravity trims before thermal expansion shifts the work deck.", steps: ["Calibrate the shade-gantry trim.", "Calibrate the fabrication-spine trim.", "Hold through the solar load window."] },
      "machinery-recovery": { objective: "Tag the mirror actuator and printer spindle before the thermal shutters cycle open again.", steps: ["Reach both fabrication packages.", "Tag each package with ACT.", "Clear the sunward recovery lane."] },
      "emergency-boarding": { objective: "Cycle the shade-side and sunward pressure locks while thermal shutters protect the boarding route.", steps: ["Cycle the shade-side interlock.", "Cycle the sunward interlock.", "Clear the fabrication spine."] },
      "deep-salvage": { objective: "Tag three fabrication packages across shade, spine, and sunward work zones.", steps: ["Tag the shade-gantry package.", "Tag the fabrication-spine package.", "Tag the sunward package and clear the yard."] }
    },
    "momentum-exchange": { "momentum-capture": { objective: "Load both counter-momentum capture drums before the transfer lane dumps its stored impulse.", steps: ["Reach the inbound capture drum and lock its reference.", "Cross the near-zero-g transfer lane to the outbound drum.", "Load both drums with ACT and hold through the next countermass wash."] } },
    "cryo-reserve": { "thermal-routing": { objective: "Route both propellant purge valves so boiloff is rejected away from the occupied service gallery.", steps: ["Reach the first cryogenic purge valve.", "Route the second valve before the next boiloff pulse.", "Hold the tank gallery while the thermal route stabilizes."] } }
  };
  return ((_a = copy[location]) == null ? void 0 : _a[mode]) ?? null;
}
function missionObjectiveFor(mode, location) {
  const authored = authoredObjective(location, mode);
  if (authored) return { mode, ...authored };
  if (mode === "pressure-recovery") return { mode, objective: location === "damaged-vessel" ? "Seal the cargo-spine rupture and restore a breathable pressure margin." : "Seal the active pressure breach and restore a breathable margin.", steps: ["Reach the emergency pressure manifold.", "Seal the active service rupture.", "Hold while atmosphere recovers."] };
  if (mode === "grid-isolation") return { mode, objective: "Isolate both damaged power branches before the control spine cascades.", steps: ["Reach both live grid isolators.", "Isolate each branch with ACT.", "Clear the remaining armed interference."] };
  if (mode === "gravity-stabilization") return { mode, objective: "Calibrate both gravity trims while suppressing interference around the control spine.", steps: ["Reach the deck gravity trim.", "Calibrate the transfer gravity trim.", "Clear hostile interference and bank the contract."] };
  if (mode === "machinery-recovery") return { mode, objective: "Tag two intact industrial assemblies while keeping the recovery lane usable.", steps: ["Reach both tagged machinery packages.", "Use ACT to register each package.", "Clear the recovery lane and choose extraction depth."] };
  if (mode === "emergency-boarding") return { mode, objective: "Cycle both pressure interlocks and break the armed boarding line.", steps: ["Reach the first pressure interlock.", "Cycle the second pressure interlock.", "Clear the boarding line and secure extraction."] };
  if (mode === "momentum-capture") return { mode, objective: "Load both momentum-capture references before the next transfer impulse.", steps: ["Reach both capture controls.", "Lock each reference with ACT.", "Hold through the scheduled momentum wash."] };
  if (mode === "thermal-routing") return { mode, objective: "Route both thermal purge branches away from the occupied work zone.", steps: ["Reach both thermal-routing valves.", "Route each valve with ACT.", "Hold through the next purge cycle."] };
  return { mode, objective: "Tag three recovery packages distributed across the combat deck.", steps: ["Locate three marked recovery packages.", "Tag each package with ACT.", "Clear the hostile line and extract."] };
}
function deepTargetForLocation(location, archetype = "salvage") {
  if (location === "damaged-vessel") return archetype === "boarding" ? "Boarding Chief Serrin" : archetype === "stabilization" ? "Reactor Custodian Ansel" : "Salvage Interdictor Kade";
  if (location === "asteroid-refinery") return "Foundry Marshal Cael";
  if (location === "spin-habitat") return "Recovery Commander Sable Voss";
  if (location === "jovian-harvester") return "Stormline Foreman Ilex";
  if (location === "ice-mine") return "Salvage Captain Rhea Kade";
  if (location === "solar-yard") return "HELIOS-9 Yardmind";
  if (location === "lattice-annex") return "Khepri Recovery Marshal";
  if (location === "momentum-exchange") return "Exchange Interdictor Neris Vane";
  if (location === "cryo-reserve") return "Reserve Custodian Tamas Veer";
  return "Dock Warden Orison";
}
const point$1 = (x, y) => ({ x, y });
const sharedRoutes = (variant) => {
  const upper = 300 + variant * 14;
  const middle = 515 - variant * 8;
  const lower = 745 + variant * 10;
  return [
    { id: "primary-spine", kind: "primary", points: [point$1(250, middle), point$1(650, middle), point$1(1030, middle), point$1(1400, middle), point$1(1730, middle), point$1(2110, middle)] },
    { id: "upper-loop", kind: "secondary", points: [point$1(330, middle), point$1(430, upper), point$1(870, upper), point$1(1060, middle), point$1(1260, upper), point$1(1430, upper)] },
    { id: "lower-loop", kind: "secondary", points: [point$1(350, middle), point$1(520, lower), point$1(930, lower), point$1(1110, middle), point$1(1280, lower), point$1(1430, lower)] },
    { id: "deep-upper", kind: "secondary", points: [point$1(1545, middle), point$1(1710, upper), point$1(2100, upper)] },
    { id: "deep-lower", kind: "secondary", points: [point$1(1550, middle), point$1(1760, lower), point$1(2110, lower)] },
    { id: "cross-a", kind: "connector", points: [point$1(590, upper), point$1(590, lower)] },
    { id: "cross-b", kind: "connector", points: [point$1(1160, upper), point$1(1160, lower)] },
    { id: "cross-c", kind: "connector", points: [point$1(1910, upper), point$1(1910, lower)] }
  ];
};
const variants = {
  "orbital-station": 0,
  "damaged-vessel": -2,
  "asteroid-refinery": 2,
  "spin-habitat": -1,
  "jovian-harvester": 1,
  "ice-mine": -3,
  "solar-yard": 3,
  "lattice-annex": -1,
  "momentum-exchange": 2,
  "cryo-reserve": -2
};
function getMapNavigationPlan(location) {
  const variant = variants[location] ?? 0;
  const routes = sharedRoutes(variant);
  const labels = {
    "orbital-station": ["SPIN ACCESS", "TRANSFER BAY", "CRANE WELL"],
    "damaged-vessel": ["FORE HAB", "CARGO SPINE", "ENGINE VAULT"],
    "asteroid-refinery": ["CRUSHER DECK", "ORE TRANSFER", "REACTOR GANTRY"],
    "spin-habitat": ["RIM HAB", "SPOKE TRANSIT", "AXIS HUB"],
    "jovian-harvester": ["PRESSURE LOCK", "SKIMMER DECK", "COMPRESSOR CROWN"],
    "ice-mine": ["ACCESS BORE", "EXTRACTION TUNNEL", "SUBGLACIAL VAULT"],
    "solar-yard": ["SHADE GANTRY", "FABRICATION SPINE", "SUNWARD YARD"],
    "lattice-annex": ["METROLOGY RING", "REFERENCE GALLERY", "SAMPLE VAULT"],
    "momentum-exchange": ["BRAKE DECK", "TRANSFER TUNNEL", "COUNTERMASS CRADLE"],
    "cryo-reserve": ["SERVICE COLLAR", "PROPELLANT GALLERY", "UMBRA TANK FARM"]
  };
  const [a, b, c] = labels[location];
  return {
    routes,
    landmarks: [
      { id: "zone-a", label: a, x: 455, y: 205, scale: 1 },
      { id: "zone-b", label: b, x: 1100, y: 205, scale: 1 },
      { id: "zone-c", label: c, x: 1860, y: 205, scale: 1 }
    ]
  };
}
function solidNavigationObject(object) {
  return object.active && (object.kind === "cover" || object.kind === "conduit" || object.kind === "coolant" || object.kind === "breachPlate" || object.kind === "anchorNode");
}
function distancePointToSegment(pointValue, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 <= 1e-3) return Math.hypot(pointValue.x - a.x, pointValue.y - a.y);
  const t = Math.max(0, Math.min(1, ((pointValue.x - a.x) * vx + (pointValue.y - a.y) * vy) / len2));
  return Math.hypot(pointValue.x - (a.x + vx * t), pointValue.y - (a.y + vy * t));
}
function rectRouteDistance(object, a, b) {
  const samples = [
    point$1(object.x, object.y),
    point$1(object.x + object.w, object.y),
    point$1(object.x, object.y + object.h),
    point$1(object.x + object.w, object.y + object.h),
    point$1(object.x + object.w / 2, object.y + object.h / 2)
  ];
  return Math.min(...samples.map((sample) => distancePointToSegment(sample, a, b)));
}
function reserveNavigationLanes(state, location) {
  const plan = getMapNavigationPlan(location);
  const protectedIds = /* @__PURE__ */ new Set(["boss-gate", "boss-seal", "service-plate", "door-control", "gravity-control", "service-seal", "boarding-lock", "grid-isolator-a", "grid-isolator-b", "gravity-control-a", "gravity-control-b", "salvage-node-a", "salvage-node-b", "salvage-node-c", "capture-drum-a", "capture-drum-b", "purge-valve-a", "purge-valve-b", "mega-optional-cache"]);
  const routes = plan.routes.filter((route) => route.kind !== "connector");
  let relocationIndex = 0;
  const pads = [
    point$1(500, 215),
    point$1(690, 800),
    point$1(920, 210),
    point$1(1080, 800),
    point$1(1300, 215),
    point$1(1410, 800),
    point$1(1710, 215),
    point$1(1780, 800),
    point$1(2020, 225),
    point$1(2110, 785)
  ];
  for (const object of state.objects) {
    if (!solidNavigationObject(object) || protectedIds.has(object.id) || object.id.startsWith("enemy-tether") || object.id.startsWith("foundry-anchor") || object.id.startsWith("field-anchor") || object.id.startsWith("lattice-reference")) continue;
    let tooClose = false;
    for (const route of routes) {
      for (let index = 0; index < route.points.length - 1; index += 1) {
        if (rectRouteDistance(object, route.points[index], route.points[index + 1]) < 78) {
          tooClose = true;
          break;
        }
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
function auditNavigation(state, objectives = []) {
  const cell = 44;
  const clearance = 31;
  const minX = 105;
  const maxX = 2215;
  const minY = 185;
  const maxY = 915;
  const cols = Math.floor((maxX - minX) / cell) + 1;
  const rows = Math.floor((maxY - minY) / cell) + 1;
  const solids = state.objects.filter(solidNavigationObject).filter((object) => object.id !== "boss-gate");
  const blocked = (x, y) => solids.some((object) => x >= object.x - clearance && x <= object.x + object.w + clearance && y >= object.y - clearance && y <= object.y + object.h + clearance);
  const key = (cx, cy) => cy * cols + cx;
  const cellPoint = (cx, cy) => point$1(minX + cx * cell, minY + cy * cell);
  let startX = Math.round((state.player.x - minX) / cell);
  let startY = Math.round((state.player.y - minY) / cell);
  startX = Math.max(0, Math.min(cols - 1, startX));
  startY = Math.max(0, Math.min(rows - 1, startY));
  const queue = [];
  const visited = /* @__PURE__ */ new Set();
  const start = cellPoint(startX, startY);
  if (!blocked(start.x, start.y)) {
    queue.push([startX, startY]);
    visited.add(key(startX, startY));
  }
  for (let index = 0; index < queue.length; index += 1) {
    const [cx, cy] = queue[index];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
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
      if (Math.hypot(p.x - ox, p.y - oy) <= 110 + Math.max(objective.w, objective.h) / 2) {
        reachable = true;
        break;
      }
    }
    if (reachable) reachableObjectives += 1;
  }
  const objectiveCount = objectives.length;
  const reachableRatio = totalWalkableCells > 0 ? visited.size / totalWalkableCells : 0;
  return { reachable: visited.size > 0 && reachableObjectives === objectiveCount, reachableObjectives, objectiveCount, reachableRatio, visitedCells: visited.size, totalWalkableCells };
}
function patchObject(state, id, patch) {
  const object = state.objects.find((item) => item.id === id);
  if (object) Object.assign(object, patch);
}
function addObject(state, object) {
  if (!state.objects.some((item) => item.id === object.id)) state.objects.push(object);
}
function systemObject(id, label, kind, x, y, w = 46, h = 58) {
  return {
    id,
    label,
    kind,
    material: "system",
    x,
    y,
    w,
    h,
    hp: kind === "anchorNode" ? 92 : 40,
    maxHp: kind === "anchorNode" ? 92 : 40,
    destructible: kind === "anchorNode",
    active: true,
    exposed: false
  };
}
function coverObject(id, label, x, y, w, h, material = "bulkhead") {
  return {
    id,
    label,
    kind: "cover",
    material,
    x,
    y,
    w,
    h,
    hp: material === "light" ? 68 : material === "industrial" ? 190 : 9999,
    maxHp: material === "light" ? 68 : material === "industrial" ? 190 : 9999,
    destructible: material !== "bulkhead",
    active: true,
    exposed: false
  };
}
function configureDamagedVessel(state) {
  patchObject(state, "crate-a", { label: "Bunk cargo rack", x: 430, y: 270, w: 150, h: 110, hp: 72, maxHp: 72 });
  patchObject(state, "bulkhead-a", { label: "Hab pressure trunk", x: 670, y: 335, w: 205, h: 72 });
  patchObject(state, "crate-b", { label: "Loose freight frame", x: 930, y: 680, w: 130, h: 120, hp: 66, maxHp: 66 });
  patchObject(state, "bulkhead-b", { label: "Cargo spine machinery", x: 1125, y: 425, w: 82, h: 275, hp: 205, maxHp: 205 });
  patchObject(state, "conduit-a", { label: "Life-support bus", x: 1010, y: 260, w: 72, h: 72 });
  patchObject(state, "coolant-a", { label: "Suit-loop manifold", x: 620, y: 690, w: 52, h: 88 });
  patchObject(state, "service-plate", { label: "Split hull service plate", x: 1360, y: 465, w: 96, h: 72, hp: 78, maxHp: 78 });
  patchObject(state, "door-control", { label: "Hab pressure interlock", x: 742, y: 500 });
  patchObject(state, "gravity-control", { label: "Cargo spin trim", x: 1260, y: 760 });
  patchObject(state, "arena-cover", { label: "Drive service cage", x: 1880, y: 510, w: 92, h: 270, hp: 205, maxHp: 205 });
  patchObject(state, "arena-conduit", { label: "Engine vault bus", x: 2070, y: 760 });
  patchObject(state, "boss-seal", { label: "Engine vault shutter", x: 1715, y: 700 });
  const serviceBreach = state.breaches.find((item) => item.id === "service-breach");
  if (serviceBreach) Object.assign(serviceBreach, { x: 1440, y: 505, radius: 540, strength: 880 });
  addObject(state, coverObject("vessel-rib-a-top", "Pressure rib A", 820, 160, 42, 190));
  addObject(state, coverObject("vessel-rib-a-bottom", "Pressure rib A", 820, 730, 42, 190));
  addObject(state, coverObject("vessel-rib-b-top", "Pressure rib B", 1215, 160, 42, 155));
  addObject(state, coverObject("vessel-rib-b-bottom", "Pressure rib B", 1215, 765, 42, 155));
  addObject(state, coverObject("vessel-side-locker", "Pressure locker", 1010, 470, 110, 62, "industrial"));
}
function configureRefinery(state) {
  patchObject(state, "crate-a", { label: "Ore sample bin", x: 560, y: 285, w: 105, h: 105, hp: 82, maxHp: 82 });
  patchObject(state, "bulkhead-a", { label: "Crusher bearing", x: 760, y: 725, w: 135, h: 82 });
  patchObject(state, "crate-b", { label: "Transfer dolly", x: 980, y: 520, w: 110, h: 105, hp: 74, maxHp: 74 });
  patchObject(state, "bulkhead-b", { label: "Ore separator", x: 1285, y: 280, w: 135, h: 115, hp: 225, maxHp: 225 });
  patchObject(state, "conduit-a", { label: "Crusher drive bus", x: 1180, y: 790, w: 84, h: 72 });
  patchObject(state, "coolant-a", { label: "Quench riser", x: 850, y: 500, w: 58, h: 94 });
  patchObject(state, "service-plate", { active: false });
  patchObject(state, "door-control", { label: "Ore transfer interlock", x: 690, y: 760 });
  patchObject(state, "gravity-control", { label: "Transfer gravitic trim", x: 1120, y: 215 });
  patchObject(state, "arena-cover", { label: "Foundry heat exchanger", x: 1960, y: 680, w: 140, h: 100, hp: 230, maxHp: 230 });
  patchObject(state, "arena-conduit", { label: "Foundry trunk", x: 1835, y: 300, w: 90, h: 76 });
  patchObject(state, "boss-seal", { active: false });
  addObject(state, coverObject("refinery-island-a", "Crusher drive housing", 690, 430, 150, 66, "industrial"));
  addObject(state, coverObject("refinery-island-b", "Ore lift pedestal", 1110, 690, 125, 78, "industrial"));
  addObject(state, coverObject("refinery-island-c", "Reactor feed manifold", 1360, 520, 108, 88, "industrial"));
  addObject(state, coverObject("refinery-arena-island", "Foundry coolant bank", 1780, 475, 125, 78, "industrial"));
  const anchorA = systemObject("foundry-anchor-a", "Foundry anchor node A", "anchorNode", 1760, 270, 58, 58);
  const anchorB = systemObject("foundry-anchor-b", "Foundry anchor node B", "anchorNode", 2110, 690, 58, 58);
  anchorA.active = false;
  anchorB.active = false;
  addObject(state, anchorA);
  addObject(state, anchorB);
  const fieldAnchorA = systemObject("field-anchor-a", "Stabilization node A", "anchorNode", 1220, 420, 50, 50);
  const fieldAnchorB = systemObject("field-anchor-b", "Stabilization node B", "anchorNode", 1380, 690, 50, 50);
  fieldAnchorA.hp = 68;
  fieldAnchorA.maxHp = 68;
  fieldAnchorA.active = false;
  fieldAnchorB.hp = 68;
  fieldAnchorB.maxHp = 68;
  fieldAnchorB.active = false;
  addObject(state, fieldAnchorA);
  addObject(state, fieldAnchorB);
  const elite = state.enemies.find((enemy) => enemy.id === 6);
  if (elite) {
    elite.label = "Anchor Engineer";
    elite.variant = "anchorEngineer";
    elite.hp = 150;
    elite.maxHp = 150;
    elite.armor = 112;
    elite.maxArmor = 112;
  }
  const skirmisher = state.enemies.find((enemy) => enemy.id === 4);
  if (skirmisher) {
    skirmisher.label = "Vector Skirmisher";
    skirmisher.variant = "vectorSkirmisher";
    skirmisher.hp = 88;
    skirmisher.maxHp = 88;
    skirmisher.armor = 42;
    skirmisher.maxArmor = 42;
  }
  const boss = state.enemies.find((enemy) => enemy.role === "boss");
  if (boss) {
    boss.variant = "foundryMarshal";
    boss.hp = 610;
    boss.maxHp = 610;
    boss.armor = 210;
    boss.maxArmor = 210;
  }
}
function configureSpinHabitat(state) {
  patchObject(state, "crate-a", { label: "Rim provisions rack", x: 470, y: 720, w: 115, h: 105, hp: 70, maxHp: 70 });
  patchObject(state, "bulkhead-a", { label: "Ring bearing housing", x: 690, y: 260, w: 95, h: 225 });
  patchObject(state, "crate-b", { label: "Spoke cargo trolley", x: 990, y: 300, w: 120, h: 105, hp: 66, maxHp: 66 });
  patchObject(state, "bulkhead-b", { label: "Spin-drive service bank", x: 1180, y: 620, w: 175, h: 78, hp: 205, maxHp: 205 });
  patchObject(state, "conduit-a", { label: "Ring drive bus", x: 1120, y: 245, w: 78, h: 70 });
  patchObject(state, "coolant-a", { label: "Bearing coolant loop", x: 835, y: 680, w: 54, h: 90 });
  patchObject(state, "service-plate", { label: "Rim pressure panel", x: 1370, y: 760, w: 100, h: 60, hp: 78, maxHp: 78 });
  patchObject(state, "door-control", { label: "Spoke pressure interlock", x: 735, y: 520 });
  patchObject(state, "gravity-control", { label: "Spoke spin trim", x: 1280, y: 245 });
  patchObject(state, "arena-cover", { label: "Axis momentum wheel", x: 1880, y: 470, w: 120, h: 120, hp: 205, maxHp: 205 });
  patchObject(state, "arena-conduit", { label: "Axis power trunk", x: 2040, y: 720 });
  const breach = state.breaches.find((item) => item.id === "service-breach");
  if (breach) Object.assign(breach, { x: 1430, y: 790, radius: 520, strength: 900 });
  addObject(state, coverObject("spin-ring-wall-a", "Ring pressure rib", 760, 160, 46, 210));
  addObject(state, coverObject("spin-ring-wall-b", "Ring pressure rib", 760, 690, 46, 230));
  addObject(state, coverObject("spin-spoke-brace-a", "Spoke brace", 1010, 470, 165, 54, "industrial"));
  addObject(state, coverObject("spin-spoke-brace-b", "Spoke brace", 1285, 420, 145, 54, "industrial"));
  for (const [id, label, x, y, w, h] of [
    ["meridian-barricade-a", "Portable Palisade A", 900, 570, 104, 42],
    ["meridian-barricade-b", "Portable Palisade B", 1210, 330, 104, 42],
    ["meridian-pressure-door", "Emergency pressure lane", 760, 455, 42, 170],
    ["commander-barricade-a", "Command Palisade A", 1750, 310, 118, 46],
    ["commander-barricade-b", "Command Palisade B", 2010, 650, 118, 46],
    ["commander-pressure-door-a", "Command pressure shutter A", 1850, 430, 46, 160],
    ["commander-pressure-door-b", "Command pressure shutter B", 2080, 350, 46, 160]
  ]) {
    const barrier = coverObject(id, label, x, y, w, h, "industrial");
    barrier.active = false;
    barrier.hp = id.includes("pressure-door") ? 145 : 112;
    barrier.maxHp = barrier.hp;
    addObject(state, barrier);
  }
  const palisadeA = state.enemies.find((enemy) => enemy.id === 1);
  if (palisadeA) {
    palisadeA.label = "Meridian Palisade Trooper";
    palisadeA.variant = "barricadeTrooper";
    palisadeA.armor = 82;
    palisadeA.maxArmor = 82;
  }
  const lockTech = state.enemies.find((enemy) => enemy.id === 3);
  if (lockTech) {
    lockTech.role = "technician";
    lockTech.label = "Meridian Lock Technician";
    lockTech.variant = "pressureLockTech";
    lockTech.armor = 66;
    lockTech.maxArmor = 66;
  }
  const palisadeB = state.enemies.find((enemy) => enemy.id === 4);
  if (palisadeB) {
    palisadeB.label = "Meridian Recovery Trooper";
    palisadeB.variant = "barricadeTrooper";
    palisadeB.armor = 78;
    palisadeB.maxArmor = 78;
  }
  const bulwark = state.enemies.find((enemy) => enemy.id === 6);
  if (bulwark) {
    bulwark.label = "Meridian Recovery Bulwark";
    bulwark.variant = "barricadeTrooper";
    bulwark.armor = 142;
    bulwark.maxArmor = 142;
  }
  const boss = state.enemies.find((enemy) => enemy.role === "boss");
  if (boss) {
    boss.variant = "meridianCommander";
    boss.hp = 680;
    boss.maxHp = 680;
    boss.armor = 320;
    boss.maxArmor = 320;
  }
}
function configureJovianHarvester(state) {
  patchObject(state, "crate-a", { label: "Skimmer valve crate", x: 430, y: 300, w: 110, h: 100, hp: 68, maxHp: 68 });
  patchObject(state, "bulkhead-a", { label: "Storm truss footing", x: 650, y: 650, w: 150, h: 72 });
  patchObject(state, "crate-b", { label: "Separator service rack", x: 965, y: 735, w: 115, h: 100, hp: 70, maxHp: 70 });
  patchObject(state, "bulkhead-b", { label: "Compressor pressure shell", x: 1210, y: 300, w: 155, h: 92, hp: 215, maxHp: 215 });
  patchObject(state, "conduit-a", { label: "Electrostatic skimmer bus", x: 1090, y: 520, w: 80, h: 72 });
  patchObject(state, "coolant-a", { label: "Cryopump return riser", x: 790, y: 430, w: 55, h: 92 });
  patchObject(state, "service-plate", { label: "Storm relief plate", x: 1390, y: 190, w: 84, h: 68, hp: 72, maxHp: 72 });
  patchObject(state, "door-control", { label: "Inner storm lock", x: 610, y: 250 });
  patchObject(state, "gravity-control", { label: "Compressor mass trim", x: 1300, y: 760 });
  patchObject(state, "arena-cover", { label: "Compressor crown", x: 1910, y: 360, w: 155, h: 86, hp: 220, maxHp: 220 });
  patchObject(state, "arena-conduit", { label: "Harvester crown bus", x: 2050, y: 735 });
  const breach = state.breaches.find((item) => item.id === "service-breach");
  if (breach) Object.assign(breach, { x: 1450, y: 220, radius: 760, strength: 1450 });
  addObject(state, coverObject("gas-truss-a", "Maintenance truss A", 720, 470, 155, 52, "industrial"));
  addObject(state, coverObject("gas-truss-b", "Maintenance truss B", 980, 330, 145, 52, "industrial"));
  addObject(state, coverObject("gas-truss-c", "Maintenance truss C", 1260, 650, 155, 52, "industrial"));
}
function configureIceMine(state) {
  patchObject(state, "crate-a", { label: "Cryobore tool pallet", x: 370, y: 500, w: 105, h: 95, hp: 62, maxHp: 62 });
  patchObject(state, "bulkhead-a", { label: "Haulage motor", x: 655, y: 420, w: 120, h: 76 });
  patchObject(state, "crate-b", { label: "Volatile sample cage", x: 945, y: 270, w: 105, h: 95, hp: 60, maxHp: 60 });
  patchObject(state, "bulkhead-b", { label: "Cryobore separator", x: 1260, y: 660, w: 145, h: 90, hp: 180, maxHp: 180 });
  patchObject(state, "conduit-a", { label: "Thaw-grid trunk", x: 1110, y: 260, w: 74, h: 68 });
  patchObject(state, "coolant-a", { label: "Volatile chill line", x: 875, y: 690, w: 54, h: 88 });
  patchObject(state, "service-plate", { label: "Fractured bore pressure plate", x: 1375, y: 505, w: 88, h: 64, hp: 66, maxHp: 66 });
  patchObject(state, "door-control", { label: "Access-bore lock", x: 580, y: 520 });
  patchObject(state, "gravity-control", { label: "Deep-bore haulage trim", x: 1280, y: 280 });
  patchObject(state, "arena-cover", { label: "Subglacial separator drum", x: 1880, y: 580, w: 135, h: 92, hp: 180, maxHp: 180 });
  patchObject(state, "arena-conduit", { label: "Vault thaw bus", x: 2060, y: 300 });
  const breach = state.breaches.find((item) => item.id === "service-breach");
  if (breach) Object.assign(breach, { x: 1430, y: 535, radius: 500, strength: 780 });
  addObject(state, coverObject("ice-wall-a-top", "Bore wall", 540, 160, 55, 245));
  addObject(state, coverObject("ice-wall-a-bottom", "Bore wall", 540, 635, 55, 285));
  addObject(state, coverObject("ice-wall-b-top", "Extraction wall", 1035, 160, 55, 155));
  addObject(state, coverObject("ice-wall-b-bottom", "Extraction wall", 1035, 535, 55, 385));
  addObject(state, coverObject("ice-brittle-gate-a", "Brittle ice support A", 760, 445, 115, 58, "light"));
  addObject(state, coverObject("ice-brittle-gate-b", "Brittle ice support B", 1190, 455, 110, 58, "light"));
  const riggerA = state.enemies.find((enemy) => enemy.id === 1);
  if (riggerA) {
    riggerA.label = "Long Arc Backblast Rigger";
    riggerA.variant = "vectorSkirmisher";
    riggerA.hp = 86;
    riggerA.maxHp = 86;
  }
  const tether = state.enemies.find((enemy) => enemy.id === 3);
  if (tether) {
    tether.role = "technician";
    tether.label = "Long Arc Tether Hand";
    tether.variant = "tetherRigger";
    tether.hp = 76;
    tether.maxHp = 76;
  }
  const riggerB = state.enemies.find((enemy) => enemy.id === 4);
  if (riggerB) {
    riggerB.label = "Long Arc Recoil Cutter";
    riggerB.variant = "vectorSkirmisher";
    riggerB.hp = 90;
    riggerB.maxHp = 90;
  }
  const foreman = state.enemies.find((enemy) => enemy.id === 6);
  if (foreman) {
    foreman.label = "Long Arc Jury-Rig Foreman";
    foreman.variant = "tetherRigger";
    foreman.armor = 96;
    foreman.maxArmor = 96;
  }
  const boss = state.enemies.find((enemy) => enemy.role === "boss");
  if (boss) {
    boss.variant = "salvageCaptain";
    boss.hp = 605;
    boss.maxHp = 605;
    boss.armor = 165;
    boss.maxArmor = 165;
  }
}
function configureSolarYard(state) {
  patchObject(state, "crate-a", { label: "Mirror actuator crate", x: 460, y: 265, w: 115, h: 100, hp: 70, maxHp: 70 });
  patchObject(state, "bulkhead-a", { label: "Shade gantry bearing", x: 690, y: 690, w: 150, h: 74 });
  patchObject(state, "crate-b", { label: "Printer spindle pallet", x: 980, y: 510, w: 110, h: 100, hp: 68, maxHp: 68 });
  patchObject(state, "bulkhead-b", { label: "Fabrication heat bank", x: 1240, y: 265, w: 150, h: 100, hp: 210, maxHp: 210 });
  patchObject(state, "conduit-a", { label: "Sunward fabrication bus", x: 1120, y: 760, w: 82, h: 72 });
  patchObject(state, "coolant-a", { label: "Radiator coolant riser", x: 845, y: 420, w: 58, h: 92 });
  patchObject(state, "service-plate", { label: "Radiator pressure plate", x: 1390, y: 650, w: 88, h: 66, hp: 74, maxHp: 74 });
  patchObject(state, "door-control", { label: "Shade-side pressure lock", x: 650, y: 280 });
  patchObject(state, "gravity-control", { label: "Fabrication gantry trim", x: 1300, y: 760 });
  patchObject(state, "arena-cover", { label: "Sunward print carriage", x: 1910, y: 500, w: 155, h: 88, hp: 225, maxHp: 225 });
  patchObject(state, "arena-conduit", { label: "Sunward power trunk", x: 2060, y: 285 });
  const breach = state.breaches.find((item) => item.id === "service-breach");
  if (breach) Object.assign(breach, { x: 1440, y: 680, radius: 520, strength: 840 });
  addObject(state, systemObject("solar-shutter", "Local thermal shutters", "doorControl", 930, 220));
  addObject(state, coverObject("solar-radiator-a", "Radiator bank A", 760, 420, 135, 58, "industrial"));
  addObject(state, coverObject("solar-radiator-b", "Radiator bank B", 1160, 610, 145, 58, "industrial"));
  for (const [id, label, x, y] of [
    ["yard-door-a", "Autonomous fabrication shutter A", 1760, 345],
    ["yard-door-b", "Autonomous fabrication shutter B", 2020, 610]
  ]) {
    const door = coverObject(id, label, x, y, 52, 170, "industrial");
    door.active = false;
    door.hp = 150;
    door.maxHp = 150;
    addObject(state, door);
  }
  const interceptor = state.enemies.find((enemy) => enemy.id === 1);
  if (interceptor) {
    interceptor.label = "Maintenance Interceptor";
    interceptor.variant = "maintenanceDrone";
    interceptor.hp = 68;
    interceptor.maxHp = 68;
    interceptor.armor = 34;
    interceptor.maxArmor = 34;
  }
  const gravityDrone = state.enemies.find((enemy) => enemy.id === 2);
  if (gravityDrone) {
    gravityDrone.label = "Mass-Trim Drone";
    gravityDrone.variant = "gravityDrone";
    gravityDrone.hp = 72;
    gravityDrone.maxHp = 72;
  }
  const serviceDrone = state.enemies.find((enemy) => enemy.id === 3);
  if (serviceDrone) {
    serviceDrone.label = "Fabrication Service Drone";
    serviceDrone.variant = "maintenanceDrone";
    serviceDrone.hp = 64;
    serviceDrone.maxHp = 64;
  }
  const cutterDrone = state.enemies.find((enemy) => enemy.id === 4);
  if (cutterDrone) {
    cutterDrone.label = "Arc-Cutter Drone";
    cutterDrone.variant = "maintenanceDrone";
  }
  const relay = state.enemies.find((enemy) => enemy.id === 6);
  if (relay) {
    relay.label = "Autonomous Control Relay";
    relay.variant = "gravityDrone";
    relay.hp = 132;
    relay.maxHp = 132;
    relay.armor = 92;
    relay.maxArmor = 92;
  }
  const boss = state.enemies.find((enemy) => enemy.role === "boss");
  if (boss) {
    boss.variant = "yardmind";
    boss.hp = 560;
    boss.maxHp = 560;
    boss.armor = 235;
    boss.maxArmor = 235;
    boss.x = 2060;
    boss.y = 520;
  }
}
function configureMomentumExchange(state) {
  patchObject(state, "crate-a", { label: "Capture-collar pallet", x: 410, y: 300, w: 120, h: 96, hp: 72, maxHp: 72 });
  patchObject(state, "bulkhead-a", { label: "Inbound flywheel housing", x: 650, y: 660, w: 165, h: 72, hp: 210, maxHp: 210 });
  patchObject(state, "crate-b", { label: "Transfer cradle dolly", x: 980, y: 270, w: 118, h: 100, hp: 70, maxHp: 70 });
  patchObject(state, "bulkhead-b", { label: "Outbound flywheel housing", x: 1240, y: 690, w: 165, h: 72, hp: 210, maxHp: 210 });
  patchObject(state, "conduit-a", { label: "Countermass bus", x: 1110, y: 510, w: 82, h: 72 });
  patchObject(state, "coolant-a", { label: "Flywheel bearing loop", x: 850, y: 420, w: 58, h: 92 });
  patchObject(state, "service-plate", { label: "Transfer-lane service panel", x: 1400, y: 300, w: 90, h: 68, hp: 74, maxHp: 74 });
  patchObject(state, "door-control", { label: "Inbound capture collar", x: 610, y: 275 });
  patchObject(state, "gravity-control", { label: "Outbound mass trim", x: 1320, y: 760 });
  patchObject(state, "arena-cover", { label: "Deep counterweight cradle", x: 1910, y: 520, w: 150, h: 90, hp: 225, maxHp: 225 });
  patchObject(state, "arena-conduit", { label: "Exchange reference bus", x: 2070, y: 285 });
  addObject(state, coverObject("momentum-rail-a", "Electromagnetic transfer rail A", 760, 370, 180, 48, "industrial"));
  addObject(state, coverObject("momentum-rail-b", "Electromagnetic transfer rail B", 1090, 640, 180, 48, "industrial"));
  addObject(state, coverObject("momentum-baffle", "Countermass service baffle", 1410, 470, 110, 58, "light"));
}
function configureCryoReserve(state) {
  patchObject(state, "crate-a", { label: "Valve service cassette", x: 400, y: 700, w: 110, h: 96, hp: 68, maxHp: 68 });
  patchObject(state, "bulkhead-a", { label: "LH2 tank saddle", x: 650, y: 290, w: 145, h: 88, hp: 220, maxHp: 220 });
  patchObject(state, "crate-b", { label: "Insulation repair rack", x: 960, y: 730, w: 110, h: 98, hp: 66, maxHp: 66 });
  patchObject(state, "bulkhead-b", { label: "Methane reserve saddle", x: 1230, y: 290, w: 150, h: 90, hp: 220, maxHp: 220 });
  patchObject(state, "conduit-a", { label: "Cryopump power trunk", x: 1100, y: 520, w: 82, h: 72 });
  patchObject(state, "coolant-a", { label: "Boiloff return header", x: 820, y: 520, w: 58, h: 94 });
  patchObject(state, "service-plate", { label: "Vacuum-jacket service plate", x: 1390, y: 700, w: 90, h: 68, hp: 72, maxHp: 72 });
  patchObject(state, "door-control", { label: "Service collar lock", x: 610, y: 760 });
  patchObject(state, "gravity-control", { label: "Tank-farm mass trim", x: 1310, y: 245 });
  patchObject(state, "arena-cover", { label: "Umbra transfer manifold", x: 1900, y: 560, w: 150, h: 90, hp: 215, maxHp: 215 });
  patchObject(state, "arena-conduit", { label: "Reserve pump bus", x: 2070, y: 300 });
  addObject(state, coverObject("cryo-tank-a", "Vacuum-jacket tank A", 760, 390, 125, 78, "industrial"));
  addObject(state, coverObject("cryo-tank-b", "Vacuum-jacket tank B", 1010, 610, 125, 78, "industrial"));
  addObject(state, coverObject("cryo-tank-c", "Vacuum-jacket tank C", 1320, 410, 125, 78, "industrial"));
  addObject(state, coverObject("cryo-insulation", "Brittle insulation screen", 1450, 650, 105, 52, "light"));
}
function configureInterdictionCommand(state, contract) {
  const boss = state.enemies.find((enemy) => enemy.role === "boss");
  if (!boss) return;
  if (contract.deepTarget === "Transfer Adjudicator Iona Vale") {
    for (const [id, x, y] of [["transfer-partition-a", 930, 300], ["transfer-partition-b", 1180, 610], ["transfer-partition-c", 1880, 430]]) {
      const partition = coverObject(id, "Movable custody pressure partition", x, y, 58, 180, "industrial");
      partition.active = false;
      partition.hp = 125;
      partition.maxHp = 125;
      addObject(state, partition);
    }
    boss.variant = "transferAdjudicator";
    boss.hp = 700;
    boss.maxHp = 700;
    boss.armor = 225;
    boss.maxArmor = 225;
    boss.anchored = false;
  } else if (contract.deepTarget === "Umbra Systems Marshal Oren Saal") {
    for (const [id, x, y] of [["siphon-node-a", 980, 390], ["siphon-node-b", 1280, 680], ["boss-siphon-a", 1800, 315], ["boss-siphon-b", 2110, 700]]) {
      const node = systemObject(id, "Capacitor siphon relay", "anchorNode", x, y, 48, 48);
      node.active = false;
      node.hp = 68;
      node.maxHp = 68;
      addObject(state, node);
    }
    boss.variant = "umbraMarshal";
    boss.hp = 690;
    boss.maxHp = 690;
    boss.armor = 210;
    boss.maxArmor = 210;
    boss.anchored = false;
  } else if (contract.deepTarget === "Custody Director Mara Teth") {
    for (const [id, x, y] of [["custody-shutter-a", 1030, 330], ["custody-shutter-b", 1320, 610], ["custody-shutter-c", 1900, 450]]) {
      const shutter = coverObject(id, "Custody geometry shutter", x, y, 54, 170, "industrial");
      shutter.active = false;
      shutter.hp = 125;
      shutter.maxHp = 125;
      addObject(state, shutter);
    }
    for (const [id, x, y] of [["custody-reference-a", 1740, 280], ["custody-reference-b", 1980, 510], ["custody-reference-c", 2150, 735]]) {
      const node = systemObject(id, "Custody reference relay", "anchorNode", x, y, 50, 50);
      node.active = true;
      node.exposed = true;
      node.hp = 72;
      node.maxHp = 72;
      addObject(state, node);
    }
    boss.variant = "custodyDirector";
    boss.hp = 710;
    boss.maxHp = 710;
    boss.armor = 215;
    boss.maxArmor = 215;
    boss.anchored = false;
  }
}
function objectivePosition(contract, index) {
  const positionsByLocation = {
    "damaged-vessel": [{ x: 560, y: 255 }, { x: 1010, y: 800 }, { x: 1360, y: 690 }],
    "asteroid-refinery": [{ x: 530, y: 760 }, { x: 930, y: 245 }, { x: 1350, y: 760 }],
    "spin-habitat": [{ x: 465, y: 760 }, { x: 930, y: 260 }, { x: 1360, y: 700 }],
    "jovian-harvester": [{ x: 430, y: 285 }, { x: 930, y: 760 }, { x: 1370, y: 270 }],
    "ice-mine": [{ x: 390, y: 530 }, { x: 900, y: 350 }, { x: 1360, y: 690 }],
    "solar-yard": [{ x: 500, y: 270 }, { x: 980, y: 760 }, { x: 1380, y: 330 }],
    "lattice-annex": [{ x: 480, y: 720 }, { x: 990, y: 270 }, { x: 1420, y: 710 }],
    "momentum-exchange": [{ x: 520, y: 710 }, { x: 980, y: 280 }, { x: 1390, y: 720 }],
    "cryo-reserve": [{ x: 500, y: 280 }, { x: 980, y: 760 }, { x: 1390, y: 300 }]
  };
  const positions = positionsByLocation[contract.location] ?? [{ x: 540, y: 270 }, { x: 1040, y: 785 }, { x: 1375, y: 300 }];
  return positions[index] ?? positions[positions.length - 1];
}
function objectiveNames(contract) {
  const authored = {
    "spin-habitat": { pressure: "Rim pressure manifold", grid: ["Rim spin-bus isolator", "Spoke spin-bus isolator"], gravity: ["Rim gravity trim", "Spoke gravity trim"], machinery: ["Bearing-control package", "Attitude-flywheel package"], boarding: ["Spoke pressure interlock", "Axis pressure lock"], salvage: ["Rim recovery cache", "Spoke recovery cache", "Axis recovery cache"] },
    "jovian-harvester": { pressure: "Storm relief manifold", grid: ["Skimmer bus isolator", "Compressor bus isolator"], gravity: ["Maintenance-deck mass trim", "Compressor-crown mass trim"], machinery: ["Skimmer compressor package", "Separator package"], boarding: ["Inner storm lock", "Outer maintenance lock"], salvage: ["Intake recovery package", "Separator recovery package", "Compressor recovery package"] },
    "ice-mine": { pressure: "Bore pressure manifold", grid: ["Upper thaw-grid isolator", "Deep thaw-grid isolator"], gravity: ["Haulage gravity trim", "Deep-bore gravity trim"], machinery: ["Cryobore cutter package", "Volatile separator package"], boarding: ["Access-bore lock", "Deep-tunnel lock"], salvage: ["Access-bore cache", "Extraction-tunnel cache", "Subglacial vault cache"] },
    "solar-yard": { pressure: "Radiator pressure manifold", grid: ["Shade-side solar isolator", "Sunward solar isolator"], gravity: ["Shade-gantry gravity trim", "Fabrication-spine gravity trim"], machinery: ["Mirror actuator package", "Printer spindle package"], boarding: ["Shade-side pressure lock", "Sunward pressure lock"], salvage: ["Shade-gantry package", "Fabrication-spine package", "Sunward yard package"] },
    "lattice-annex": { pressure: "Khepri sample-vault manifold", grid: ["Cold-ring archive isolator", "Sample-vault archive isolator"], gravity: ["Metrology-ring mass trim", "Reference-gallery mass trim"], machinery: ["Precision carriage package", "Cryogenic reference package"], boarding: ["Reference gallery interlock", "Sample vault pressure lock"], salvage: ["Cold-ring metrology archive", "Reference-gallery archive", "Sample-vault custody record"] },
    "momentum-exchange": { pressure: "Transfer pressure manifold", grid: ["Inbound bus isolator", "Outbound bus isolator"], gravity: ["Inbound mass trim", "Outbound mass trim"], machinery: ["Capture flywheel package", "Transfer cradle package"], boarding: ["Inbound capture collar", "Outbound pressure lock"], salvage: ["Inbound ledger core", "Transfer timing core", "Countermass reference core"] },
    "cryo-reserve": { pressure: "Vacuum-jacket manifold", grid: ["Cryopump isolator A", "Cryopump isolator B"], gravity: ["Service-collar mass trim", "Tank-farm mass trim"], machinery: ["Cryopump package", "Boiloff separator package"], boarding: ["Service collar lock", "Tank-farm pressure lock"], salvage: ["Valve archive", "Propellant ledger core", "Umbra pump controller"] }
  };
  return authored[contract.location] ?? { pressure: "Emergency pressure manifold", grid: ["Grid isolator A", "Grid isolator B"], gravity: ["Deck gravity trim", "Transfer gravity trim"], machinery: ["Machinery package A", "Machinery package B"], boarding: ["Pressure interlock A", "Pressure interlock B"], salvage: ["Recovery package A", "Recovery package B", "Recovery package C"] };
}
function configureObjectiveObjects(state, contract) {
  const names = objectiveNames(contract);
  const addAt = (id, label, kind, index) => {
    const pos = objectivePosition(contract, index);
    addObject(state, systemObject(id, label, kind, pos.x, pos.y));
  };
  if (contract.objectiveMode === "pressure-recovery") {
    const pos = objectivePosition(contract, 2);
    addObject(state, systemObject("service-seal", names.pressure, "sealControl", pos.x, pos.y));
    const breach = state.breaches.find((item) => item.id === "service-breach");
    const sector = state.sectors.find((item) => item.id === "B");
    if (breach && sector) {
      breach.active = true;
      breach.sealed = false;
      breach.strength = Math.min(breach.strength, 650);
      breach.radius = Math.min(breach.radius, 480);
      sector.pressure = Math.min(sector.pressure, 0.34);
      sector.targetPressure = 0;
      sector.pressureState = "leaking";
    }
  } else if (contract.objectiveMode === "grid-isolation") {
    addAt("grid-isolator-a", names.grid[0], "powerControl", 0);
    addAt("grid-isolator-b", names.grid[1], "powerControl", 2);
  } else if (contract.objectiveMode === "gravity-stabilization") {
    addAt("gravity-control-a", names.gravity[0], "gravityControl", 0);
    patchObject(state, "gravity-control", { id: "gravity-control-b", label: names.gravity[1], exposed: false });
  } else if (contract.objectiveMode === "machinery-recovery") {
    addAt("salvage-node-a", names.machinery[0], "salvageNode", 0);
    addAt("salvage-node-b", names.machinery[1], "salvageNode", 2);
  } else if (contract.objectiveMode === "emergency-boarding") {
    patchObject(state, "door-control", { label: names.boarding[0], exposed: false });
    addAt("boarding-lock", names.boarding[1], "doorControl", 2);
  } else if (contract.objectiveMode === "momentum-capture") {
    addAt("capture-drum-a", "Inbound capture drum", "gravityControl", 0);
    addAt("capture-drum-b", "Outbound capture drum", "gravityControl", 2);
  } else if (contract.objectiveMode === "thermal-routing") {
    addAt("purge-valve-a", "LH2 purge valve", "doorControl", 0);
    addAt("purge-valve-b", "Methane purge valve", "doorControl", 2);
  } else {
    addAt("salvage-node-a", names.salvage[0], "salvageNode", 0);
    addAt("salvage-node-b", names.salvage[1], "salvageNode", 1);
    addAt("salvage-node-c", names.salvage[2], "salvageNode", 2);
  }
}
function configureLatticeAnnex(state) {
  patchObject(state, "crate-a", { label: "Reference sample trolley", x: 470, y: 280, w: 120, h: 92, hp: 74, maxHp: 74 });
  patchObject(state, "bulkhead-a", { label: "Cold metrology plinth", x: 720, y: 650, w: 150, h: 82 });
  patchObject(state, "crate-b", { label: "Survey archive rack", x: 980, y: 330, w: 118, h: 110, hp: 72, maxHp: 72 });
  patchObject(state, "bulkhead-b", { label: "Reference carriage housing", x: 1250, y: 610, w: 150, h: 92, hp: 220, maxHp: 220 });
  patchObject(state, "conduit-a", { label: "Metrology timing bus", x: 1130, y: 255, w: 82, h: 72 });
  patchObject(state, "coolant-a", { label: "Cryogenic reference loop", x: 850, y: 720, w: 54, h: 92 });
  patchObject(state, "door-control", { label: "Reference gallery interlock", x: 690, y: 770 });
  patchObject(state, "gravity-control", { label: "Calibration mass trim", x: 1320, y: 260 });
  patchObject(state, "arena-cover", { label: "Sample vault carriage", x: 1920, y: 650, w: 145, h: 86, hp: 215, maxHp: 215 });
  patchObject(state, "arena-conduit", { label: "Vault timing trunk", x: 1830, y: 285, w: 88, h: 74 });
  addObject(state, coverObject("khepri-plinth-a", "Reference plinth A", 610, 470, 116, 64, "industrial"));
  addObject(state, coverObject("khepri-plinth-b", "Reference plinth B", 1030, 690, 116, 64, "industrial"));
  addObject(state, coverObject("khepri-plinth-c", "Reference plinth C", 1450, 390, 116, 64, "industrial"));
  for (const [id, x, y] of [["lattice-shutter-a", 1680, 300], ["lattice-shutter-b", 2030, 690]]) {
    const shutter = coverObject(id, "Khepri calibration shutter", x, y, 58, 180, "industrial");
    shutter.active = false;
    shutter.hp = 150;
    shutter.maxHp = 150;
    addObject(state, shutter);
  }
  for (const [id, x, y] of [["lattice-reference-a", 1740, 250], ["lattice-reference-b", 1970, 500], ["lattice-reference-c", 2160, 745]]) {
    const node = systemObject(id, "Metrology reference pylon", "anchorNode", x, y, 54, 54);
    node.active = false;
    node.hp = 82;
    node.maxHp = 82;
    addObject(state, node);
  }
}
function configureStoryFinale(state, contract) {
  const replayTarget = contract.directiveTargetClass === "command-target" ? contract.deepTarget : "";
  if ((!contract.storyFinale || !contract.storyArc) && !["Pressure Broker Naima Rusk", "Bond Arbiter Edrin Shaw", "PRISM-6 Forge Chorus"].includes(replayTarget)) return;
  const boss = state.enemies.find((enemy) => enemy.role === "boss");
  if (!boss) return;
  if (contract.storyArc === "vanishing-wake" || replayTarget === "Pressure Broker Naima Rusk") {
    boss.variant = "pressureBroker";
    boss.hp = 650;
    boss.maxHp = 650;
    boss.armor = 185;
    boss.maxArmor = 185;
    const enforcer = state.enemies.find((enemy) => enemy.id === 1);
    if (enforcer) enforcer.label = "Rusk Recovery Enforcer";
    const tech = state.enemies.find((enemy) => enemy.id === 3);
    if (tech) {
      tech.role = "technician";
      tech.label = "Illegal Manifold Tech";
    }
    for (const [id, x, y] of [["story-pressure-shutter-a", 1780, 330], ["story-pressure-shutter-b", 2040, 640]]) {
      const shutter = coverObject(id, "Broker pressure shutter", x, y, 54, 170, "industrial");
      shutter.active = false;
      shutter.hp = 135;
      shutter.maxHp = 135;
      addObject(state, shutter);
    }
  } else if (contract.storyArc === "terms-of-survival" || replayTarget === "Bond Arbiter Edrin Shaw") {
    boss.variant = "bondArbiter";
    boss.hp = 720;
    boss.maxHp = 720;
    boss.armor = 350;
    boss.maxArmor = 350;
    const guard = state.enemies.find((enemy) => enemy.id === 1);
    if (guard) guard.label = "Arbitration Palisade";
    const tech = state.enemies.find((enemy) => enemy.id === 3);
    if (tech) {
      tech.role = "technician";
      tech.label = "Archive Seal Officer";
    }
  } else {
    boss.variant = "forgeChorus";
    boss.hp = 620;
    boss.maxHp = 620;
    boss.armor = 240;
    boss.maxArmor = 240;
    boss.x = 2060;
    boss.y = 520;
    const drone = state.enemies.find((enemy) => enemy.id === 1);
    if (drone) {
      drone.variant = "maintenanceDrone";
      drone.label = "PRISM Process Drone";
    }
    const relay = state.enemies.find((enemy) => enemy.id === 6);
    if (relay) {
      relay.variant = "gravityDrone";
      relay.label = "PRISM Phase Relay";
    }
  }
}
function configureCampaignFinale(state, contract) {
  const directiveReplay = contract.directiveTargetClass === "command-target" && contract.deepTarget === "Survey Custodian Veyra Senn";
  if ((!contract.campaignFinale || contract.campaignChapter !== "black-lattice") && !directiveReplay) return;
  const boss = state.enemies.find((enemy) => enemy.role === "boss");
  if (!boss) return;
  boss.variant = "latticeCustodian";
  boss.hp = 790;
  boss.maxHp = 790;
  boss.armor = 285;
  boss.maxArmor = 285;
  boss.anchored = false;
  boss.x = 2020;
  boss.y = 520;
  for (const node of state.objects.filter((object) => object.id.startsWith("lattice-reference"))) {
    node.active = true;
    node.exposed = false;
    node.hp = node.maxHp;
  }
  const tech = state.enemies.find((enemy) => enemy.id === 3);
  if (tech) {
    tech.role = "technician";
    tech.label = "Khepri Reference Technician";
  }
  const elite = state.enemies.find((enemy) => enemy.id === 6);
  if (elite) {
    elite.role = "elite";
    elite.variant = "meleeExosuit";
    elite.label = "Vault Recovery Exosuit";
    elite.hp = 195;
    elite.maxHp = 195;
    elite.armor = 150;
    elite.maxArmor = 150;
  }
}
function configureEscalationFinale(state, contract) {
  if (!contract.escalationFinale) return;
  const boss = state.enemies.find((enemy) => enemy.role === "boss");
  if (!boss) return;
  boss.variant = "cascadeCustodian";
  boss.hp = 760;
  boss.maxHp = 760;
  boss.armor = 270;
  boss.maxArmor = 270;
  boss.anchored = false;
  const tech = state.enemies.find((enemy) => enemy.id === 3);
  if (tech) {
    tech.role = "technician";
    tech.label = "Cascade Grid Technician";
  }
  const elite = state.enemies.find((enemy) => enemy.id === 6);
  if (elite) {
    elite.role = "elite";
    elite.label = "Failure-State Marshal";
  }
  addObject(state, coverObject("cascade-baffle-a", "Emergency bus baffle A", 1770, 330, 118, 48, "industrial"));
  addObject(state, coverObject("cascade-baffle-b", "Emergency bus baffle B", 2020, 650, 118, 48, "industrial"));
}
function configureMegastructureStage(state, contract) {
  if (!contract.megastructure || !contract.megastructureStage) return;
  const positions = [{ x: 610, y: 790 }, { x: 960, y: 250 }, { x: 1320, y: 760 }, { x: 1210, y: 270 }];
  const position = positions[(contract.megastructureStage - 1) % positions.length];
  addObject(state, systemObject("mega-optional-cache", contract.megastructureOptionalLabel ?? "Optional derelict archive", "salvageNode", position.x, position.y));
  if (contract.megastructureStage === 2) {
    const elite = state.enemies.find((enemy) => enemy.id === 6);
    if (elite) {
      elite.active = true;
      elite.dead = false;
      elite.role = "elite";
      elite.variant = "meleeExosuit";
      elite.label = "Derelict Security Exosuit";
      elite.hp = 190;
      elite.maxHp = 190;
      elite.armor = 145;
      elite.maxArmor = 145;
    }
  }
}
function applyEncounterLayout(state, contract) {
  if (contract.location === "damaged-vessel") configureDamagedVessel(state);
  else if (contract.location === "asteroid-refinery") configureRefinery(state);
  else if (contract.location === "spin-habitat") configureSpinHabitat(state);
  else if (contract.location === "jovian-harvester") configureJovianHarvester(state);
  else if (contract.location === "ice-mine") configureIceMine(state);
  else if (contract.location === "solar-yard") configureSolarYard(state);
  else if (contract.location === "lattice-annex") configureLatticeAnnex(state);
  else if (contract.location === "momentum-exchange") configureMomentumExchange(state);
  else if (contract.location === "cryo-reserve") configureCryoReserve(state);
  configureInterdictionCommand(state, contract);
  configureObjectiveObjects(state, contract);
  configureMegastructureStage(state, contract);
  configureStoryFinale(state, contract);
  configureCampaignFinale(state, contract);
  configureEscalationFinale(state, contract);
  reserveNavigationLanes(state, contract.location);
}
const eliteProtocolDefinitions = [
  { id: "reactivePlating", name: "Reactive Plating", shortName: "PLATING", family: "defense", threatCost: 3, rewardWeight: 1, tell: "Armor panels flash and re-knit between pressure cycles.", counter: "Sustain armor pressure or disrupt the unit before the repair pulse.", baseCooldown: 7.2, enhanceable: true },
  { id: "pressureHunter", name: "Pressure Hunter", shortName: "PRESSURE", family: "pressure", threatCost: 3, rewardWeight: 1, tell: "Suit vents flare when local atmosphere drops.", counter: "Repressurize the room, seal the breach, or stagger the pursuer.", baseCooldown: 7.8, locations: ["orbital-station", "damaged-vessel", "jovian-harvester"] },
  { id: "vacuumAdapted", name: "Vacuum Adapted", shortName: "VAC-ADAPT", family: "pressure", threatCost: 3, rewardWeight: 1, tell: "Hard-vac trim remains stable during decompression.", counter: "Restore pressure or use Magnetic Impulse to break its line.", baseCooldown: 8.4, locations: ["damaged-vessel", "jovian-harvester", "ice-mine", "solar-yard", "cryo-reserve"] },
  { id: "breachmaker", name: "Breachmaker", shortName: "BREACH", family: "pressure", threatCost: 4, rewardWeight: 1, tell: "Demolition hardware locks onto nearby cover.", counter: "Disrupt the carrier or reposition before the firing lane opens.", baseCooldown: 7.4, enhanceable: true, locations: ["orbital-station", "damaged-vessel", "asteroid-refinery", "ice-mine", "lattice-annex"] },
  { id: "magneticLock", name: "Magnetic Lock", shortName: "MAG-LOCK", family: "mass", threatCost: 4, rewardWeight: 1, tell: "A blue mass-reference reticle forms on the operator vector.", counter: "Sensor Spike or Arc disruption prevents the lock; move clear of the well.", baseCooldown: 6.6, enhanceable: true, locations: ["orbital-station", "spin-habitat", "jovian-harvester", "lattice-annex", "momentum-exchange"] },
  { id: "gravityAnchor", name: "Gravity Anchor", shortName: "ANCHOR", family: "mass", threatCost: 4, rewardWeight: 1, tell: "Anchor vanes flare and the unit resists pressure and impulse.", counter: "Arc Tap or Sensor Spike disables the anchor before Magnetic Impulse.", baseCooldown: 7.6, enhanceable: true, locations: ["asteroid-refinery", "spin-habitat", "solar-yard", "lattice-annex", "momentum-exchange"] },
  { id: "countermassMobility", name: "Countermass Mobility", shortName: "COUNTERMASS", family: "mass", threatCost: 3, rewardWeight: 1, tell: "Countermass pods precess before a lateral vector burst.", counter: "Magnetic Impulse interrupts committed movement; walls limit the escape.", baseCooldown: 5.8, enhanceable: true, locations: ["spin-habitat", "jovian-harvester", "ice-mine", "momentum-exchange"] },
  { id: "arcConduit", name: "Arc Conduit", shortName: "ARC-LINK", family: "systems", threatCost: 4, rewardWeight: 1, tell: "Visible arcs bridge the unit to floor hardware.", counter: "Arc Tap turns the conductive network into a disruption path.", baseCooldown: 6.4, enhanceable: true, locations: ["orbital-station", "asteroid-refinery", "solar-yard", "lattice-annex"] },
  { id: "repairMesh", name: "Repair Mesh", shortName: "REPAIR", family: "systems", threatCost: 3, rewardWeight: 1, tell: "Green repair tracers link damaged armor and machinery.", counter: "Disrupt the mesh or destroy repaired hardware faster than it cycles.", baseCooldown: 6.8, enhanceable: true, locations: ["orbital-station", "asteroid-refinery", "solar-yard", "lattice-annex", "momentum-exchange", "cryo-reserve"] },
  { id: "droneEscort", name: "Drone Escort", shortName: "ESCORT", family: "systems", threatCost: 4, rewardWeight: 1, tell: "Docking lights open on a limited support-drone rack.", counter: "Kill the finite drones or disrupt the carrier before launch.", baseCooldown: 8.2, enhanceable: true, locations: ["orbital-station", "asteroid-refinery", "jovian-harvester", "solar-yard", "lattice-annex"], excludedVariants: ["droneCarrier"] },
  { id: "emergencyShutters", name: "Emergency Shutters", shortName: "SHUTTERS", family: "control", threatCost: 4, rewardWeight: 1, tell: "Amber lane markers illuminate before portable shutters rise.", counter: "Destroy or penetrate the shutters, or reposition before closure.", baseCooldown: 8.8, enhanceable: true, locations: ["orbital-station", "damaged-vessel", "spin-habitat", "lattice-annex", "momentum-exchange", "cryo-reserve"] },
  { id: "sensorGhost", name: "Sensor Ghost", shortName: "GHOST", family: "control", threatCost: 3, rewardWeight: 1, tell: "The silhouette doubles on assisted targeting returns.", counter: "Sensor Spike resolves the true return; manual aim remains available.", baseCooldown: 8.1, locations: ["spin-habitat", "ice-mine", "lattice-annex"] },
  { id: "signalJammer", name: "Signal Jammer", shortName: "JAMMER", family: "control", threatCost: 4, rewardWeight: 1, tell: "A violet interference ring expands around the unit.", counter: "Break range or Arc-disrupt the jammer before its pulse.", baseCooldown: 7.1, enhanceable: true, locations: ["orbital-station", "jovian-harvester", "solar-yard", "lattice-annex"] },
  { id: "thermalOverrun", name: "Thermal Overrun", shortName: "REDLINE", family: "fire", threatCost: 4, rewardWeight: 1, tell: "Weapon coils glow before a committed burst and forced cooldown.", counter: "Break line of sight or interrupt the telegraph, then punish self-stagger.", baseCooldown: 7.5, enhanceable: true, locations: ["asteroid-refinery", "jovian-harvester", "solar-yard", "cryo-reserve"] },
  { id: "suppressionCoordinator", name: "Suppression Coordinator", shortName: "COORD", family: "fire", threatCost: 4, rewardWeight: 1, tell: "Squad firing markers synchronize around the coordinator.", counter: "Disrupt or kill the coordinator to break the synchronized window.", baseCooldown: 8, enhanceable: true, locations: ["orbital-station", "asteroid-refinery", "spin-habitat", "ice-mine"] },
  { id: "penetratorVolley", name: "Penetrator Volley", shortName: "PEN-VOLLEY", family: "fire", threatCost: 4, rewardWeight: 1, tell: "A long straight-line firing solution locks before the volley.", counter: "Dodge the visible solution, use hard cover, or interrupt it.", baseCooldown: 7.2, enhanceable: true, locations: ["orbital-station", "asteroid-refinery", "ice-mine", "lattice-annex", "momentum-exchange", "cryo-reserve"] },
  { id: "salvageInterdictor", name: "Salvage Interdictor", shortName: "INTERDICT", family: "objective", threatCost: 4, rewardWeight: 2, tell: "Recovery-tag telemetry is copied to the hostile unit.", counter: "Intercept the carrier; death restores the package tag.", baseCooldown: 5.4, enhanceable: true, objectiveModes: ["machinery-recovery", "deep-salvage"], excludedVariants: ["salvageThief"] },
  { id: "recoveryDenial", name: "Recovery Denial", shortName: "DENIAL", family: "objective", threatCost: 4, rewardWeight: 2, tell: "A denial grid forms around tagged objective hardware.", counter: "Disrupt the projector, isolate the grid, or approach from another lane.", baseCooldown: 6.3, enhanceable: true, objectiveModes: ["machinery-recovery", "deep-salvage"] }
];
const byId = new Map(eliteProtocolDefinitions.map((definition) => [definition.id, definition]));
const locationBias = {
  "orbital-station": ["reactivePlating", "emergencyShutters", "suppressionCoordinator", "magneticLock", "arcConduit", "penetratorVolley"],
  "damaged-vessel": ["pressureHunter", "vacuumAdapted", "breachmaker", "emergencyShutters", "reactivePlating"],
  "asteroid-refinery": ["breachmaker", "repairMesh", "thermalOverrun", "gravityAnchor", "arcConduit", "suppressionCoordinator"],
  "spin-habitat": ["gravityAnchor", "countermassMobility", "sensorGhost", "magneticLock", "suppressionCoordinator", "emergencyShutters"],
  "jovian-harvester": ["vacuumAdapted", "pressureHunter", "magneticLock", "countermassMobility", "thermalOverrun", "signalJammer"],
  "ice-mine": ["sensorGhost", "countermassMobility", "penetratorVolley", "suppressionCoordinator", "vacuumAdapted", "breachmaker"],
  "solar-yard": ["arcConduit", "droneEscort", "repairMesh", "thermalOverrun", "signalJammer", "gravityAnchor"],
  "lattice-annex": ["sensorGhost", "gravityAnchor", "arcConduit", "emergencyShutters", "signalJammer", "penetratorVolley"],
  "momentum-exchange": ["countermassMobility", "penetratorVolley", "repairMesh", "emergencyShutters", "reactivePlating", "magneticLock"],
  "cryo-reserve": ["vacuumAdapted", "thermalOverrun", "repairMesh", "emergencyShutters", "reactivePlating", "penetratorVolley"]
};
function hash32(value) {
  let x = value >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}
function protocolDefinition(id) {
  return byId.get(id);
}
function protocolThreatCost(instance) {
  return protocolDefinition(instance.id).threatCost + (instance.enhanced ? 1 : 0);
}
function eligible(definition, contract, role, variant) {
  var _a;
  if (definition.locations && !definition.locations.includes(contract.location)) return false;
  if (definition.roles && !definition.roles.includes(role)) return false;
  if ((_a = definition.excludedVariants) == null ? void 0 : _a.includes(variant)) return false;
  if (definition.objectiveModes && !definition.objectiveModes.includes(contract.objectiveMode)) return false;
  return true;
}
function chooseEnemyProtocols(contract, role, variant, count, enemyId) {
  const directiveBias = (contract.directiveProtocolBias ?? []).filter((id) => byId.has(id));
  const bias = [...directiveBias, ...locationBias[contract.location] ?? []].filter((id, index, all) => all.indexOf(id) === index);
  const chosenFamilies = /* @__PURE__ */ new Set();
  const candidates = eliteProtocolDefinitions.filter((definition) => eligible(definition, contract, role, variant)).sort((a, b) => {
    const aBias = bias.indexOf(a.id);
    const bBias = bias.indexOf(b.id);
    const aRank = aBias < 0 ? 99 : aBias;
    const bRank = bBias < 0 ? 99 : bBias;
    if (aRank !== bRank) return aRank - bRank;
    return hash32(contract.seed ^ enemyId * 7919 ^ a.id.length * 104729) - hash32(contract.seed ^ enemyId * 7919 ^ b.id.length * 104729);
  });
  const result = [];
  for (const definition of candidates) {
    if (result.length >= count || chosenFamilies.has(definition.family)) continue;
    chosenFamilies.add(definition.family);
    const tier = contract.operationTier ?? 1;
    const enhancedChance = tier >= 12 ? 42 : tier >= 10 ? 24 : 0;
    const roll = hash32(contract.seed ^ enemyId * 2654435761 ^ definition.id.length * 31337) % 100;
    const enhanced = !!definition.enhanceable && enhancedChance > 0 && roll < enhancedChance;
    const cooldownJitter = hash32(contract.seed ^ enemyId * 131 ^ result.length * 17) % 140 / 100;
    result.push({ id: definition.id, enhanced, cooldown: 1.6 + cooldownJitter, windup: 0 });
  }
  return result;
}
const roleThreat = { assault: 6, suppressor: 7, technician: 7, elite: 14, boss: 0 };
const combatClassThreat = { standard: 0, enhanced: 3, elite: 5, command: 0 };
const variantThreat = { shieldBoarder: 4, tetherOperator: 3, droneCarrier: 3, coverBreacher: 3, marksman: 3, vacuumSaboteur: 3, repairDrone: 2, gravitySpecialist: 3, meleeExosuit: 5, salvageThief: 2, vectorSkirmisher: 2, anchorEngineer: 5, barricadeTrooper: 3, pressureLockTech: 3, tetherRigger: 3, maintenanceDrone: 2, gravityDrone: 3, impulseRigger: 3, boiloffTech: 3, partitionRigger: 4, recoilBroker: 3, siphonTech: 4, purgeOrchestrator: 4, custodyPorter: 4, geometryTech: 4 };
function enemyThreatCost(enemy) {
  return roleThreat[enemy.role] + (variantThreat[enemy.variant] ?? 0) + combatClassThreat[enemy.combatClass] + enemy.protocols.reduce((total, protocol) => total + protocolThreatCost(protocol), 0);
}
function authoredEliteRequired(contract) {
  if (contract.megastructureStage === 2 || contract.storyFinale || contract.campaignFinale || contract.escalationFinale) return true;
  return ["Recovery Commander Sable Voss", "Salvage Captain Rhea Kade", "Foundry Marshal Cael", "HELIOS-9 Yardmind", "Transfer Adjudicator Iona Vale", "Umbra Systems Marshal Oren Saal", "Custody Director Mara Teth"].includes(contract.deepTarget);
}
function deterministicRank(contract, enemy) {
  let value = (contract.seed ^ enemy.id * 7919 ^ (contract.operationTier ?? 1) * 104729) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}
function applyThreatBudget(enemies, contract) {
  var _a;
  const budget = contract.threatBudget ?? 34;
  const pattern = contract.encounterPattern ?? "mixed";
  const effectiveness = contract.combatEffectiveness ?? 1;
  const tier = contract.operationTier ?? 1;
  const protocolCapacity = contract.eliteProtocolSlots ?? 0;
  const regular = enemies.filter((enemy) => enemy.role !== "boss" && enemy.id <= 8);
  for (const enemy of enemies) {
    enemy.protocols = [];
    enemy.protocolPulse = 0;
    enemy.combatClass = enemy.role === "boss" ? "command" : enemy.role === "elite" ? "elite" : "standard";
  }
  for (const enemy of regular) {
    enemy.effectiveness = effectiveness;
    enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * effectiveness));
    enemy.hp = enemy.maxHp;
    enemy.maxArmor = Math.max(0, Math.round(enemy.maxArmor * effectiveness));
    enemy.armor = enemy.maxArmor;
  }
  const boss = enemies.find((enemy) => enemy.role === "boss");
  if (boss) {
    const bossEffectiveness = Math.max(1, 1 + (effectiveness - 1) * 0.82);
    boss.effectiveness = bossEffectiveness;
    boss.maxHp = Math.max(1, Math.round(boss.maxHp * bossEffectiveness));
    boss.hp = boss.maxHp;
    boss.maxArmor = Math.max(0, Math.round(boss.maxArmor * bossEffectiveness));
    boss.armor = boss.maxArmor;
  }
  const reserveCommitment = (contract.reserveCount ?? 1) * 3;
  const environmentCommitment = (contract.environmentalEventSlots ?? 1) * 2;
  const protocolCommitment = protocolCapacity <= 0 ? 0 : Math.min(28, protocolCapacity * 4 + Math.max(0, tier - 5) + (contract.directiveProtocolDensity ?? 0) * 3);
  const bodyBudget = Math.max(22, budget - reserveCommitment - environmentCommitment - protocolCommitment);
  const core = regular.filter((enemy) => enemy.id <= 6);
  for (const enemy of core) enemy.active = false;
  const forcedElite = authoredEliteRequired(contract) ? core.find((enemy) => enemy.role === "elite") : void 0;
  const forcedRepair = ((_a = contract.directiveModifierIds) == null ? void 0 : _a.includes("repair-network")) ? core.find((enemy) => enemy.variant === "repairDrone") : void 0;
  const ordered = [...core].sort((a, b) => {
    if (pattern === "swarm") return enemyThreatCost(a) - enemyThreatCost(b) || a.id - b.id;
    if (pattern === "elite-led") {
      const eliteDelta = Number(b.role === "elite") - Number(a.role === "elite");
      return eliteDelta || enemyThreatCost(b) - enemyThreatCost(a) || a.id - b.id;
    }
    return a.id - b.id;
  });
  const selected = /* @__PURE__ */ new Set();
  let spent = 0;
  const select = (enemy) => {
    if (selected.has(enemy.id)) return;
    selected.add(enemy.id);
    enemy.active = true;
    enemy.dead = false;
    spent += enemyThreatCost(enemy);
  };
  if (forcedElite) select(forcedElite);
  if (forcedRepair) select(forcedRepair);
  for (const enemy of ordered) {
    if (selected.has(enemy.id)) continue;
    if (selected.size < 4 || spent + enemyThreatCost(enemy) <= bodyBudget) select(enemy);
  }
  let protocolBudget = protocolCommitment;
  const active = core.filter((enemy) => selected.has(enemy.id));
  const packageEnemy = (enemy, combatClass, wantedCount) => {
    if (wantedCount <= 0 || protocolBudget <= 0) return false;
    const options = chooseEnemyProtocols(contract, enemy.role, enemy.variant, wantedCount, enemy.id);
    if (options.length === 0) return false;
    const classDelta = Math.max(0, combatClassThreat[combatClass] - combatClassThreat[enemy.combatClass]);
    let localCost = classDelta;
    const accepted = [];
    for (const option of options) {
      const nextCost = protocolThreatCost(option);
      if (localCost + nextCost > protocolBudget) continue;
      accepted.push(option);
      localCost += nextCost;
    }
    if (accepted.length === 0) return false;
    enemy.combatClass = combatClass;
    enemy.protocols = accepted;
    protocolBudget -= localCost;
    return true;
  };
  const activeElite = active.find((enemy) => enemy.role === "elite");
  if (activeElite && protocolCapacity > 0) packageEnemy(activeElite, "elite", protocolCapacity);
  const candidates = active.filter((enemy) => enemy !== activeElite).sort((a, b) => deterministicRank(contract, a) - deterministicRank(contract, b));
  if (!activeElite && tier >= 8 && candidates[0]) packageEnemy(candidates[0], "elite", Math.min(protocolCapacity, tier >= 10 ? 3 : 2));
  const enhancedLimit = Math.min(3, (tier >= 9 ? 2 : protocolCapacity > 0 ? 1 : 0) + ((contract.directiveProtocolDensity ?? 0) > 0 ? 1 : 0));
  let enhanced = 0;
  for (const enemy of candidates) {
    if (enemy.combatClass !== "standard" || enhanced >= enhancedLimit) continue;
    const count = tier >= 7 ? Math.min(2, protocolCapacity) : 1;
    if (packageEnemy(enemy, "enhanced", count)) enhanced += 1;
  }
  if (tier >= 6 && protocolBudget > 0) {
    const reserve = regular.filter((enemy) => enemy.id >= 7).sort((a, b) => deterministicRank(contract, a) - deterministicRank(contract, b))[0];
    if (reserve) packageEnemy(reserve, "enhanced", 1);
  }
}
const weaponConfigs = {
  carbine: { id: "carbine", name: "Vektor M-7 Coil Carbine", shortName: "M-7 CARBINE", damage: 18, rate: 7.8, projectileSpeed: 860, penetration: 20, recoil: 38, spread: 0.018, heatPerShot: 0.058, heatDissipation: 0.23, magazine: 30, reloadSeconds: 1.35, armorDamage: 0.72, healthMultiplier: 1, knockback: 0.055, pellets: 1, capacitorCost: 0 },
  breacher: { id: "breacher", name: "Kestrel B-4 Breach Scattergun", shortName: "B-4 BREACHER", damage: 11, rate: 1.25, projectileSpeed: 560, penetration: 8, recoil: 112, spread: 0.16, heatPerShot: 0.17, heatDissipation: 0.2, magazine: 6, reloadSeconds: 1.85, armorDamage: 0.34, healthMultiplier: 1.45, knockback: 0.11, pellets: 7, capacitorCost: 0 },
  rail: { id: "rail", name: "Helix R-2 Rail Lance", shortName: "R-2 RAIL LANCE", damage: 48, rate: 0.82, projectileSpeed: 1380, penetration: 115, recoil: 168, spread: 4e-3, heatPerShot: 0.28, heatDissipation: 0.16, magazine: 5, reloadSeconds: 2.1, armorDamage: 1.75, healthMultiplier: 0.92, knockback: 0.12, pellets: 1, capacitorCost: 10 }
};
const neutralCombatBuild = { weapon: { carbine: { damageMul: 1, speedMul: 1, penetrationAdd: 0, recoilMul: 1, heatPerShotMul: 1, heatDissipationMul: 1, magazineAdd: 0, reloadMul: 1, armorDamageMul: 1, healthMultiplierMul: 1, knockbackMul: 1 }, breacher: { damageMul: 1, speedMul: 1, penetrationAdd: 0, recoilMul: 1, heatPerShotMul: 1, heatDissipationMul: 1, magazineAdd: 0, reloadMul: 1, armorDamageMul: 1, healthMultiplierMul: 1, knockbackMul: 1 }, rail: { damageMul: 1, speedMul: 1, penetrationAdd: 0, recoilMul: 1, heatPerShotMul: 1, heatDissipationMul: 1, magazineAdd: 0, reloadMul: 1, armorDamageMul: 1, healthMultiplierMul: 1, knockbackMul: 1 } }, player: { maxHpAdd: 0, maxArmorAdd: 0, maxCapAdd: 0, moveSpeedMul: 1, capRegenMul: 1, vacuumResistance: 0, lowGControl: 0, ventSpeedMul: 1 }, mechanics: { railFragment: false, railFragmentScale: 0, dodgeVent: false, dodgeVentScale: 0, magRedirect: false, magRedirectScale: 0, breacherPropulsion: false, breacherPropulsionScale: 0, markWeakArmor: false, markWeakArmorScale: 0, arcDrone: false, arcDroneScale: 0, recoilVectoring: false, breachDoctrine: false, sensorPenetration: false, widebandMark: false, magOverdriveKick: false, arcGroundLoop: false, magBoundarySink: false, markExecutionTrace: false, arcCascadeLattice: false }, singularTraits: [], specialization: null, specializationOverclock: false, abilities: [{ costMul: 1, cooldownMul: 1, powerMul: 1 }, { costMul: 1, cooldownMul: 1, powerMul: 1 }, { costMul: 1, cooldownMul: 1, powerMul: 1 }] };
function resolveWeaponConfig(build, id) {
  const base = weaponConfigs[id];
  const mod = build.weapon[id];
  return { ...base, damage: base.damage * mod.damageMul, projectileSpeed: base.projectileSpeed * mod.speedMul, penetration: base.penetration + mod.penetrationAdd, recoil: base.recoil * mod.recoilMul, heatPerShot: base.heatPerShot * mod.heatPerShotMul, heatDissipation: base.heatDissipation * mod.heatDissipationMul, magazine: Math.max(1, Math.round(base.magazine + mod.magazineAdd)), reloadSeconds: base.reloadSeconds * mod.reloadMul, armorDamage: base.armorDamage * mod.armorDamageMul, healthMultiplier: base.healthMultiplier * mod.healthMultiplierMul, knockback: base.knockback * mod.knockbackMul };
}
function blankStatuses() {
  return { armorBreach: 0, disrupted: 0, marked: 0, stagger: 0, conductive: 0, vacuum: 0 };
}
function spawnEnemy(id, role, label, x, y, hp, armor, sign, active = true, variant = "standard") {
  return { id, role, variant, combatClass: role === "boss" ? "command" : role === "elite" ? "elite" : "standard", protocols: [], protocolPulse: 0, label, x, y, vx: 0, vy: 0, hp, maxHp: hp, armor, maxArmor: armor, effectiveness: 1, fireCooldown: 0.8 + id * 0.17, telegraph: 0, telegraphAim: { x: -1, y: 0 }, strafeSign: sign, dead: false, deathT: 0, active, state: "hold", hazardCooldown: 2.5 + id * 0.4, burst: 0, carriedObjectId: null, statuses: blankStatuses(), bossPhase: 1, bossPattern: "none", patternIndex: 0, anchored: role === "elite" || role === "boss" };
}
function createSimulation(build = neutralCombatBuild) {
  const carbineConfig = resolveWeaponConfig(build, "carbine");
  const breacherConfig = resolveWeaponConfig(build, "breacher");
  const railConfig = resolveWeaponConfig(build, "rail");
  const objects = [
    { id: "crate-a", label: "Light cargo stack", kind: "cover", material: "light", x: 540, y: 390, w: 120, h: 180, hp: 70, maxHp: 70, destructible: true, active: true, exposed: false },
    { id: "bulkhead-a", label: "Compressor housing", kind: "cover", material: "bulkhead", x: 860, y: 650, w: 190, h: 82, hp: 9999, maxHp: 9999, destructible: false, active: true, exposed: false },
    { id: "crate-b", label: "Transfer pallet", kind: "cover", material: "light", x: 1060, y: 285, w: 120, h: 150, hp: 62, maxHp: 62, destructible: true, active: true, exposed: false },
    { id: "bulkhead-b", label: "Pressure machinery", kind: "cover", material: "industrial", x: 1310, y: 585, w: 150, h: 120, hp: 170, maxHp: 170, destructible: true, active: true, exposed: false },
    { id: "conduit-a", label: "Main bus conduit", kind: "conduit", material: "system", x: 1185, y: 735, w: 78, h: 70, hp: 75, maxHp: 75, destructible: true, active: true, exposed: false },
    { id: "coolant-a", label: "Coolant riser", kind: "coolant", material: "system", x: 920, y: 300, w: 52, h: 86, hp: 54, maxHp: 54, destructible: true, active: true, exposed: false },
    { id: "service-plate", label: "Service hull plate", kind: "breachPlate", material: "industrial", x: 1285, y: 175, w: 170, h: 42, hp: 82, maxHp: 82, destructible: true, active: true, exposed: false },
    { id: "door-control", label: "Pressure door control", kind: "doorControl", material: "system", x: 745, y: 735, w: 34, h: 58, hp: 40, maxHp: 40, destructible: false, active: true, exposed: false },
    { id: "gravity-control", label: "Transfer spin control", kind: "gravityControl", material: "system", x: 1240, y: 205, w: 42, h: 58, hp: 40, maxHp: 40, destructible: false, active: true, exposed: false },
    { id: "arena-conduit", label: "Crane power trunk", kind: "conduit", material: "system", x: 1850, y: 710, w: 82, h: 72, hp: 88, maxHp: 88, destructible: true, active: true, exposed: false },
    { id: "arena-cover", label: "Crane carriage", kind: "cover", material: "industrial", x: 1900, y: 330, w: 180, h: 88, hp: 185, maxHp: 185, destructible: true, active: true, exposed: false },
    { id: "boss-gate", label: "Crane well pressure gate", kind: "cover", material: "bulkhead", x: 1492, y: 160, w: 28, h: 760, hp: 9999, maxHp: 9999, destructible: false, active: true, exposed: false },
    { id: "boss-seal", label: "Emergency hull shutter", kind: "sealControl", material: "system", x: 1688, y: 228, w: 42, h: 62, hp: 40, maxHp: 40, destructible: false, active: true, exposed: false },
    { id: "enemy-tether-a", label: "Mag tether coupling", kind: "anchorNode", material: "system", x: 0, y: 0, w: 34, h: 34, hp: 48, maxHp: 48, destructible: true, active: false, exposed: true },
    { id: "enemy-tether-b", label: "Mag tether coupling", kind: "anchorNode", material: "system", x: 0, y: 0, w: 34, h: 34, hp: 48, maxHp: 48, destructible: true, active: false, exposed: true },
    { id: "protocol-shutter-a", label: "Protocol emergency shutter", kind: "cover", material: "industrial", x: 1030, y: 330, w: 54, h: 168, hp: 110, maxHp: 110, destructible: true, active: false, exposed: false },
    { id: "protocol-shutter-b", label: "Protocol emergency shutter", kind: "cover", material: "industrial", x: 1230, y: 610, w: 54, h: 168, hp: 110, maxHp: 110, destructible: true, active: false, exposed: false }
  ];
  return {
    time: 0,
    build,
    weapons: { carbine: carbineConfig, breacher: breacherConfig, rail: railConfig },
    droneTick: 0,
    lastAbilityIndex: -1,
    lastAbilityAt: -99,
    abilityChain: 0,
    bossGateHold: false,
    operationTier: 1,
    monsterLevel: 1,
    maxRecoveryLevel: 12,
    monsterDamageScale: 1,
    groundLoot: [],
    collectedLoot: [],
    player: { x: 330, y: 590, vx: 0, vy: 0, aim: { x: 1, y: 0 }, move: { x: 0, y: 0 }, hp: 100 + build.player.maxHpAdd, maxHp: 100 + build.player.maxHpAdd, armor: 68 + build.player.maxArmorAdd, maxArmor: 68 + build.player.maxArmorAdd, capacitor: 100 + build.player.maxCapAdd, maxCapacitor: 100 + build.player.maxCapAdd, fireCooldown: 0, abilityCooldowns: [0, 0, 0], dodgeCooldown: 0, dodgeTime: 0, lastDodgeAt: -99, invulnerable: 0, consumableCooldown: 0, weaponHeat: { carbine: 0, breacher: 0, rail: 0 }, mags: { carbine: carbineConfig.magazine, breacher: breacherConfig.magazine, rail: railConfig.magazine }, reloadT: 0, reloadWeapon: "carbine", ventT: 0, dead: false, currentWeapon: "carbine", vacuumExposure: 0, disrupted: 0 },
    enemies: [spawnEnemy(1, "assault", "Pressure Raider", 760, 500, 76, 38, 1), spawnEnemy(2, "suppressor", "Line Suppressor", 1030, 655, 82, 46, -1), spawnEnemy(3, "technician", "Systems Tech", 1140, 330, 70, 34, 1), spawnEnemy(4, "assault", "Pressure Raider", 1320, 540, 78, 40, -1), spawnEnemy(5, "suppressor", "Line Suppressor", 1370, 760, 84, 48, 1), spawnEnemy(6, "elite", "Anchor Marshal", 1270, 430, 140, 105, -1), spawnEnemy(7, "assault", "Reserve Raider", 1450, 300, 76, 38, 1, false), spawnEnemy(8, "technician", "Reserve Systems Tech", 1320, 790, 72, 36, -1, false), spawnEnemy(9, "technician", "Carrier Repair Drone", 0, 0, 52, 20, 1, false, "repairDrone"), spawnEnemy(10, "technician", "Carrier Repair Drone", 0, 0, 52, 20, -1, false, "repairDrone"), spawnEnemy(99, "boss", "Dock Warden Orison", 2070, 525, 560, 185, 1, false, "orison")],
    projectiles: Array.from({ length: 112 }, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 4, damage: 0, life: 0, owner: "player", weapon: "carbine", penetration: 0, armorDamage: 0.5, healthMultiplier: 1, knockback: 0.05, lastObjectId: null, lastObjectT: 0 })),
    objects,
    sectors: [
      { id: "A", label: "SPIN DECK", x: 80, y: 160, w: 690, h: 760, pressure: 1, pressureState: "normal", gravity: 1, rapidTimer: 0, targetPressure: 1 },
      { id: "B", label: "TRANSFER BAY", x: 770, y: 160, w: 740, h: 760, pressure: 0.88, pressureState: "normal", gravity: 0.34, rapidTimer: 0, targetPressure: 0.88 },
      { id: "C", label: "CRANE WELL", x: 1510, y: 160, w: 730, h: 760, pressure: 1, pressureState: "normal", gravity: 0.72, rapidTimer: 0, targetPressure: 1 }
    ],
    links: [{ id: "door-ab", a: "A", b: "B", open: true, conductance: 0.045 }, { id: "door-bc", a: "B", b: "C", open: false, conductance: 0.055 }],
    breaches: [{ id: "service-breach", sectorId: "B", x: 1370, y: 160, active: false, sealed: false, strength: 980, radius: 620, boss: false }, { id: "boss-breach", sectorId: "C", x: 2220, y: 515, active: false, sealed: false, strength: 1280, radius: 690, boss: true }],
    hazards: Array.from({ length: 12 }, () => ({ active: false, x: 0, y: 0, radius: 0, life: 0, kind: "shockGrid", owner: "enemy" })),
    debris: Array.from({ length: 16 }, (_, index) => ({ active: false, x: index < 8 ? 930 + index % 4 * 145 : 1770 + index % 4 * 135, y: 265 + index % 5 * 115, vx: 0, vy: 0, radius: 8 + index % 3 * 3, sectorId: index < 8 ? "B" : "C" })),
    effects: Array.from({ length: 30 }, () => ({ active: false, x: 0, y: 0, kind: "impact", life: 0, maxLife: 0, radius: 0 })),
    complete: false,
    bossActive: false,
    bossDefeated: false,
    pulse: 0,
    weaponFlash: 0,
    kills: 0,
    squadSuppressing: false,
    eventText: "VECTOR SYSTEM ONLINE // MULTI-SYSTEM COMBAT AUTHORIZED",
    eventT: 3,
    telemetry: { damageDealt: 0, damageTaken: 0, deaths: 0, kills: 0, eliteKills: 0, eliteProtocolsDefeated: 0, killIntervalTotal: 0, killIntervalSamples: 0, lastKillAt: 0, protocolCombinations: {}, weaponShots: { carbine: 0, breacher: 0, rail: 0 }, abilityUses: [0, 0, 0], encounterStart: 0, bossStart: 0, duration: 0, trace: [], nextTraceAt: 0 }
  };
}
function setRole(state, id, role, label) {
  const enemy = state.enemies.find((item) => item.id === id);
  if (!enemy) return;
  enemy.role = role;
  enemy.label = label;
  enemy.anchored = role === "elite" || role === "boss";
}
function setTacticalEnemy(state, id, role, variant, label, hp, armor) {
  const enemy = state.enemies.find((item) => item.id === id);
  if (!enemy) return;
  enemy.role = role;
  enemy.variant = variant;
  enemy.label = label;
  enemy.anchored = role === "elite";
  if (typeof hp === "number") {
    enemy.hp = hp;
    enemy.maxHp = hp;
  }
  if (typeof armor === "number") {
    enemy.armor = armor;
    enemy.maxArmor = armor;
  }
}
function configureTacticalRoster(state, contract) {
  if (contract.deepTarget === "Transfer Adjudicator Iona Vale") {
    setTacticalEnemy(state, 1, "technician", "partitionRigger", "Brake-Line Partition Rigger", 82, 40);
    setTacticalEnemy(state, 2, "suppressor", "marksman", "Custody Longline Marksman", 76, 34);
    setTacticalEnemy(state, 3, "assault", "recoilBroker", "Counterforce Broker", 90, 44);
    setTacticalEnemy(state, 4, "assault", "recoilBroker", "Transfer Recoil Broker", 94, 48);
    setTacticalEnemy(state, 5, "technician", "repairDrone", "Flywheel Custody Repair Drone", 66, 30);
    setTacticalEnemy(state, 6, "elite", "impulseRigger", "Brake-Line Senior Rigger", 168, 112);
    setTacticalEnemy(state, 7, "technician", "partitionRigger", "Reserve Partition Rigger", 82, 38);
    setTacticalEnemy(state, 8, "suppressor", "marksman", "Outbound Custody Marksman", 74, 32);
    return;
  }
  if (contract.deepTarget === "Umbra Systems Marshal Oren Saal") {
    setTacticalEnemy(state, 1, "technician", "purgeOrchestrator", "Umbra Purge Orchestrator", 84, 42);
    setTacticalEnemy(state, 2, "assault", "shieldBoarder", "Cold-Line Shield Boarder", 94, 102);
    setTacticalEnemy(state, 3, "technician", "siphonTech", "Capacitor Siphon Tech", 82, 40);
    setTacticalEnemy(state, 4, "suppressor", "marksman", "Umbra Gallery Marksman", 74, 32);
    setTacticalEnemy(state, 5, "technician", "repairDrone", "Purge Network Repair Drone", 66, 30);
    setTacticalEnemy(state, 6, "elite", "boiloffTech", "Senior Boiloff Controller", 166, 108);
    setTacticalEnemy(state, 7, "technician", "siphonTech", "Reserve Siphon Tech", 80, 38);
    setTacticalEnemy(state, 8, "technician", "purgeOrchestrator", "Reserve Purge Orchestrator", 82, 40);
    return;
  }
  if (contract.deepTarget === "Custody Director Mara Teth") {
    setTacticalEnemy(state, 1, "assault", "custodyPorter", "Custody Hardware Porter", 86, 42);
    setTacticalEnemy(state, 2, "suppressor", "marksman", "Archive Geometry Marksman", 76, 34);
    setTacticalEnemy(state, 3, "technician", "geometryTech", "Custody Geometry Tech", 82, 40);
    setTacticalEnemy(state, 4, "assault", "custodyPorter", "Relay Hardware Porter", 88, 44);
    setTacticalEnemy(state, 5, "technician", "repairDrone", "Custody Relay Repair Drone", 66, 30);
    setTacticalEnemy(state, 6, "elite", "meleeExosuit", "Custody Recovery Exosuit", 174, 122);
    setTacticalEnemy(state, 7, "technician", "geometryTech", "Reserve Geometry Tech", 80, 38);
    setTacticalEnemy(state, 8, "assault", "custodyPorter", "Reserve Custody Porter", 84, 40);
    return;
  }
  if (contract.location === "orbital-station") {
    setTacticalEnemy(state, 1, "assault", "shieldBoarder", "Meridian Shield Boarder", 92, 105);
    setTacticalEnemy(state, 2, "suppressor", "marksman", "Longline Marksman", 72, 32);
    setTacticalEnemy(state, 3, "technician", "droneCarrier", "Utility Drone Carrier", 82, 42);
    setTacticalEnemy(state, 4, "assault", "coverBreacher", "Bulkhead Breacher", 96, 54);
    setTacticalEnemy(state, 5, "technician", "repairDrone", "Maintenance Repair Drone", 62, 26);
    setTacticalEnemy(state, 6, "elite", "meleeExosuit", "Boarding Exosuit", 165, 118);
    setTacticalEnemy(state, 7, "assault", "salvageThief", "Recovery Thief", 74, 28);
    setTacticalEnemy(state, 8, "technician", "gravitySpecialist", "Mass-Control Specialist", 78, 38);
  } else if (contract.location === "damaged-vessel") {
    setTacticalEnemy(state, 1, "assault", "vacuumSaboteur", "Vacuum Raider", 88, 44);
    setTacticalEnemy(state, 2, "suppressor", "marksman", "Hull-Lane Marksman", 72, 30);
    setTacticalEnemy(state, 3, "technician", "tetherOperator", "Mag-Tether Operator", 78, 38);
    setTacticalEnemy(state, 4, "assault", "coverBreacher", "Compartment Breacher", 94, 50);
    setTacticalEnemy(state, 5, "technician", "repairDrone", "Hull Repair Drone", 62, 24);
    setTacticalEnemy(state, 6, "elite", "meleeExosuit", "Vacuum Boarding Exosuit", 160, 105);
    setTacticalEnemy(state, 7, "assault", "salvageThief", "Manifest Thief", 72, 26);
    setTacticalEnemy(state, 8, "assault", "vacuumSaboteur", "Reserve Vacuum Raider", 82, 38);
  } else if (contract.location === "asteroid-refinery") {
    setTacticalEnemy(state, 1, "assault", "coverBreacher", "Crusher Breacher", 96, 56);
    setTacticalEnemy(state, 2, "suppressor", "marksman", "Gantry Marksman", 74, 34);
    setTacticalEnemy(state, 3, "technician", "repairDrone", "Foundry Repair Drone", 64, 28);
    setTacticalEnemy(state, 5, "technician", "droneCarrier", "Oreline Drone Carrier", 84, 44);
    setTacticalEnemy(state, 7, "technician", "gravitySpecialist", "Transfer Mass Specialist", 80, 40);
    setTacticalEnemy(state, 8, "elite", "meleeExosuit", "Crusher Exosuit", 166, 112);
  } else if (contract.location === "spin-habitat") {
    setTacticalEnemy(state, 2, "suppressor", "marksman", "Spoke Marksman", 74, 36);
    setTacticalEnemy(state, 5, "technician", "gravitySpecialist", "Spin-Trim Specialist", 80, 42);
    setTacticalEnemy(state, 7, "technician", "droneCarrier", "Ring Drone Carrier", 82, 44);
    setTacticalEnemy(state, 8, "assault", "shieldBoarder", "Axis Shield Boarder", 92, 100);
  } else if (contract.location === "jovian-harvester") {
    setTacticalEnemy(state, 1, "assault", "vacuumSaboteur", "Storm Vacuum Raider", 90, 46);
    setTacticalEnemy(state, 2, "technician", "tetherOperator", "Skimmer Tether Operator", 80, 40);
    setTacticalEnemy(state, 3, "suppressor", "marksman", "Crown Marksman", 74, 32);
    setTacticalEnemy(state, 4, "assault", "coverBreacher", "Pressure-Shell Breacher", 98, 54);
    setTacticalEnemy(state, 5, "technician", "repairDrone", "Skimmer Repair Drone", 64, 26);
    setTacticalEnemy(state, 6, "elite", "meleeExosuit", "Storm Boarding Exosuit", 168, 110);
    setTacticalEnemy(state, 7, "assault", "salvageThief", "Skimmer Salvage Thief", 74, 28);
    setTacticalEnemy(state, 8, "technician", "droneCarrier", "Compressor Drone Carrier", 82, 40);
  } else if (contract.location === "ice-mine") {
    setTacticalEnemy(state, 2, "suppressor", "marksman", "Bore Marksman", 72, 30);
    setTacticalEnemy(state, 5, "assault", "coverBreacher", "Tunnel Breacher", 94, 48);
    setTacticalEnemy(state, 7, "assault", "salvageThief", "Cryobore Salvage Thief", 72, 26);
    setTacticalEnemy(state, 8, "elite", "meleeExosuit", "Mining Exosuit", 162, 104);
  } else if (contract.location === "solar-yard") {
    setTacticalEnemy(state, 5, "technician", "droneCarrier", "Fabrication Drone Carrier", 82, 42);
    setTacticalEnemy(state, 7, "suppressor", "marksman", "Sunline Marksman", 72, 30);
    setTacticalEnemy(state, 8, "technician", "gravitySpecialist", "Mirror Mass Specialist", 78, 38);
  } else if (contract.location === "lattice-annex") {
    setTacticalEnemy(state, 1, "assault", "shieldBoarder", "Survey Shield Custodian", 96, 112);
    setTacticalEnemy(state, 2, "suppressor", "marksman", "Metrology Marksman", 78, 36);
    setTacticalEnemy(state, 3, "technician", "gravitySpecialist", "Reference Mass Technician", 82, 42);
    setTacticalEnemy(state, 4, "assault", "coverBreacher", "Archive Breacher", 98, 56);
    setTacticalEnemy(state, 5, "technician", "repairDrone", "Khepri Maintenance Drone", 66, 30);
    setTacticalEnemy(state, 6, "elite", "meleeExosuit", "Survey Recovery Exosuit", 178, 128);
    setTacticalEnemy(state, 7, "technician", "droneCarrier", "Reference Drone Carrier", 88, 46);
    setTacticalEnemy(state, 8, "suppressor", "marksman", "Vault Marksman", 80, 38);
  } else if (contract.location === "momentum-exchange") {
    setTacticalEnemy(state, 1, "assault", "impulseRigger", "Exchange Impulse Rigger", 94, 48);
    setTacticalEnemy(state, 2, "suppressor", "marksman", "Transfer-Lane Marksman", 76, 34);
    setTacticalEnemy(state, 3, "technician", "gravitySpecialist", "Countermass Technician", 84, 44);
    setTacticalEnemy(state, 4, "assault", "impulseRigger", "Capture-Lane Rigger", 98, 52);
    setTacticalEnemy(state, 5, "technician", "repairDrone", "Flywheel Service Drone", 66, 28);
    setTacticalEnemy(state, 6, "elite", "meleeExosuit", "Transfer Security Exosuit", 174, 122);
  } else if (contract.location === "cryo-reserve") {
    setTacticalEnemy(state, 1, "technician", "boiloffTech", "Boiloff Routing Tech", 84, 42);
    setTacticalEnemy(state, 2, "assault", "shieldBoarder", "Tank-Farm Shield Boarder", 94, 104);
    setTacticalEnemy(state, 3, "technician", "boiloffTech", "Cryopump Purge Tech", 86, 44);
    setTacticalEnemy(state, 4, "suppressor", "marksman", "Cold-Gallery Marksman", 74, 32);
    setTacticalEnemy(state, 5, "technician", "repairDrone", "Reserve Service Drone", 64, 26);
    setTacticalEnemy(state, 6, "elite", "meleeExosuit", "Cryogenic Security Exosuit", 170, 118);
  }
}
function applyMissionSetup(state, contract) {
  var _a;
  state.bossGateHold = true;
  state.eventText = `${contract.locationName.toUpperCase()} // ${contract.objective.toUpperCase()}`;
  state.eventT = 4;
  const boss = state.enemies.find((enemy) => enemy.role === "boss");
  if (boss) boss.label = contract.deepTarget;
  if (contract.location === "damaged-vessel") {
    state.sectors[0].label = "FORE HAB";
    state.sectors[1].label = "CARGO SPINE";
    state.sectors[2].label = "ENGINE VAULT";
    state.sectors[0].gravity = 0.28;
    state.sectors[1].gravity = 0.08;
    state.sectors[2].gravity = 0.14;
    state.sectors[0].pressure = 0.76;
    state.sectors[1].pressure = 0.5;
    state.sectors[2].pressure = 0.66;
    for (const sector of state.sectors) sector.targetPressure = sector.pressure;
  } else if (contract.location === "asteroid-refinery") {
    state.sectors[0].label = "CRUSHER DECK";
    state.sectors[1].label = "ORE TRANSFER";
    state.sectors[2].label = "REACTOR GANTRY";
    state.sectors[0].gravity = 0.62;
    state.sectors[1].gravity = 0.46;
    state.sectors[2].gravity = 0.32;
    const machinery = state.objects.find((object) => object.id === "bulkhead-b");
    if (machinery) machinery.hp = 220;
  } else if (contract.location === "spin-habitat") {
    state.sectors[0].label = "RIM HAB";
    state.sectors[1].label = "SPOKE TRANSIT";
    state.sectors[2].label = "AXIS HUB";
    state.sectors[0].gravity = 1.02;
    state.sectors[1].gravity = 0.42;
    state.sectors[2].gravity = 0.06;
    state.sectors[0].pressure = 0.95;
    state.sectors[1].pressure = 0.9;
    state.sectors[2].pressure = 0.92;
  } else if (contract.location === "jovian-harvester") {
    state.sectors[0].label = "PRESSURE LOCK";
    state.sectors[1].label = "SKIMMER DECK";
    state.sectors[2].label = "COMPRESSOR CROWN";
    state.sectors[0].gravity = 0.55;
    state.sectors[1].gravity = 0.24;
    state.sectors[2].gravity = 0.18;
    state.sectors[0].pressure = 0.94;
    state.sectors[1].pressure = 0.62;
    state.sectors[2].pressure = 0.76;
  } else if (contract.location === "ice-mine") {
    state.sectors[0].label = "ACCESS BORE";
    state.sectors[1].label = "EXTRACTION TUNNEL";
    state.sectors[2].label = "SUBGLACIAL VAULT";
    state.sectors[0].gravity = 0.34;
    state.sectors[1].gravity = 0.22;
    state.sectors[2].gravity = 0.12;
    state.sectors[0].pressure = 0.96;
    state.sectors[1].pressure = 0.9;
    state.sectors[2].pressure = 0.82;
  } else if (contract.location === "solar-yard") {
    state.sectors[0].label = "SHADE GANTRY";
    state.sectors[1].label = "FABRICATION SPINE";
    state.sectors[2].label = "SUNWARD YARD";
    state.sectors[0].gravity = 0.45;
    state.sectors[1].gravity = 0.28;
    state.sectors[2].gravity = 0.12;
    state.sectors[0].pressure = 0.92;
    state.sectors[1].pressure = 0.84;
    state.sectors[2].pressure = 0.72;
  } else if (contract.location === "lattice-annex") {
    state.sectors[0].label = "COLD METROLOGY RING";
    state.sectors[1].label = "REFERENCE GALLERY";
    state.sectors[2].label = "SAMPLE VAULT";
    state.sectors[0].gravity = 0.28;
    state.sectors[1].gravity = 0.11;
    state.sectors[2].gravity = 0.05;
    state.sectors[0].pressure = 0.9;
    state.sectors[1].pressure = 0.78;
    state.sectors[2].pressure = 0.7;
  } else if (contract.location === "momentum-exchange") {
    state.sectors[0].label = "BRAKE DECK";
    state.sectors[1].label = "TRANSFER TUNNEL";
    state.sectors[2].label = "COUNTERMASS CRADLE";
    state.sectors[0].gravity = 0.32;
    state.sectors[1].gravity = 0.05;
    state.sectors[2].gravity = 0.12;
    state.sectors[0].pressure = 0.88;
    state.sectors[1].pressure = 0.76;
    state.sectors[2].pressure = 0.82;
  } else if (contract.location === "cryo-reserve") {
    state.sectors[0].label = "SERVICE COLLAR";
    state.sectors[1].label = "PROPELLANT GALLERY";
    state.sectors[2].label = "UMBRA TANK FARM";
    state.sectors[0].gravity = 0.38;
    state.sectors[1].gravity = 0.16;
    state.sectors[2].gravity = 0.07;
    state.sectors[0].pressure = 0.92;
    state.sectors[1].pressure = 0.68;
    state.sectors[2].pressure = 0.56;
  } else {
    state.sectors[0].label = "SPIN DECK";
    state.sectors[1].label = "TRANSFER BAY";
    state.sectors[2].label = "CRANE WELL";
  }
  for (const sector of state.sectors) sector.targetPressure = sector.pressure;
  if (contract.conditions.includes("limited-atmosphere")) {
    state.sectors[0].pressure = Math.min(state.sectors[0].pressure, 0.74);
    state.sectors[1].pressure = Math.min(state.sectors[1].pressure, 0.52);
    state.sectors[2].pressure = Math.min(state.sectors[2].pressure, 0.68);
    for (const sector of state.sectors) sector.targetPressure = sector.pressure;
  }
  if (contract.conditions.includes("failing-gravity")) state.sectors[1].gravity = Math.min(state.sectors[1].gravity, 0.22);
  if (contract.archetype === "boarding") {
    setRole(state, 1, "assault", "Boarding Vanguard");
    setRole(state, 2, "suppressor", "Hold Suppressor");
    setRole(state, 3, "technician", "Door Systems Tech");
    setRole(state, 4, "assault", "Boarding Vanguard");
  } else if (contract.archetype === "stabilization") {
    setRole(state, 1, "suppressor", "Grid Rifleman");
    setRole(state, 2, "technician", "Load Controller");
    setRole(state, 3, "technician", "Systems Tech");
    setRole(state, 4, "assault", "Reactor Guard");
  }
  configureTacticalRoster(state, contract);
  if ((_a = contract.directiveModifierIds) == null ? void 0 : _a.includes("repair-network")) setTacticalEnemy(state, 5, "technician", "repairDrone", "Directive Repair Mesh Drone", 72, 34);
  applyEncounterLayout(state, contract);
  applyThreatBudget(state.enemies, contract);
  state.operationTier = contract.operationTier ?? 1;
  state.monsterLevel = contract.monsterLevel ?? Math.max(1, Math.round(1 + ((contract.operationTier ?? 1) - 1) * 19 / 11));
  state.maxRecoveryLevel = contract.maxRecoveryLevel ?? 12;
  state.monsterDamageScale = contract.monsterDamageScale ?? 1;
  if (boss && (contract.operationTier ?? 1) >= 9) boss.patternIndex = (contract.seed + (contract.operationTier ?? 1)) % 3;
}
const point = (x, y) => ({ x, y });
function findNavigationPath(state, target, cell = 58) {
  const clearance = 28;
  const minX = 105;
  const maxX = 2215;
  const minY = 185;
  const maxY = 915;
  const cols = Math.floor((maxX - minX) / cell) + 1;
  const rows = Math.floor((maxY - minY) / cell) + 1;
  const targetX = target.x + (target.w ?? 0) / 2;
  const targetY = target.y + (target.h ?? 0) / 2;
  const solids = state.objects.filter(solidNavigationObject).filter((object) => !target.id || object.id !== target.id);
  const blocked = (x, y) => solids.some((object) => x >= object.x - clearance && x <= object.x + object.w + clearance && y >= object.y - clearance && y <= object.y + object.h + clearance);
  const key = (cx, cy) => cy * cols + cx;
  const fromKey = (value) => [value % cols, Math.floor(value / cols)];
  const cellPoint = (cx, cy) => point(minX + cx * cell, minY + cy * cell);
  const clampCell = (x, y) => [
    Math.max(0, Math.min(cols - 1, Math.round((x - minX) / cell))),
    Math.max(0, Math.min(rows - 1, Math.round((y - minY) / cell)))
  ];
  const [startX, startY] = clampCell(state.player.x, state.player.y);
  const [goalX, goalY] = clampCell(targetX, targetY);
  const startId = key(startX, startY);
  const goalId = key(goalX, goalY);
  const queue = [startId];
  const previous = /* @__PURE__ */ new Map();
  const visited = /* @__PURE__ */ new Set([startId]);
  let resolvedGoal = goalId;
  let found = startId === goalId;
  let nearest = startId;
  let nearestDistance = Infinity;
  for (let index = 0; index < queue.length && !found; index += 1) {
    const current = queue[index];
    const [cx, cy] = fromKey(current);
    const p = cellPoint(cx, cy);
    const goalDistance = Math.hypot(p.x - targetX, p.y - targetY);
    if (goalDistance < nearestDistance) {
      nearestDistance = goalDistance;
      nearest = current;
    }
    if (goalDistance <= Math.max(100, cell * 1.7)) {
      resolvedGoal = current;
      found = true;
      break;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const next = key(nx, ny);
      if (visited.has(next)) continue;
      const nextPoint = cellPoint(nx, ny);
      if (blocked(nextPoint.x, nextPoint.y)) continue;
      visited.add(next);
      previous.set(next, current);
      queue.push(next);
    }
  }
  if (!found) resolvedGoal = nearest;
  const ids = [resolvedGoal];
  while (ids[ids.length - 1] !== startId) {
    const prior = previous.get(ids[ids.length - 1]);
    if (prior == null) break;
    ids.push(prior);
  }
  ids.reverse();
  const raw = ids.map((id) => {
    const [cx, cy] = fromKey(id);
    return cellPoint(cx, cy);
  });
  const simplified = [];
  for (let index = 0; index < raw.length; index += 1) {
    const current = raw[index];
    const prev = raw[index - 1];
    const next = raw[index + 1];
    if (!prev || !next) {
      simplified.push(current);
      continue;
    }
    const dxA = Math.sign(current.x - prev.x);
    const dyA = Math.sign(current.y - prev.y);
    const dxB = Math.sign(next.x - current.x);
    const dyB = Math.sign(next.y - current.y);
    if (dxA !== dxB || dyA !== dyB) simplified.push(current);
  }
  if (simplified.length === 0) simplified.push(point(state.player.x, state.player.y));
  simplified[0] = point(state.player.x, state.player.y);
  simplified.push(point(targetX, targetY));
  return { points: simplified, complete: found };
}
const locations = ["orbital-station", "damaged-vessel", "asteroid-refinery", "spin-habitat", "jovian-harvester", "ice-mine", "solar-yard", "lattice-annex", "momentum-exchange", "cryo-reserve"];
function modeFor(location) {
  if (location === "momentum-exchange") return "momentum-capture";
  if (location === "cryo-reserve") return "thermal-routing";
  if (location === "damaged-vessel" || location === "jovian-harvester") return "pressure-recovery";
  if (location === "spin-habitat" || location === "ice-mine") return "gravity-stabilization";
  if (location === "solar-yard" || location === "lattice-annex") return "grid-isolation";
  return "deep-salvage";
}
function contractFor(location, index) {
  const mode = modeFor(location);
  const objective = missionObjectiveFor(mode, location);
  return {
    id: `map-audit-${location}`,
    sponsor: "longarc",
    archetype: "salvage",
    location,
    locationName: locationNameFor(location),
    title: `Navigation audit ${location}`,
    objective: objective.objective,
    objectiveMode: mode,
    objectiveSteps: objective.steps,
    briefing: "Automated map navigation audit.",
    conditions: [],
    conditionLabels: [],
    directorPreview: "",
    deepTarget: deepTargetForLocation(location),
    rewardBase: { credits: 100 },
    reputationGain: 1,
    priority: false,
    anomalyOpportunity: false,
    seed: 9e3 + index
  };
}
function objectiveIds(mode) {
  if (mode === "pressure-recovery") return ["service-seal"];
  if (mode === "grid-isolation") return ["grid-isolator-a", "grid-isolator-b"];
  if (mode === "gravity-stabilization") return ["gravity-control-a", "gravity-control-b"];
  if (mode === "machinery-recovery") return ["salvage-node-a", "salvage-node-b"];
  if (mode === "emergency-boarding") return ["door-control", "boarding-lock"];
  if (mode === "momentum-capture") return ["capture-drum-a", "capture-drum-b"];
  if (mode === "thermal-routing") return ["purge-valve-a", "purge-valve-b"];
  return ["salvage-node-a", "salvage-node-b", "salvage-node-c"];
}
let lowestReachableRatio = 1;
let totalObjectives = 0;
for (let index = 0; index < locations.length; index += 1) {
  const location = locations[index];
  const contract = contractFor(location, index);
  const state = createSimulation(neutralCombatBuild);
  applyMissionSetup(state, contract);
  const objectives = objectiveIds(contract.objectiveMode).map((id) => state.objects.find((object) => object.id === id)).filter((object) => !!object && object.active);
  if (objectives.length === 0) throw new Error(`${location}: no active objective objects found`);
  const audit = auditNavigation(state, objectives);
  if (!audit.reachable) throw new Error(`${location}: ${audit.reachableObjectives}/${audit.objectiveCount} objectives reachable`);
  if (audit.reachableRatio < 0.72) throw new Error(`${location}: only ${(audit.reachableRatio * 100).toFixed(1)}% of walkable cells connect to spawn`);
  const plan = getMapNavigationPlan(location);
  if (plan.routes.length < 7 || plan.landmarks.length !== 3) throw new Error(`${location}: wayfinding plan incomplete`);
  for (const objective of objectives) {
    const path = findNavigationPath(state, objective);
    if (!path.complete || path.points.length < 2) throw new Error(location + ": no obstacle-aware route to " + objective.id);
  }
  const hostile = state.enemies.find((enemy) => enemy.role !== "boss" && enemy.active && !enemy.dead);
  if (hostile) {
    const hostilePath = findNavigationPath(state, { x: hostile.x, y: hostile.y });
    if (!hostilePath.complete || hostilePath.points.length < 2) throw new Error(location + ": no obstacle-aware route to active hostile");
  }
  lowestReachableRatio = Math.min(lowestReachableRatio, audit.reachableRatio);
  totalObjectives += objectives.length;
}
console.log(`MAP_NAVIGATION_PASS locations=${locations.length} objectives=${totalObjectives} minimumReachable=${(lowestReachableRatio * 100).toFixed(1)}%`);
