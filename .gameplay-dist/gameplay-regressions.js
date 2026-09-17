import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const consumableDefinitions = [
  { id: "medGel", name: "Trauma Gel", shortName: "MED", description: "Rapid clotting and tissue-seal pack for emergency suit treatment.", effect: "Restore 40 health.", cost: 45, maxStock: 6, hotkey: "4" },
  { id: "armorPatch", name: "Armor Sealant", shortName: "PATCH", description: "Pressure-rated plate foam and ceramic weave for field armor repair.", effect: "Restore 35 armor.", cost: 40, maxStock: 6, hotkey: "5" },
  { id: "capacitorCell", name: "Capacitor Cell", shortName: "CELL", description: "Disposable high-density cell with a thermal sink coupling.", effect: "Restore 45 capacitor and vent 24% weapon heat.", cost: 35, maxStock: 6, hotkey: "6" }
];
function defaultConsumables() {
  return { medGel: 1, armorPatch: 0, capacitorCell: 0 };
}
function consumableDefinition(id) {
  return consumableDefinitions.find((item) => item.id === id) ?? consumableDefinitions[0];
}
const STORAGE_KEY$1 = "ironshade-vector-campaign-v1";
function createDefaultStory() {
  const progress = () => ({ status: "available", step: 0, choiceA: null, choiceB: null, completed: [] });
  return { arcs: { "vanishing-wake": progress(), "terms-of-survival": progress(), "cold-sun-protocol": progress() }, latticeClues: 0, lastBeat: "Three unresolved story operations are available from the Quiet Signal.", blackLattice: { status: "locked", step: 0, choiceA: null, choiceB: null, choiceC: null, completed: [], evidence: [], lastBeat: "Recover a quarantined trace or lattice finding to open the first major campaign chapter." }, postKhepri: { status: "locked", step: 0, choiceA: null, completed: [], evidence: [], lastBeat: "Complete The Black Lattice and reach operator level 11 to open the post-Khepri investigation." }, interdiction: { status: "locked", step: 0, choiceA: null, completed: [], evidence: [], identifiedTargets: [], lastBeat: "Complete Dead Reckoning and reach operator level 13 to expose the custody network defending the hidden cadence." } };
}
function createDefaultEscalation() {
  return { status: "idle", operationDate: null, seed: 0, codename: "", sponsor: "longarc", stage: 0, completed: [], lastBeat: "No escalation sequence is active." };
}
function createDefaultDirectives() {
  return { unlocked: false, inventory: [], preparedId: null, completed: 0, highestTier: 0, lastBeat: "Directive Array locked // reach operator level 10 to begin endgame navigation recovery." };
}
function createDefaultCampaign() {
  return { version: 1, cycle: 0, contractsCompleted: 0, resources: { credits: 120, alloys: 1, electronics: 1, medstock: 1, components: 0, rareTech: 0 }, consumables: defaultConsumables(), reputation: { meridian: 0, heliostat: 0, longarc: 0 }, shipUpgrades: { reactor: 0, drive: 0, armor: 0, cargo: 0, sensors: 0, fabrication: 0, medical: 0, drones: 0 }, anomalyRecovered: false, dailyCompletedDate: null, lastOutcome: "Quiet Signal ready for contract selection.", story: createDefaultStory(), escalation: createDefaultEscalation(), directives: createDefaultDirectives() };
}
function loadCampaign() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  if (typeof window === "undefined") return createDefaultCampaign();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY$1);
    if (!raw) return createDefaultCampaign();
    const parsed = JSON.parse(raw);
    const defaults = createDefaultCampaign();
    if (parsed.version !== 1) return defaults;
    const parsedStory = parsed.story;
    const parsedEscalation = parsed.escalation;
    const parsedDirectives = parsed.directives;
    return {
      ...defaults,
      ...parsed,
      resources: { ...defaults.resources, ...parsed.resources },
      consumables: { ...defaults.consumables, ...parsed.consumables },
      reputation: { ...defaults.reputation, ...parsed.reputation },
      shipUpgrades: { ...defaults.shipUpgrades, ...parsed.shipUpgrades },
      story: {
        ...defaults.story,
        ...parsedStory,
        arcs: {
          "vanishing-wake": { ...defaults.story.arcs["vanishing-wake"], ...(_a = parsedStory == null ? void 0 : parsedStory.arcs) == null ? void 0 : _a["vanishing-wake"] },
          "terms-of-survival": { ...defaults.story.arcs["terms-of-survival"], ...(_b = parsedStory == null ? void 0 : parsedStory.arcs) == null ? void 0 : _b["terms-of-survival"] },
          "cold-sun-protocol": { ...defaults.story.arcs["cold-sun-protocol"], ...(_c = parsedStory == null ? void 0 : parsedStory.arcs) == null ? void 0 : _c["cold-sun-protocol"] }
        },
        blackLattice: { ...defaults.story.blackLattice, ...parsedStory == null ? void 0 : parsedStory.blackLattice, completed: ((_d = parsedStory == null ? void 0 : parsedStory.blackLattice) == null ? void 0 : _d.completed) ?? defaults.story.blackLattice.completed, evidence: ((_e = parsedStory == null ? void 0 : parsedStory.blackLattice) == null ? void 0 : _e.evidence) ?? defaults.story.blackLattice.evidence },
        postKhepri: { ...defaults.story.postKhepri, ...parsedStory == null ? void 0 : parsedStory.postKhepri, completed: ((_f = parsedStory == null ? void 0 : parsedStory.postKhepri) == null ? void 0 : _f.completed) ?? defaults.story.postKhepri.completed, evidence: ((_g = parsedStory == null ? void 0 : parsedStory.postKhepri) == null ? void 0 : _g.evidence) ?? defaults.story.postKhepri.evidence },
        interdiction: { ...defaults.story.interdiction, ...parsedStory == null ? void 0 : parsedStory.interdiction, completed: ((_h = parsedStory == null ? void 0 : parsedStory.interdiction) == null ? void 0 : _h.completed) ?? defaults.story.interdiction.completed, evidence: ((_i = parsedStory == null ? void 0 : parsedStory.interdiction) == null ? void 0 : _i.evidence) ?? defaults.story.interdiction.evidence, identifiedTargets: ((_j = parsedStory == null ? void 0 : parsedStory.interdiction) == null ? void 0 : _j.identifiedTargets) ?? defaults.story.interdiction.identifiedTargets }
      },
      escalation: { ...defaults.escalation, ...parsedEscalation, completed: (parsedEscalation == null ? void 0 : parsedEscalation.completed) ?? defaults.escalation.completed },
      directives: { ...defaults.directives, ...parsedDirectives, inventory: Array.isArray(parsedDirectives == null ? void 0 : parsedDirectives.inventory) ? parsedDirectives.inventory : defaults.directives.inventory, preparedId: (parsedDirectives == null ? void 0 : parsedDirectives.preparedId) ?? defaults.directives.preparedId }
    };
  } catch {
    return createDefaultCampaign();
  }
}
function saveCampaign(campaign2) {
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.setItem(STORAGE_KEY$1, JSON.stringify(campaign2));
    return true;
  } catch {
    return false;
  }
}
function buyConsumable(campaign2, id) {
  const definition = consumableDefinition(id);
  const current = campaign2.consumables[id] ?? 0;
  if (current >= definition.maxStock) return { campaign: campaign2, message: `${definition.name} stock is full (${definition.maxStock}).` };
  if (campaign2.resources.credits < definition.cost) return { campaign: campaign2, message: `Need ${definition.cost} Credits for ${definition.name}.` };
  return {
    campaign: {
      ...campaign2,
      resources: { ...campaign2.resources, credits: campaign2.resources.credits - definition.cost },
      consumables: { ...campaign2.consumables, [id]: current + 1 }
    },
    message: `${definition.name} purchased // ${current + 1}/${definition.maxStock} stocked // ${definition.cost} Credits spent.`
  };
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
new Map(eliteProtocolDefinitions.map((definition) => [definition.id, definition]));
function enemyHasProtocol(enemy, id) {
  return enemy.protocols.some((protocol) => protocol.id === id);
}
function protocolAimPenalty(enemy) {
  return enemyHasProtocol(enemy, "sensorGhost") && enemy.statuses.marked <= 0 && enemy.statuses.disrupted <= 0 ? 0.3 : 0;
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
function getWeaponConfig(state, id) {
  return state.weapons[id];
}
function len(v) {
  return Math.hypot(v.x, v.y);
}
function norm(v) {
  const l = len(v);
  return l > 1e-4 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 };
}
function rotateAimToward(current, desired, maxRadians) {
  const target2 = norm(desired);
  if (len(target2) < 0.1) return current;
  const currentAngle = Math.atan2(current.y, current.x);
  const targetAngle = Math.atan2(target2.y, target2.x);
  const delta = Math.atan2(Math.sin(targetAngle - currentAngle), Math.cos(targetAngle - currentAngle));
  if (Math.abs(delta) <= maxRadians) return target2;
  const next = currentAngle + Math.sign(delta) * maxRadians;
  return { x: Math.cos(next), y: Math.sin(next) };
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
function isSolidObject(object) {
  return object.active && (object.kind === "cover" || object.kind === "conduit" || object.kind === "coolant" || object.kind === "breachPlate" || object.kind === "anchorNode");
}
function clearLine(state, ax, ay, bx, by) {
  for (let i = 1; i < 20; i += 1) {
    const t = i / 20;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    if (state.objects.some((object) => isSolidObject(object) && pointInRect(x, y, object))) return false;
  }
  return true;
}
function blankStatuses() {
  return { armorBreach: 0, disrupted: 0, marked: 0, stagger: 0, conductive: 0, vacuum: 0 };
}
function pushEvent(state, text, duration = 2.2) {
  state.eventText = text;
  state.eventT = duration;
}
function applyPlayerDamage(state, amount, armorPierce = 0) {
  const p = state.player;
  if (p.invulnerable > 0 || p.dead || amount <= 0) return;
  const wasCritical = p.hp <= 1;
  const bypass = clamp(armorPierce, 0, 1);
  const directHealthDamage = amount * bypass;
  const blockableDamage = Math.max(0, amount - directHealthDamage);
  const armorTake = Math.min(p.armor, blockableDamage);
  p.armor -= armorTake;
  const healthDamage = directHealthDamage + Math.max(0, blockableDamage - armorTake);
  const appliedHealthDamage = Math.min(p.hp, Math.max(0, healthDamage));
  p.hp = Math.max(0, p.hp - appliedHealthDamage);
  state.telemetry.damageTaken += armorTake + appliedHealthDamage;
  if (p.hp <= 0 || wasCritical) {
    p.hp = 0;
    p.dead = true;
    p.vx *= 0.25;
    p.vy *= 0.25;
    state.telemetry.deaths += 1;
  }
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
function aimAtMobileTarget(state, mode = "balanced", preferredId = null) {
  const p = state.player;
  const weapon = getWeaponConfig(state, p.currentWeapon);
  const maxDistance = p.currentWeapon === "breacher" ? mode === "balanced" ? 680 : 560 : p.currentWeapon === "rail" ? mode === "balanced" ? 980 : 820 : mode === "balanced" ? 860 : 720;
  const scoreEnemy = (enemy) => {
    if (!enemy.active || enemy.dead) return null;
    const delta = { x: enemy.x - p.x, y: enemy.y - p.y };
    const distance = len(delta);
    if (distance > maxDistance || distance < 1) return null;
    const rawDirection = norm(delta);
    const angleScore = 1 - (rawDirection.x * p.aim.x + rawDirection.y * p.aim.y);
    const closeThreat = distance < (enemy.role === "assault" ? 380 : 270);
    if (mode === "light" && angleScore > 0.5) return null;
    if (mode === "balanced" && !closeThreat && enemy.role !== "boss" && angleScore > 1.55) return null;
    const visible = clearLine(state, p.x, p.y, enemy.x, enemy.y);
    const leadFactor = mode === "balanced" ? 0.72 : 0.35;
    const leadSeconds = Math.min(mode === "balanced" ? 0.38 : 0.2, distance / Math.max(1, weapon.projectileSpeed) * leadFactor);
    const direction = norm({
      x: enemy.x + enemy.vx * leadSeconds - p.x,
      y: enemy.y + enemy.vy * leadSeconds - p.y
    });
    let score = distance / maxDistance * 0.44 + angleScore * (mode === "balanced" ? 0.18 : 0.46);
    if (!visible) score += p.currentWeapon === "rail" ? 0.38 : mode === "balanced" ? 0.68 : 0.92;
    if (enemy.telegraph > 0) score -= 0.2;
    if (enemy.role === "assault" && distance < 380) score -= 0.16;
    if (enemy.role === "suppressor" && state.squadSuppressing) ;
    if (enemy.role === "technician" && enemy.hazardCooldown < 1.2) score -= 0.05;
    if (enemy.statuses.marked > 0) score -= 0.08;
    score += protocolAimPenalty(enemy) * (mode === "balanced" ? 1 : 0.6);
    return { direction, score, visible };
  };
  let bestVisible = null;
  let bestAny = null;
  for (const enemy of state.enemies) {
    const scored = scoreEnemy(enemy);
    if (!scored) continue;
    const candidate = { enemy, direction: scored.direction, score: scored.score };
    if (!bestAny || candidate.score < bestAny.score) bestAny = candidate;
    if (scored.visible && (!bestVisible || candidate.score < bestVisible.score)) bestVisible = candidate;
  }
  const best = bestVisible ?? bestAny;
  const preferred = preferredId == null ? null : state.enemies.find((enemy) => enemy.id === preferredId) ?? null;
  if (preferred) {
    const scored = scoreEnemy(preferred);
    const stickiness = mode === "balanced" ? 0.24 : 0.12;
    if (scored && (scored.visible || !bestVisible) && (!best || scored.score <= best.score + stickiness)) {
      p.aim = rotateAimToward(p.aim, scored.direction, mode === "balanced" ? 0.14 : 0.18);
      return preferred.id;
    }
  }
  if (!best) return null;
  p.aim = rotateAimToward(p.aim, best.direction, mode === "balanced" ? 0.14 : 0.18);
  return best.enemy.id;
}
function triggerConsumable(state, id) {
  const p = state.player;
  if (p.dead || state.complete || p.consumableCooldown > 0) return false;
  if (id === "medGel") {
    if (p.hp >= p.maxHp) return false;
    p.hp = Math.min(p.maxHp, p.hp + 40);
    pushEvent(state, "TRAUMA GEL // +40 HEALTH", 1.2);
  } else if (id === "armorPatch") {
    if (p.armor >= p.maxArmor) return false;
    p.armor = Math.min(p.maxArmor, p.armor + 35);
    pushEvent(state, "ARMOR SEALANT // +35 ARMOR", 1.2);
  } else {
    const hot = ["carbine", "breacher", "rail"].some((weapon) => p.weaponHeat[weapon] > 0.02);
    if (p.capacitor >= p.maxCapacitor && !hot) return false;
    p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 45);
    for (const weapon of ["carbine", "breacher", "rail"]) p.weaponHeat[weapon] = Math.max(0, p.weaponHeat[weapon] - 0.24);
    pushEvent(state, "CAPACITOR CELL // +45 CAP // THERMAL SINK", 1.2);
  }
  p.consumableCooldown = 1.25;
  return true;
}
const coreModifierIds = /* @__PURE__ */ new Set(["hypervelocity", "countermass", "overdrive", "cryoloop", "extendedFeed", "tungsten", "vacuumSeal", "servoWeave"]);
const powerByGrade = { 1: 0.65, 2: 0.82, 3: 1, 4: 1.18, 5: 1.38 };
const tradeoffByGrade = { 1: 0.78, 2: 0.9, 3: 1, 4: 1.08, 5: 1.16 };
function modifierFamilyFor(id) {
  return coreModifierIds.has(id) ? "core" : "systems";
}
function modifierPowerFactor(grade) {
  return powerByGrade[grade];
}
function modifierTradeoffFactor(grade) {
  return tradeoffByGrade[grade];
}
const frameIdentityDefinitions = [
  { id: "carbine-countermass", slot: "carbine", name: "Countermass Receiver", philosophy: "Predictable recoil with a small loss of projectile pace." },
  { id: "carbine-hypervelocity", slot: "carbine", name: "Dense-Flight Receiver", philosophy: "Projectile velocity and penetration at the cost of thermal comfort." },
  { id: "carbine-feedline", slot: "carbine", name: "Sustained Feed Spine", philosophy: "Magazine endurance with slower service cycling." },
  { id: "breacher-thrust", slot: "breacher", name: "Backblast Thruster Cage", philosophy: "Turns discharge impulse into extreme shove and movement authority." },
  { id: "breacher-dense", slot: "breacher", name: "Dense-Choke Cage", philosophy: "Higher close-range output with heavier firing impulse." },
  { id: "breacher-cryo", slot: "breacher", name: "Cryo-Cycle Action", philosophy: "Fast heat recovery and cycling with slightly lower peak output." },
  { id: "rail-hypervelocity", slot: "rail", name: "Hypervelocity Rail Bed", philosophy: "Velocity and armor penetration with additional heat load." },
  { id: "rail-countermass", slot: "rail", name: "Countermass Rail Bed", philosophy: "Exceptional recoil absorption with a small energy-output concession." },
  { id: "rail-thermal", slot: "rail", name: "Thermal Reference Rails", philosophy: "Sustained rail operation with slightly less penetration." },
  { id: "suit-pressure", slot: "suit", name: "Pressure-Integrity Shell", philosophy: "Armor and seal integrity over raw mobility." },
  { id: "suit-eva", slot: "suit", name: "Light EVA Weave", philosophy: "Mobility and low-g control with less plate reserve." },
  { id: "suit-countermass", slot: "suit", name: "Countermass Mobility Shell", philosophy: "Low-g vector authority with reduced passive pressure protection." },
  { id: "rig-capacitor", slot: "rig", name: "Capacitor Reserve Bus", philosophy: "Large capacitor headroom with slightly slower recharge response." },
  { id: "rig-thermal", slot: "rig", name: "Closed-Loop Thermal Bus", philosophy: "Weapon heat rejection with less capacitor reserve." },
  { id: "rig-pulse", slot: "rig", name: "Pulse-Control Bus", philosophy: "Shorter ability cycles with slightly higher ability power cost." },
  { id: "implant-sensor", slot: "implant", name: "Survey Sensor Kernel", philosophy: "Stronger Sensor Spike solutions with slower retarget cadence." },
  { id: "implant-ballistic", slot: "implant", name: "Predictive Ballistic Kernel", philosophy: "Projectile prediction and penetration with minor neural load." },
  { id: "implant-relay", slot: "implant", name: "Distributed Relay Kernel", philosophy: "Arc Tap authority and cycling with a modest capacitor tax." }
];
const pools = {
  carbine: ["carbine-countermass", "carbine-hypervelocity", "carbine-feedline"],
  breacher: ["breacher-thrust", "breacher-dense", "breacher-cryo"],
  rail: ["rail-hypervelocity", "rail-countermass", "rail-thermal"],
  suit: ["suit-pressure", "suit-eva", "suit-countermass"],
  rig: ["rig-capacitor", "rig-thermal", "rig-pulse"],
  implant: ["implant-sensor", "implant-ballistic", "implant-relay"]
};
const clampQuality = (quality) => Math.max(0, Math.min(20, Math.round(quality)));
const qualityScale = (quality) => 1 + clampQuality(quality) * 0.02;
const generationValue = (generation, values) => values[Math.min(values.length - 1, generation - 1)] * (generation >= 5 ? 1.12 : 1);
const percent = (value) => Math.round(value * 100);
function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function frameIdentityDefinition(id) {
  return frameIdentityDefinitions.find((definition) => definition.id === id);
}
function inferFrameIdentity(slot, key) {
  const normalized = key.toLowerCase();
  if (slot === "carbine") {
    if (/counter|compliance|palisade|stable/.test(normalized)) return "carbine-countermass";
    if (/hyper|flux|ghost|arcspindle/.test(normalized)) return "carbine-hypervelocity";
  }
  if (slot === "breacher") {
    if (/backblast|redline|longarc/.test(normalized)) return "breacher-thrust";
    if (/sunforge|dense|dockbreaker/.test(normalized)) return "breacher-dense";
  }
  if (slot === "rail") {
    if (/hyper|needle|null|helios|khepri/.test(normalized)) return "rail-hypervelocity";
    if (/counter|bondhouse|stabilized/.test(normalized)) return "rail-countermass";
  }
  if (slot === "suit") {
    if (/pressure|mantle|stormskin|meridian|rated/.test(normalized)) return "suit-pressure";
    if (/eva|glass|convoy|khepri|calibration/.test(normalized)) return "suit-eva";
  }
  if (slot === "rig") {
    if (/thermal|helios|cryo|open-cycle/.test(normalized)) return "rig-thermal";
    if (/capacitor|redundant|meridian/.test(normalized)) return "rig-capacitor";
  }
  if (slot === "implant") {
    if (/sensor|survey|deadreckon|threat-control/.test(normalized)) return "implant-sensor";
    if (/route|predictive/.test(normalized)) return "implant-ballistic";
  }
  const pool = pools[slot];
  return pool[hashText(`${slot}:${key}`) % pool.length];
}
function equipmentQualityForRecovery(recoveryQuality, generation, rarity) {
  const rarityBonus = rarity === "Singular" ? 3 : rarity === "Prototype" ? 1 : 0;
  const matureGenerationBonus = Math.min(4, Math.max(0, generation - 1));
  return clampQuality(Math.min(12, recoveryQuality * 2 + matureGenerationBonus + rarityBonus));
}
function augmentSlotCount(rarity, generation) {
  if (generation >= 6) {
    if (rarity === "Singular" || rarity === "Prototype") return 3;
    if (rarity === "Refined") return 2;
  }
  if (rarity === "Singular") return 2;
  if (rarity === "Prototype") return generation >= 3 ? 2 : 1;
  if (rarity === "Refined") return 1;
  return generation >= 2 ? 1 : 0;
}
function frameImplicitDescription(identity, generation, quality) {
  const q = qualityScale(quality);
  switch (identity) {
    case "carbine-countermass":
      return `${frameIdentityDefinition(identity).name} // ${percent(generationValue(generation, [0.05, 0.07, 0.09, 0.11]) * q)}% recoil absorption; projectile velocity -2%.`;
    case "carbine-hypervelocity":
      return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.04, 0.06, 0.08, 0.1]) * q)}% projectile velocity and added penetration; +3% heat/shot.`;
    case "carbine-feedline":
      return `${frameIdentityDefinition(identity).name} // +${Math.max(1, Math.round(generationValue(generation, [2, 3, 4, 5]) * q))} magazine capacity; +4% reload time.`;
    case "breacher-thrust":
      return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.08, 0.12, 0.16, 0.2]) * q)}% knockback; +4% recoil impulse.`;
    case "breacher-dense":
      return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.03, 0.05, 0.07, 0.09]) * q)}% direct output; +5% recoil.`;
    case "breacher-cryo":
      return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.08, 0.12, 0.16, 0.2]) * q)}% heat dissipation and faster reload; -2% direct output.`;
    case "rail-hypervelocity":
      return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.05, 0.08, 0.11, 0.14]) * q)}% velocity and precision penetration; +4% heat/shot.`;
    case "rail-countermass":
      return `${frameIdentityDefinition(identity).name} // ${percent(generationValue(generation, [0.08, 0.12, 0.16, 0.2]) * q)}% recoil absorption; -3% direct output.`;
    case "rail-thermal":
      return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.1, 0.15, 0.2, 0.25]) * q)}% heat dissipation; small penetration concession.`;
    case "suit-pressure":
      return `${frameIdentityDefinition(identity).name} // additional armor and ${percent(generationValue(generation, [0.05, 0.07, 0.09, 0.11]) * q)}% pressure resistance; -2% movement speed.`;
    case "suit-eva":
      return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.02, 0.03, 0.04, 0.05]) * q)}% movement speed and strong low-g control; -4 armor reserve.`;
    case "suit-countermass":
      return `${frameIdentityDefinition(identity).name} // low-g vector control and modest movement gain; reduced passive pressure resistance.`;
    case "rig-capacitor":
      return `${frameIdentityDefinition(identity).name} // expanded capacitor ceiling and modest regeneration; +3% ability cost.`;
    case "rig-thermal":
      return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.06, 0.09, 0.12, 0.15]) * q)}% weapon heat dissipation; -4 capacitor reserve.`;
    case "rig-pulse":
      return `${frameIdentityDefinition(identity).name} // shorter ability cycles; +3% ability cost.`;
    case "implant-sensor":
      return `${frameIdentityDefinition(identity).name} // stronger Sensor Spike solution; +2% mark cooldown.`;
    case "implant-ballistic":
      return `${frameIdentityDefinition(identity).name} // predictive projectile velocity and penetration; +1% ability cost.`;
    case "implant-relay":
      return `${frameIdentityDefinition(identity).name} // stronger/faster Arc Tap routing; +3% Arc Tap cost.`;
  }
}
const augmentDefinitions = [
  { id: "countermass-coupler", name: "Countermass Coupler", hardware: "Weapon coupler", description: "-6% recoil on this weapon.", tradeoff: "-2% direct weapon output.", slots: ["carbine", "breacher", "rail"], cost: { credits: 70, alloys: 1, components: 1 } },
  { id: "ferrite-coupler", name: "Ferrite Bypass Coupler", hardware: "Weapon coupler", description: "+5 penetration on this weapon.", tradeoff: "+4% heat per shot.", slots: ["carbine", "breacher", "rail"], cost: { credits: 75, alloys: 1, electronics: 1 } },
  { id: "coolant-coupler", name: "Coolant Return Coupler", hardware: "Weapon coupler", description: "+8% heat dissipation.", tradeoff: "+3% reload time.", slots: ["carbine", "breacher", "rail"], cost: { credits: 70, electronics: 2 } },
  { id: "pressure-baffle-insert", name: "Pressure Baffle Insert", hardware: "Suit insert", description: "+6 armor reserve.", tradeoff: "-2% movement speed.", slots: ["suit"], cost: { credits: 65, alloys: 2 } },
  { id: "eva-flex-insert", name: "EVA Flex Insert", hardware: "Suit insert", description: "+3% movement speed.", tradeoff: "-4 armor reserve.", slots: ["suit"], cost: { credits: 65, alloys: 1, electronics: 1 } },
  { id: "servo-damper-insert", name: "Servo Damper Insert", hardware: "Suit insert", description: "Improves low-g control.", tradeoff: "-3 armor reserve.", slots: ["suit"], cost: { credits: 75, electronics: 2 } },
  { id: "cap-buffer-board", name: "Capacitor Buffer Board", hardware: "Rig daughterboard", description: "+8 capacitor reserve.", tradeoff: "-3% capacitor regeneration.", slots: ["rig"], cost: { credits: 80, electronics: 2, components: 1 } },
  { id: "thermal-shunt-board", name: "Thermal Shunt Board", hardware: "Rig daughterboard", description: "+7% weapon heat dissipation.", tradeoff: "+2% ability cooldown.", slots: ["rig"], cost: { credits: 80, electronics: 2 } },
  { id: "relay-daughterboard", name: "Relay Daughterboard", hardware: "Rig daughterboard", description: "-5% Arc Tap cooldown.", tradeoff: "-4 capacitor reserve.", slots: ["rig"], cost: { credits: 90, electronics: 2, components: 1 } },
  { id: "predictive-kernel", name: "Predictive Kernel", hardware: "Implant kernel", description: "+3% projectile velocity.", tradeoff: "+2% recoil.", slots: ["implant"], cost: { credits: 75, electronics: 2 } },
  { id: "shear-kernel", name: "Shear Analysis Kernel", hardware: "Implant kernel", description: "+8% Sensor Spike power.", tradeoff: "+5% Sensor Spike cooldown.", slots: ["implant"], cost: { credits: 80, electronics: 2, components: 1 } },
  { id: "signal-filter-kernel", name: "Signal Filter Kernel", hardware: "Implant kernel", description: "-4% ability cost.", tradeoff: "+2% ability cooldown.", slots: ["implant"], cost: { credits: 80, electronics: 2 } }
];
function augmentDefinition(id) {
  return augmentDefinitions.find((definition) => definition.id === id);
}
function normalizeAugments(slot, ids, limit) {
  const unique = /* @__PURE__ */ new Set();
  for (const id of ids) if (augmentDefinition(id).slots.includes(slot)) unique.add(id);
  return [...unique].slice(0, Math.max(0, limit));
}
const STORAGE_KEY = "ironshade-vector-profile-v3";
const starterItems = [
  { id: "starter-carbine", baseId: "m7-frame", name: "M-7 Service Frame", slot: "carbine", equipmentClass: "Coil carbine assembly", rarity: "Field", levelRequirement: 1, core: "Stable automatic coil assembly with neutral recoil and thermal behavior.", modifiers: [] },
  { id: "starter-breacher", baseId: "b4-frame", name: "B-4 Service Frame", slot: "breacher", equipmentClass: "Breach scattergun assembly", rarity: "Field", levelRequirement: 1, core: "Close-range scatter assembly tuned for predictable thrust and spread.", modifiers: [] },
  { id: "starter-rail", baseId: "r2-frame", name: "R-2 Service Rails", slot: "rail", equipmentClass: "Rail-lance assembly", rarity: "Field", levelRequirement: 1, core: "High-velocity rails with standard capacitor draw and penetration.", modifiers: [] },
  { id: "starter-suit", baseId: "utility-suit", name: "Dockworker Pressure Suit", slot: "suit", equipmentClass: "Combat pressure suit", rarity: "Field", levelRequirement: 1, core: "Balanced protection with ordinary maneuvering servos.", modifiers: [] },
  { id: "starter-rig", baseId: "utility-rig", name: "QS Utility Rig", slot: "rig", equipmentClass: "Power and thermal rig", rarity: "Field", levelRequirement: 1, core: "Standard capacitor bus and thermal routing.", modifiers: [] },
  { id: "starter-implant", baseId: "operator-link", name: "Operator Sensor Link", slot: "implant", equipmentClass: "Neural systems implant", rarity: "Field", levelRequirement: 1, core: "Basic targeting, telemetry, and electronic-control interface.", modifiers: [] }
];
const affixes = {
  hypervelocity: { id: "hypervelocity", label: "Hypervelocity rails", description: "+18% projectile velocity and +12 penetration, but +10% recoil.", mechanical: false },
  countermass: { id: "countermass", label: "Countermass buffer", description: "-22% recoil, but -7% direct weapon damage.", mechanical: false },
  overdrive: { id: "overdrive", label: "Open-coil overdrive", description: "+14% weapon damage, +20% recoil, and +12% heat per shot.", mechanical: false },
  cryoloop: { id: "cryoloop", label: "Cryogenic return loop", description: "+30% heat dissipation, but -8 penetration.", mechanical: false },
  extendedFeed: { id: "extendedFeed", label: "Extended feed geometry", description: "+6 magazine capacity, but +12% reload time.", mechanical: false },
  tungsten: { id: "tungsten", label: "Tungsten penetrator stack", description: "+30% armor damage and +14 penetration, but +8% heat per shot.", mechanical: false },
  vacuumSeal: { id: "vacuumSeal", label: "Layered vacuum seal", description: "Strongly reduces vacuum exposure damage and decompression pull.", mechanical: false },
  servoWeave: { id: "servoWeave", label: "Vector servo weave", description: "+8% movement speed and improved low-gravity braking.", mechanical: false },
  capacitorRecycler: { id: "capacitorRecycler", label: "Capacitor recycler", description: "+20% capacitor regeneration and -10% ability power cost.", mechanical: false },
  railFracture: { id: "railFracture", label: "Fracture cascade", description: "Rail rounds fragment after penetrating a target, creating two lower-energy follow-up vectors.", mechanical: true },
  dodgeVent: { id: "dodgeVent", label: "Kinetic heat shunt", description: "Every dodge vents a portion of the current weapon heat.", mechanical: true },
  magRedirect: { id: "magRedirect", label: "Revector field", description: "Magnetic Impulse captures nearby hostile projectiles and redirects them into the fight.", mechanical: true },
  breachPropulsion: { id: "breachPropulsion", label: "Backblast coupling", description: "Breacher recoil becomes a stronger mobility impulse below 0.15g.", mechanical: true },
  markShear: { id: "markShear", label: "Shear-map optics", description: "Marked targets expose weak armor paths, greatly increasing armor damage against them.", mechanical: true },
  arcDrone: { id: "arcDrone", label: "Relay microdrone", description: "A microdrone periodically attacks electronically disrupted targets.", mechanical: true }
};
function gradePercent(value) {
  return Math.max(1, Math.round(value));
}
function gradedDescription(id, grade) {
  const power = modifierPowerFactor(grade);
  const tradeoff = modifierTradeoffFactor(grade);
  if (id === "hypervelocity") return `+${gradePercent(18 * power)}% projectile velocity and +${gradePercent(12 * power)} penetration, but +${gradePercent(10 * tradeoff)}% recoil.`;
  if (id === "countermass") return `-${gradePercent(22 * power)}% recoil, but -${gradePercent(7 * tradeoff)}% direct weapon damage.`;
  if (id === "overdrive") return `+${gradePercent(14 * power)}% weapon damage, +${gradePercent(20 * tradeoff)}% recoil, and +${gradePercent(12 * tradeoff)}% heat per shot.`;
  if (id === "cryoloop") return `+${gradePercent(30 * power)}% heat dissipation, but -${gradePercent(8 * tradeoff)} penetration on weapon frames.`;
  if (id === "extendedFeed") return `+${Math.max(1, Math.round(6 * power))} magazine capacity, but +${gradePercent(12 * tradeoff)}% reload time.`;
  if (id === "tungsten") return `+${gradePercent(30 * power)}% armor damage and +${gradePercent(14 * power)} penetration, but +${gradePercent(8 * tradeoff)}% heat per shot.`;
  if (id === "vacuumSeal") return `+${gradePercent(55 * power)}% vacuum/decompression resistance before suit caps.`;
  if (id === "servoWeave") return `+${gradePercent(8 * power)}% movement speed and stronger low-gravity braking.`;
  if (id === "capacitorRecycler") return `+${gradePercent(20 * power)}% capacitor regeneration and -${gradePercent(10 * power)}% ability power cost.`;
  if (id === "railFracture") return `Rail rounds fragment after penetration; fragment energy retains ${gradePercent(35 * power)}% of the triggering round.`;
  if (id === "dodgeVent") return `Every dodge vents ${gradePercent(22 * power)}% of current weapon heat.`;
  if (id === "magRedirect") return `Magnetic Impulse redirects hostile projectiles; redirected kinetic payload scales to ${gradePercent(100 * power)}% of the standard return.`;
  if (id === "breachPropulsion") return `Below 0.15g, Breacher recoil becomes a ${(1 + 0.6 * power).toFixed(2)}x mobility impulse.`;
  if (id === "markShear") return `Marked targets expose weak armor paths; marked-hit amplification reaches ${gradePercent((0.18 + 0.16 * power) * 100)}%.`;
  return `A relay microdrone attacks disrupted targets for ${gradePercent(8 * power)} damage per cycle.`;
}
function materializeModifier(id, grade = 3) {
  const base = affixes[id];
  return { ...base, family: modifierFamilyFor(id), grade, description: gradedDescription(id, grade) };
}
function frameImplicitFor(slot, generation, identity, quality = 0) {
  const resolved = identity ?? inferFrameIdentity(slot, `${slot}:${generation}`);
  return frameImplicitDescription(resolved, generation, quality);
}
const singular = (template) => template;
const bossSingularPools = {
  "Recovery Commander Sable Voss": [
    singular({ baseId: "voss-palisade-m7", name: "Palisade Doctrine M-7", slot: "carbine", equipmentClass: "Meridian command carbine assembly", rarity: "Singular", core: "A pressure-rated command frame built around sustained armor work and controlled recoil behind portable cover.", modifiers: [{ ...affixes.tungsten }, { ...affixes.countermass }, { ...affixes.extendedFeed }], singularTrait: "palisadeDoctrine", singularEffect: "Stationary carbine fire rebuilds small amounts of armor, rewarding deliberate firing positions." }),
    singular({ baseId: "voss-pressure-mantle", name: "Compact Pressure Mantle", slot: "suit", equipmentClass: "Meridian recovery pressure suit", rarity: "Singular", core: "Layered Compact recovery armor designed to stay mobile while pressure lanes and barricades change around the operator.", modifiers: [{ ...affixes.vacuumSeal }, { ...affixes.servoWeave }, { ...affixes.capacitorRecycler }], singularTrait: "pressureMantle", singularEffect: "Cycling pressure controls or sealing a rupture restores armor and clears vacuum exposure." }),
    singular({ baseId: "voss-lockstep-rig", name: "Lockstep Command Rig", slot: "rig", equipmentClass: "Meridian pressure-control rig", rarity: "Singular", core: "A command bus that couples thermal control, capacitor recovery, and magnetic interception.", modifiers: [{ ...affixes.magRedirect }, { ...affixes.cryoloop }, { ...affixes.capacitorRecycler }], singularTrait: "lockstepArc", singularEffect: "Arc Tap through machinery restores armor and capacitor while propagating disruption." })
  ],
  "Salvage Captain Rhea Kade": [
    singular({ baseId: "rhea-backblast-b4", name: "Rhea's Backblast Kestrel", slot: "breacher", equipmentClass: "Long Arc recoil-mobility scatter assembly", rarity: "Singular", core: "A field-cut Kestrel frame that treats every discharge as both a weapon event and a movement decision.", modifiers: [{ ...affixes.breachPropulsion }, { ...affixes.countermass }, { ...affixes.dodgeVent }], singularTrait: "rheaBackblast", singularEffect: "Breacher shots produce extreme controlled backblast and accelerate the next dodge cycle." }),
    singular({ baseId: "rhea-tether-link", name: "Tetherhand Sensor Link", slot: "implant", equipmentClass: "Long Arc magnetic-rigging implant", rarity: "Singular", core: "Predictive rigging telemetry built to read movement, magnetic vectors, and exposed armor paths as one problem.", modifiers: [{ ...affixes.magRedirect }, { ...affixes.servoWeave }, { ...affixes.markShear }], singularTrait: "tetherhand", singularEffect: "Sensor Spike leaves a short magnetic tether well on the marked target." }),
    singular({ baseId: "rhea-scrapline-suit", name: "Scrapline Countermass Suit", slot: "suit", equipmentClass: "Long Arc salvage pressure suit", rarity: "Singular", core: "A patched maneuvering shell with exceptional low-g recovery and emergency heat shedding.", modifiers: [{ ...affixes.servoWeave }, { ...affixes.dodgeVent }, { ...affixes.vacuumSeal }], singularTrait: "scraplineDodge", singularEffect: "Dodges below 0.35g travel farther and recover faster, turning low gravity into an offensive resource." })
  ],
  "HELIOS-9 Yardmind": [
    singular({ baseId: "helios-thermal-governor", name: "HELIOS-9 Thermal Governor", slot: "rig", equipmentClass: "Autonomous fabrication thermal rig", rarity: "Singular", core: "Recovered process-control hardware that treats operator heat, capacitor load, and relay drones as one thermal network.", modifiers: [{ ...affixes.cryoloop }, { ...affixes.arcDrone }, { ...affixes.capacitorRecycler }], singularTrait: "thermalGovernor", singularEffect: "Manual venting dumps heat from every weapon and advances all ability cooldowns." }),
    singular({ baseId: "helios-machine-sight", name: "Machine-Sight Cognition Node", slot: "implant", equipmentClass: "Industrial control cognition implant", rarity: "Singular", core: "A legal-safe reconstruction of the Yardmind targeting layer, retaining its machine-to-machine disruption logic.", modifiers: [{ ...affixes.arcDrone }, { ...affixes.markShear }, { ...affixes.magRedirect }], singularTrait: "machineSight", singularEffect: "Arc Tap through machinery seeks an additional disrupted target beyond the normal propagation radius." }),
    singular({ baseId: "helios-fracture-rails", name: "Sunward Fracture Rails", slot: "rail", equipmentClass: "Solar-yard precision rail assembly", rarity: "Singular", core: "Fabrication rails tuned for extreme projectile velocity, thermal recovery, and controlled post-penetration fragmentation.", modifiers: [{ ...affixes.railFracture }, { ...affixes.hypervelocity }, { ...affixes.cryoloop }], singularTrait: "sunwardFracture", singularEffect: "High-heat Rail Lance shots split into two narrow secondary vectors at the muzzle." })
  ],
  "Transfer Adjudicator Iona Vale": [
    singular({ baseId: "vale-vector-spool-m11", name: "Vale Vector-Spool M-11", slot: "carbine", equipmentClass: "Transfer-lane strafe carbine assembly", rarity: "Singular", core: "An adjudicator receiver that stabilizes only when the operator carries a lateral movement vector across the firing solution.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.countermass }, { ...affixes.servoWeave }], singularTrait: "inertiaSpool", singularEffect: "While moving fast across the aim line, carbine fire gains damage and velocity while shedding most recoil." }),
    singular({ baseId: "vale-clutchstep-harness", name: "Clutchstep Countermass Harness", slot: "suit", equipmentClass: "Field-consuming countermass maneuvering suit", rarity: "Singular", core: "A clutch-timed harness built to collapse a nearby mass field during a committed dodge and bank the recovered impulse.", modifiers: [{ ...affixes.countermass }, { ...affixes.dodgeVent }, { ...affixes.capacitorRecycler }], singularTrait: "clutchstep", singularEffect: "Dodging near a gravity or countermass field consumes it, restores capacitor, and shortens dodge recovery." }),
    singular({ baseId: "vale-flywheel-ledger-rig", name: "Flywheel Ledger Rig", slot: "rig", equipmentClass: "Rail recoil accounting rig", rarity: "Singular", core: "A transfer-control bus that books rail discharge impulse back into the capacitor ledger instead of cancelling it.", modifiers: [{ ...affixes.capacitorRecycler }, { ...affixes.overdrive }, { ...affixes.magRedirect }], singularTrait: "recoilLedger", singularEffect: "Rail shots refund capacitor but produce substantially more recoil, turning every lance into a movement commitment." })
  ],
  "Umbra Systems Marshal Oren Saal": [
    singular({ baseId: "saal-cold-start-kestrel", name: "Umbra Cold-Start Kestrel", slot: "breacher", equipmentClass: "Cold-bus cryogenic scattergun", rarity: "Singular", core: "A reserve-yard breach frame tuned around the first discharge after a full thermal reset.", modifiers: [{ ...affixes.cryoloop }, { ...affixes.tungsten }, { ...affixes.breachPropulsion }], singularTrait: "coldStartBreach", singularEffect: "A Breacher shot from a cold bus gains damage, penetration, and velocity but adds extra heat." }),
    singular({ baseId: "saal-purgewake-rig", name: "Purgewake Thermal Rig", slot: "rig", equipmentClass: "Low-pressure vent-thrust systems rig", rarity: "Singular", core: "A vent manifold that deliberately turns low-pressure thermal rejection into a short physical thrust plume.", modifiers: [{ ...affixes.cryoloop }, { ...affixes.dodgeVent }, { ...affixes.servoWeave }], singularTrait: "purgeWake", singularEffect: "Manual venting below 45% pressure emits a player-owned coolant thrust plume that pushes and staggers enemies." }),
    singular({ baseId: "saal-grid-reclaimer-link", name: "Saal Grid-Reclaimer Link", slot: "implant", equipmentClass: "Electrical rerouting cognition implant", rarity: "Singular", core: "A systems-marshal link that recognizes hostile floor grids as recoverable bus topology.", modifiers: [{ ...affixes.arcDrone }, { ...affixes.capacitorRecycler }, { ...affixes.markShear }], singularTrait: "gridReclaimer", singularEffect: "Arc Tap through machinery can collapse a nearby hostile shock grid, restoring capacitor and cooling the active weapon." })
  ],
  "Custody Director Mara Teth": [
    singular({ baseId: "teth-custody-shear-optics", name: "Custody Shear Optics", slot: "implant", equipmentClass: "Mission-custody targeting implant", rarity: "Singular", core: "A custody-control prediction layer designed to separate an operator from hardware being physically removed from the worksite.", modifiers: [{ ...affixes.markShear }, { ...affixes.magRedirect }, { ...affixes.capacitorRecycler }], singularTrait: "custodyShear", singularEffect: "Sensor Spike forces a marked objective carrier to drop mission hardware immediately and can strip nearby hostile support relays." }),
    singular({ baseId: "teth-shutterline-r6", name: "Shutterline R-6", slot: "rail", equipmentClass: "Partition-coupled precision rail assembly", rarity: "Singular", core: "A custody-lane accelerator that uses destructible partition material as an intermediate magnetic reference rather than an obstruction.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.railFracture }, { ...affixes.tungsten }], singularTrait: "shutterLine", singularEffect: "Rail rounds punch through destructible non-bulkhead cover without their normal damage loss and gain penetration and velocity." }),
    singular({ baseId: "teth-archive-relay-dynamo", name: "Archive Relay Dynamo", slot: "rig", equipmentClass: "Destruction-triggered custody relay rig", rarity: "Singular", core: "A recovered archive bus that converts the electrical collapse of battlefield hardware into an offensive disruption pulse.", modifiers: [{ ...affixes.arcDrone }, { ...affixes.capacitorRecycler }, { ...affixes.overdrive }], singularTrait: "archiveRelay", singularEffect: "Destroying cover or machinery emits an Arc pulse that disrupts and conducts nearby enemies." })
  ],
  "Survey Custodian Veyra Senn": [
    singular({ baseId: "khepri-null-rails", name: "Khepri Null-Reference Rails", slot: "rail", equipmentClass: "Survey metrology rail assembly", rarity: "Singular", core: "A Khepri reference-frame accelerator rebuilt around interruption timing and straight-line metrology.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.countermass }, { ...affixes.markShear }], singularTrait: "nullpoint", singularEffect: "Rail hits during an enemy telegraph cancel that attack and refund capacitor." }),
    singular({ baseId: "khepri-vector-harness", name: "Khepri Calibration Harness", slot: "suit", equipmentClass: "Survey calibration maneuvering suit", rarity: "Singular", core: "A low-mass survey harness designed to recapture movement energy during repeated reference passes.", modifiers: [{ ...affixes.servoWeave }, { ...affixes.countermass }, { ...affixes.capacitorRecycler }], singularTrait: "atlasDodgeCap", singularEffect: "Dodging converts pre-dodge movement speed into capacitor charge." }),
    singular({ baseId: "khepri-surveyor-node", name: "Surveyor Relay Cognition Node", slot: "implant", equipmentClass: "Khepri distributed metrology implant", rarity: "Singular", core: "A survey-network cognition layer that treats exposed machinery as part of a distributed targeting reference.", modifiers: [{ ...affixes.markShear }, { ...affixes.arcDrone }, { ...affixes.capacitorRecycler }], singularTrait: "relayCrown", singularEffect: "Sensor Spike jumps through nearby exposed machinery to additional enemies around that machine." })
  ]
};
const chaseCatalog = [
  singular({ baseId: "vacuum-choir-rails", name: "Vacuum Choir Rails", slot: "rail", equipmentClass: "Pressure-shear rail assembly", rarity: "Singular", core: "A rail package built around controlled transient pressure collapse along the firing vector.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.vacuumSeal }, { ...affixes.railFracture }], singularTrait: "vacuumWake", singularEffect: "Rail shots create a temporary low-pressure wake that pulls, staggers, and abrades nearby enemies." }),
  singular({ baseId: "atlas-countermass-harness", name: "Atlas Countermass Harness", slot: "suit", equipmentClass: "Momentum-recovery maneuvering harness", rarity: "Singular", core: "A heavy maneuvering lattice that recaptures operator momentum instead of merely cancelling it.", modifiers: [{ ...affixes.countermass }, { ...affixes.servoWeave }, { ...affixes.capacitorRecycler }], singularTrait: "atlasDodgeCap", singularEffect: "Dodging converts pre-dodge movement speed into capacitor charge." }),
  singular({ baseId: "redline-kestrel", name: "Redline Kestrel", slot: "breacher", equipmentClass: "Velocity-coupled breach scattergun", rarity: "Singular", core: "A dangerous Kestrel tune that assumes the operator is already moving when the trigger breaks.", modifiers: [{ ...affixes.overdrive }, { ...affixes.breachPropulsion }, { ...affixes.dodgeVent }], singularTrait: "redlineVelocity", singularEffect: "Breacher pellet damage scales with current operator velocity at the instant of firing." }),
  singular({ baseId: "long-arc-relay-crown", name: "Long Arc Relay Crown", slot: "implant", equipmentClass: "Distributed salvage-network implant", rarity: "Singular", core: "An improvised cognition crown that treats damaged machinery as an extension of the targeting network.", modifiers: [{ ...affixes.markShear }, { ...affixes.arcDrone }, { ...affixes.capacitorRecycler }], singularTrait: "relayCrown", singularEffect: "Sensor Spike jumps through nearby exposed machinery to additional enemies around that machine." }),
  singular({ baseId: "arcspindle-m7", name: "Arcspindle M-7", slot: "carbine", equipmentClass: "Conductive-feedback coil carbine", rarity: "Singular", core: "A carbine bus that harvests charge from already-disrupted targets.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.magRedirect }, { ...affixes.capacitorRecycler }], singularTrait: "arcspindle", singularEffect: "Carbine hits against disrupted or conductive enemies return capacitor charge." }),
  singular({ baseId: "ghostline-m7", name: "Ghostline M-7", slot: "carbine", equipmentClass: "Vacuum-optimized coil carbine", rarity: "Singular", core: "A low-pressure frame whose projectile timing assumes almost no atmospheric drag or operator footing.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.countermass }, { ...affixes.vacuumSeal }], singularTrait: "ghostline", singularEffect: "Below 35% pressure, carbine rounds gain major velocity and penetration while recoil collapses." }),
  singular({ baseId: "borecutter-m7", name: "Borecutter M-7", slot: "carbine", equipmentClass: "Industrial breaching coil carbine", rarity: "Singular", core: "A repurposed mining driver designed to turn cover and exposed machine housings into ammunition problems.", modifiers: [{ ...affixes.tungsten }, { ...affixes.extendedFeed }, { ...affixes.markShear }], singularTrait: "borecutter", singularEffect: "Player fire deals greatly increased damage to destructible cover and machinery." }),
  singular({ baseId: "stormline-ventgun", name: "Stormline Ventgun", slot: "breacher", equipmentClass: "Pressure-gradient scattergun", rarity: "Singular", core: "A gas-harvester weapon that deliberately couples muzzle impulse to nearby pressure gradients.", modifiers: [{ ...affixes.breachPropulsion }, { ...affixes.vacuumSeal }, { ...affixes.cryoloop }], singularTrait: "stormVentgun", singularEffect: "Breacher fire near an active breach gains damage and knockback while shedding some heat." }),
  singular({ baseId: "nullpoint-needle", name: "Nullpoint Needle", slot: "rail", equipmentClass: "Telegraph-interrupt precision rail", rarity: "Singular", core: "A timing-critical accelerator tuned to break hostile firing solutions during the commitment window.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.markShear }, { ...affixes.countermass }], singularTrait: "nullpoint", singularEffect: "Rail hits during an enemy telegraph cancel that attack and refund capacitor." }),
  singular({ baseId: "glasswalker-eva", name: "Glasswalker EVA Skin", slot: "suit", equipmentClass: "Hard-vacuum mobility suit", rarity: "Singular", core: "An EVA shell that stops pretending vacuum should feel like a pressurized deck.", modifiers: [{ ...affixes.vacuumSeal }, { ...affixes.servoWeave }, { ...affixes.countermass }], singularTrait: "glasswalker", singularEffect: "In near-vacuum, acceleration and maximum movement speed increase instead of collapsing into cautious footing." }),
  singular({ baseId: "cryostack-burn-rig", name: "Cryostack Burn Rig", slot: "rig", equipmentClass: "Overheat-conversion systems rig", rarity: "Singular", core: "A thermal stack that converts deliberate redline operation into short control-system windows.", modifiers: [{ ...affixes.cryoloop }, { ...affixes.overdrive }, { ...affixes.capacitorRecycler }], singularTrait: "cryostack", singularEffect: "Crossing into weapon overheat advances all ability cooldowns, rewarding deliberate redline bursts." }),
  singular({ baseId: "salvage-dynamo-rig", name: "Salvage Dynamo Rig", slot: "rig", equipmentClass: "Destruction-recovery field rig", rarity: "Singular", core: "Long Arc salvage hardware that treats collapsing battlefield machinery as an energy source.", modifiers: [{ ...affixes.capacitorRecycler }, { ...affixes.arcDrone }, { ...affixes.dodgeVent }], singularTrait: "salvageDynamo", singularEffect: "Destroying destructible cover or machinery restores capacitor and cools the current weapon." }),
  singular({ baseId: "deadreckon-optics", name: "Deadreckon Optics", slot: "implant", equipmentClass: "Kill-confirmation targeting implant", rarity: "Singular", core: "A predictive targeting layer that treats a completed marked kill as the start of the next firing solution.", modifiers: [{ ...affixes.markShear }, { ...affixes.hypervelocity }, { ...affixes.capacitorRecycler }], singularTrait: "deadreckon", singularEffect: "Killing a marked enemy nearly resets Sensor Spike." }),
  singular({ baseId: "jovian-stormskin", name: "Jovian Stormskin", slot: "suit", equipmentClass: "Electrostatic harvester pressure suit", rarity: "Singular", core: "A conductive storm-deck skin that routes electrical hazard load into the operator bus.", modifiers: [{ ...affixes.vacuumSeal }, { ...affixes.capacitorRecycler }, { ...affixes.servoWeave }], singularTrait: "stormskin", singularEffect: "Shock-grid damage is heavily reduced and partially converted into capacitor charge." }),
  singular({ baseId: "axis-ghost-rig", name: "Axis Ghost Rig", slot: "rig", equipmentClass: "Near-zero-g impulse rig", rarity: "Singular", core: "Spin-habitat maneuvering hardware designed for the almost weightless axis rather than the inhabited rim.", modifiers: [{ ...affixes.dodgeVent }, { ...affixes.magRedirect }, { ...affixes.servoWeave }], singularTrait: "axisGhost", singularEffect: "Dodging below 0.12g emits a radial impulse that throws nearby enemies away." }),
  singular({ baseId: "pendulum-kestrel", name: "Pendulum Kestrel", slot: "breacher", equipmentClass: "Counter-impulse breach scattergun", rarity: "Singular", core: "A transfer-lane Kestrel calibrated to spend an incoming movement vector instead of adding another one.", modifiers: [{ ...affixes.countermass }, { ...affixes.breachPropulsion }, { ...affixes.capacitorRecycler }], singularTrait: "pendulumBreach", singularEffect: "Firing the Breacher against your current direction of travel brakes momentum, amplifies the shot, and returns capacitor charge." }),
  singular({ baseId: "mass-return-crown", name: "Mass-Return Crown", slot: "implant", equipmentClass: "Countermass field cognition implant", rarity: "Singular", core: "An exchange-control cognition layer that can identify a local gravity or countermass field as recoverable bus energy.", modifiers: [{ ...affixes.magRedirect }, { ...affixes.capacitorRecycler }, { ...affixes.servoWeave }], singularTrait: "massTap", singularEffect: "Magnetic Impulse consumes one nearby gravity/countermass field and converts it into capacitor charge." }),
  singular({ baseId: "umbra-heatsink-rig", name: "Umbra Heat-Sink Rig", slot: "rig", equipmentClass: "Cryogenic purge recovery rig", rarity: "Singular", core: "A reserve-yard thermal bus that treats cryogenic purge exposure as useful sink capacity instead of pure hazard.", modifiers: [{ ...affixes.cryoloop }, { ...affixes.capacitorRecycler }, { ...affixes.dodgeVent }], singularTrait: "boiloffSink", singularEffect: "Coolant and boiloff plumes cool all weapons and convert the normal boiloff capacitor loss into charge." }),
  singular({ baseId: "cryoline-reference-rails", name: "Cryoline Reference Rails", slot: "rail", equipmentClass: "Cold-start precision rail assembly", rarity: "Singular", core: "A metrology accelerator built around the first cold shot after a thermal reset rather than sustained redline operation.", modifiers: [{ ...affixes.cryoloop }, { ...affixes.hypervelocity }, { ...affixes.markShear }], singularTrait: "cryolineRail", singularEffect: "Rail shots fired from a cold weapon bus gain major damage and penetration, rewarding deliberate thermal resets." }),
  singular({ baseId: "breathless-choir-mantle", name: "Breathless Choir Mantle", slot: "suit", equipmentClass: "Vacuum-pulse maneuvering pressure suit", rarity: "Singular", core: "A damaged-vessel EVA shell that deliberately spends bus charge to leave a controllable pressure discontinuity behind a dodge.", modifiers: [{ ...affixes.vacuumSeal }, { ...affixes.servoWeave }, { ...affixes.capacitorRecycler }], singularTrait: "pressureReservoir", singularEffect: "Dodging below 35% pressure spends 8 capacitor to leave a short player-owned low-pressure wake; no charge means no wake." }),
  singular({ baseId: "vector-debt-m12", name: "Vector Debt M-12", slot: "carbine", equipmentClass: "Recoil-accounting coil carbine", rarity: "Singular", core: "A transfer-exchange receiver that deliberately refuses to cancel all recoil because the operator bus can collect part of the impulse debt.", modifiers: [{ ...affixes.countermass }, { ...affixes.capacitorRecycler }, { ...affixes.hypervelocity }], singularTrait: "recoilDynamo", singularEffect: "Carbine recoil is amplified but converted into a capped capacitor return on each shot; it never stacks additively with other recoil refunds." }),
  singular({ baseId: "relay-orchard-node", name: "Relay Orchard Node", slot: "implant", equipmentClass: "Machine-network propagation implant", rarity: "Singular", core: "A solar-yard routing layer that treats exposed machinery as a temporary orchard of targeting relays rather than a single conduit.", modifiers: [{ ...affixes.arcDrone }, { ...affixes.markShear }, { ...affixes.capacitorRecycler }], singularTrait: "relayOrchard", singularEffect: "Arc Tap through machinery marks up to two nearby enemies and trims Sensor Spike recovery." }),
  singular({ baseId: "cold-witness-r7", name: "Cold Witness R-7", slot: "rail", equipmentClass: "Mark-consuming survey rail assembly", rarity: "Singular", core: "A lattice-annex accelerator built to spend a verified Sensor Spike solution on one decisive follow-up rather than keep the target painted.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.markShear }, { ...affixes.cryoloop }], singularTrait: "coldWitness", singularEffect: "A Rail hit consumes an active mark, cools the rail bus, and leaves a short Armor Breach window." }),
  singular({ baseId: "radiant-liability-kestrel", name: "Radiant Liability Kestrel", slot: "breacher", equipmentClass: "Defensive redline scatter assembly", rarity: "Singular", core: "A solar-yard Kestrel that routes the thermal liability of near-overheat firing into suit plate servos instead of treating redline as a pure failure state.", modifiers: [{ ...affixes.overdrive }, { ...affixes.cryoloop }, { ...affixes.tungsten }], singularTrait: "redlineBulwark", singularEffect: "Breacher hits above 75% heat rebuild small amounts of armor, but each redline shot adds extra heat." }),
  singular({ baseId: "palisade-breaker-b9", name: "Palisade Breaker B-9", slot: "breacher", equipmentClass: "Close armor-demolition scatter assembly", rarity: "Singular", core: "An orbital boarding cage designed to turn point-blank plate failure into space control instead of chasing raw health damage.", modifiers: [{ ...affixes.tungsten }, { ...affixes.countermass }, { ...affixes.extendedFeed }], singularTrait: "closeBreach", singularEffect: "Inside 300 units, Breacher pellets gain a capped armor-damage conversion but lose direct-health efficiency." }),
  singular({ baseId: "capacitor-rosary-rig", name: "Capacitor Rosary Rig", slot: "rig", equipmentClass: "Ability-sequence power bus", rarity: "Singular", core: "An Umbra service rig whose switching relays are arranged around deliberate MAG/MARK/ARC sequencing rather than one favored ability.", modifiers: [{ ...affixes.capacitorRecycler }, { ...affixes.cryoloop }, { ...affixes.arcDrone }], singularTrait: "abilityRosary", singularEffect: "Using a different ability within the combo window cools the active weapon and trims the previous ability recovery." }),
  singular({ baseId: "vacuum-psalm-m12", name: "Vacuum Psalm M-12", slot: "carbine", equipmentClass: "Pressure-dependent coil carbine", rarity: "Singular", core: "A gas-harvester receiver whose flight timing is tuned for thin atmosphere and deliberately feels sluggish on a fully pressurized deck.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.vacuumSeal }, { ...affixes.countermass }], singularTrait: "pressureBallistics", singularEffect: "Below 45% pressure, carbine rounds gain velocity and penetration; above 75% pressure, projectile velocity is reduced." }),
  singular({ baseId: "falling-star-harness", name: "Falling Star Harness", slot: "suit", equipmentClass: "Momentum-to-targeting maneuvering suit", rarity: "Singular", core: "A spin-habitat harness that turns a committed approach vector into a targeting handoff as the operator exits the dodge.", modifiers: [{ ...affixes.servoWeave }, { ...affixes.countermass }, { ...affixes.markShear }], singularTrait: "momentumMark", singularEffect: "Dodging with high pre-dodge speed spends 6 capacitor to mark the nearest visible enemy." }),
  singular({ baseId: "scrap-circuit-rig", name: "Scrap Circuit Rig", slot: "rig", equipmentClass: "Destruction-to-Arc recovery bus", rarity: "Singular", core: "An ice-mine field bus that uses the electrical collapse of machinery to precharge Arc Tap instead of harvesting the wreck for raw damage.", modifiers: [{ ...affixes.arcDrone }, { ...affixes.capacitorRecycler }, { ...affixes.dodgeVent }], singularTrait: "scrapCircuit", singularEffect: "Destroying machinery spends 4 capacitor to advance Arc Tap recovery by 0.9 seconds." }),
  singular({ baseId: "eventide-eva-skin", name: "Eventide EVA Skin", slot: "suit", equipmentClass: "Cryogenic-plume maneuvering suit", rarity: "Singular", core: "An Umbra EVA skin built to cross service-purge geometry by consuming it as a one-shot maneuvering resource.", modifiers: [{ ...affixes.vacuumSeal }, { ...affixes.servoWeave }, { ...affixes.dodgeVent }], singularTrait: "boiloffDash", singularEffect: "Dodging through a nearby coolant or boiloff plume spends 8 capacitor, consumes one plume, extends the dash, and cools all weapons." }),
  singular({ baseId: "khepri-split-reference-link", name: "Khepri Split-Reference Link", slot: "implant", equipmentClass: "Marked-machine Arc cognition implant", rarity: "Singular", core: "A Khepri reconstruction that spends a mark as permission to use nearby machinery as a second electrical origin.", modifiers: [{ ...affixes.markShear }, { ...affixes.arcDrone }, { ...affixes.magRedirect }], singularTrait: "splitReference", singularEffect: "Arc Tap on a marked target consumes the mark and can relay through nearby machinery into a second enemy." }),
  singular({ baseId: "sixth-vector-m12", name: "Sixth-Vector M-12", slot: "carbine", equipmentClass: "Cadence-fork coil carbine", rarity: "Singular", core: "A counter-rotating feed cage stores a firing solution for exactly five ordinary pulses before opening two side vectors on the sixth.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.extendedFeed }, { ...affixes.overdrive }], singularTrait: "forkedSpool", singularEffect: "Every sixth Carbine shot forks two 55% side vectors. The forked shot adds extra heat, rewarding deliberate cadence rather than permanent free damage." }),
  singular({ baseId: "backstep-kestrel-b9", name: "Backstep Kestrel B-9", slot: "breacher", equipmentClass: "Counterstep breach scattergun", rarity: "Singular", core: "A recoil latch reads suit-thruster transients and briefly opens a second scatter gate after a committed evasive burn.", modifiers: [{ ...affixes.countermass }, { ...affixes.breachPropulsion }, { ...affixes.dodgeVent }], singularTrait: "breachEcho", singularEffect: "A Breacher shot within 0.65s of a dodge gains a three-pellet 55% echo cone, but the echoed shot adds extra heat." }),
  singular({ baseId: "cold-doublet-r7", name: "Cold Doublet R-7", slot: "rail", equipmentClass: "Cold-start paired rail lance", rarity: "Singular", core: "Two unequal accelerator rails share a cryogenic bus: the secondary rail is stable only before the primary assembly warms.", modifiers: [{ ...affixes.cryoloop }, { ...affixes.tungsten }, { ...affixes.countermass }], singularTrait: "railDoublet", singularEffect: "Below 22% Rail heat and with 8 spare capacitor, each Rail shot launches a second 58% penetrator. The doublet consumes the extra capacitor and adds heat." }),
  singular({ baseId: "bloom-vector-rig", name: "Bloom Vector Rig", slot: "rig", equipmentClass: "Radial impulse recovery rig", rarity: "Singular", core: "A ring of sacrificial micro-coils turns the MAG field collapse into a brief omnidirectional kinetic bloom.", modifiers: [{ ...affixes.capacitorRecycler }, { ...affixes.magRedirect }, { ...affixes.servoWeave }], singularTrait: "magBloom", singularEffect: "MAG fires eight radial kinetic micro-slugs after the impulse. Magnetic Impulse costs 25% more capacitor and recovers 8% slower." }),
  singular({ baseId: "cascade-sight-link", name: "Cascade Sight Link", slot: "implant", equipmentClass: "Kill-relay sensor cognition link", rarity: "Singular", core: "A narrowband target model refuses to hold one solution for long, but transfers the dying target state into the nearest live return.", modifiers: [{ ...affixes.markShear }, { ...affixes.arcDrone }, { ...affixes.capacitorRecycler }], singularTrait: "markCascade", singularEffect: "Killing a marked target relays a 4.2s mark to a nearby enemy. Initial Sensor Spike marks are shorter and Sensor Spike recovers 12% slower." })
];
function inferFactionFromBaseId(baseId) {
  if (baseId.startsWith("voss-")) return "meridian";
  if (baseId.startsWith("rhea-") || baseId === "long-arc-relay-crown" || baseId === "salvage-dynamo-rig") return "longarc";
  if (baseId.startsWith("helios-")) return "heliostat";
  return void 0;
}
Object.values(bossSingularPools).reduce((total, pool) => total + pool.length, 0) + chaseCatalog.length;
const progressionNodes = [
  { id: "ballistics-1", branch: "Ballistics", name: "Dense Flight", description: "+8 penetration to all player projectiles." },
  { id: "ballistics-2", branch: "Ballistics", name: "Armor Work", description: "+15% armor damage.", requires: "ballistics-1" },
  { id: "ballistics-3", branch: "Ballistics", name: "Breach Doctrine", description: "Armor Breach lasts longer, but direct health damage is slightly reduced.", major: true, requires: "ballistics-2" },
  { id: "mobility-1", branch: "Mobility", name: "Servo Timing", description: "+6% movement speed." },
  { id: "mobility-2", branch: "Mobility", name: "Low-G Footwork", description: "Improved stopping control below 0.35g.", requires: "mobility-1" },
  { id: "mobility-3", branch: "Mobility", name: "Recoil Vectoring", description: "While moving, 35% of weapon recoil is redirected into your chosen movement vector.", major: true, requires: "mobility-2" },
  { id: "systems-1", branch: "Systems", name: "Efficient Bus", description: "+12% capacitor regeneration." },
  { id: "systems-2", branch: "Systems", name: "Signal Compression", description: "-8% ability capacitor cost.", requires: "systems-1" },
  { id: "systems-3", branch: "Systems", name: "Disruption Relay", description: "Electronically disrupted targets can be serviced by a relay microdrone.", major: true, requires: "systems-2" },
  { id: "survival-1", branch: "Survival", name: "Layered Plate", description: "+12 maximum armor." },
  { id: "survival-2", branch: "Survival", name: "Pressure Discipline", description: "Vacuum exposure builds more slowly.", requires: "survival-1" },
  { id: "survival-3", branch: "Survival", name: "Hard Vacuum Familiarity", description: "Greatly reduces vacuum damage and decompression pull.", major: true, requires: "survival-2" },
  { id: "engineering-1", branch: "Engineering", name: "Thermal Routing", description: "+12% weapon heat dissipation." },
  { id: "engineering-2", branch: "Engineering", name: "Quick Vent", description: "Manual vent cycles complete faster.", requires: "engineering-1" },
  { id: "engineering-3", branch: "Engineering", name: "Dodge Heat Shunt", description: "Dodging vents weapon heat.", major: true, requires: "engineering-2" },
  { id: "awareness-1", branch: "Awareness", name: "Predictive Lead", description: "+8% projectile velocity." },
  { id: "awareness-2", branch: "Awareness", name: "Weak-Path Telemetry", description: "Marked targets take more armor damage.", requires: "awareness-1" },
  { id: "awareness-3", branch: "Awareness", name: "Penetration Optics", description: "Sensor-marked targets expose penetration paths to all weapons.", major: true, requires: "awareness-2" }
];
const specializationDefinitions = [
  { id: "pressure-diver", name: "Pressure Diver", identity: "Pressure / vacuum manipulation", description: "MAG below 45% pressure leaves a short player-owned vacuum wake, while ability use sheds accumulated vacuum exposure.", tradeoff: "-12 maximum armor.", overclock: "Low-pressure wakes last longer and ability use clears more exposure.", overclockTradeoff: "+12% ability capacitor cost." },
  { id: "momentum-broker", name: "Momentum Broker", identity: "Recoil / capacitor conversion", description: "Weapon recoil is treated as recoverable bus energy, returning a capped amount of capacitor per shot.", tradeoff: "-15% passive capacitor regeneration.", overclock: "Raises the per-shot recoil conversion ceiling from 8 to 10 capacitor.", overclockTradeoff: "+12% weapon recoil." },
  { id: "grid-weaver", name: "Grid Weaver", identity: "Machinery-network Arc routing", description: "Arc Tap through machinery can paint an additional remote target for MARK follow-up.", tradeoff: "-4% direct weapon output.", overclock: "Machinery Arc also advances Sensor Spike recovery.", overclockTradeoff: "+15% Arc Tap capacitor cost." },
  { id: "survey-deadeye", name: "Survey Deadeye", identity: "Marked-target rail precision", description: "Rail hits consume marks to break committed attacks and create a short Armor Breach window.", tradeoff: "Sensor Spike marks are 20% shorter and recover 10% slower.", overclock: "Consuming a mark pulls Sensor Spike back toward a 2.2 second recovery window.", overclockTradeoff: "+8% Rail Lance heat per shot." },
  { id: "redline-pilot", name: "Redline Pilot", identity: "Heat / mobility decisions", description: "Above 75% active-weapon heat, movement acceleration and maximum speed increase instead of encouraging immediate disengagement.", tradeoff: "-18% passive weapon cooling.", overclock: "A high-heat dodge vents heat and emits a short stagger pulse.", overclockTradeoff: "-8 maximum armor; the high-heat pulse adds 0.18s dodge recovery." },
  { id: "breach-vanguard", name: "Breach Vanguard", identity: "Close armor-breaking assault", description: "Breacher hits inside 300 units gain a capped armor-damage conversion and armor breaks stagger the target.", tradeoff: "-5% movement speed and +10% Breacher heat per shot.", overclock: "Close armor breaks rebuild a small amount of operator armor.", overclockTradeoff: "-8% Breacher direct-health conversion." },
  { id: "capacitor-conductor", name: "Capacitor Conductor", identity: "Ability-cycle combo routing", description: "Casting a different MAG/MARK/ARC ability within 3.4 seconds returns capped capacitor and rewards deliberate three-button sequencing.", tradeoff: "-12 maximum capacitor.", overclock: "Completing the third link of a sequence raises the capped refund and cools the active weapon.", overclockTradeoff: "+10% ability capacitor cost." }
];
function cloneItem(item) {
  const recoveryLevel = item.recoveryLevel ?? Math.max(1, Math.min(56, item.levelRequirement * 4));
  const frameGeneration = item.frameGeneration ?? 1;
  const recoveryQuality = item.recoveryQuality ?? 0;
  const frameIdentity = item.frameIdentity ?? inferFrameIdentity(item.slot, `${item.baseId}:${item.name}`);
  const equipmentQuality = Math.max(0, Math.min(20, item.equipmentQuality ?? equipmentQualityForRecovery(recoveryQuality, frameGeneration, item.rarity)));
  const augmentSlots = item.augmentSlots ?? augmentSlotCount(item.rarity, frameGeneration);
  return {
    ...item,
    faction: item.faction ?? inferFactionFromBaseId(item.baseId),
    recoveryLevel,
    frameGeneration,
    frameIdentity,
    frameImplicit: frameImplicitFor(item.slot, frameGeneration, frameIdentity, equipmentQuality),
    equipmentQuality,
    augmentSlots,
    augments: normalizeAugments(item.slot, item.augments ?? [], augmentSlots),
    recoveryQuality,
    recoverySource: item.recoverySource ?? "Legacy recovery",
    modifiers: item.modifiers.map((modifier) => materializeModifier(modifier.id, modifier.grade ?? 3))
  };
}
const levelThresholds = [0, 120, 300, 540, 840, 1200, 1620, 2100, 2640, 3240, 3900, 4620, 5400, 6240, 7140, 8100, 9120, 10200, 11340, 12540];
const maxLevelXp = levelThresholds[levelThresholds.length - 1];
function createDefaultProfile() {
  const inventory = starterItems.map(cloneItem);
  return { version: 3, xp: 0, level: 1, progressionPoints: 0, allocatedNodes: [], abilityMods: { mag: null, mark: null, arc: null }, specialization: null, specializationOverclock: false, inventory, equipped: { carbine: "starter-carbine", breacher: "starter-breacher", rail: "starter-rail", suit: "starter-suit", rig: "starter-rig", implant: "starter-implant" }, settings: { aimAssist: "balanced", rightStickFire: true, screenShake: true, effectIntensity: "full", effectsVolume: 0.65, uiVolume: 0.45, haptics: true, telemetrySharing: false, tutorialComplete: false }, runsCompleted: 0 };
}
function loadProfile() {
  if (typeof window === "undefined") return createDefaultProfile();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProfile();
    const parsed = JSON.parse(raw);
    if (parsed.version !== 3 || !Array.isArray(parsed.inventory)) return createDefaultProfile();
    const defaults = createDefaultProfile();
    const parsedXp = typeof parsed.xp === "number" && Number.isFinite(parsed.xp) ? parsed.xp : defaults.xp;
    const parsedLevel = typeof parsed.level === "number" && Number.isFinite(parsed.level) ? Math.round(parsed.level) : defaults.level;
    const storedXp = Math.max(0, Math.min(maxLevelXp, parsedXp));
    const storedLevel = Math.max(1, Math.min(levelThresholds.length, parsedLevel));
    const normalizedXp = Math.max(storedXp, levelThresholds[storedLevel - 1] ?? 0);
    const normalizedLevel = levelForXp(normalizedXp);
    const allocatedNodes = Array.isArray(parsed.allocatedNodes) ? parsed.allocatedNodes : [];
    const validAllocatedCount = new Set(allocatedNodes.filter((id) => progressionNodes.some((node) => node.id === id))).size;
    const parsedPoints = typeof parsed.progressionPoints === "number" && Number.isFinite(parsed.progressionPoints) ? Math.max(0, Math.floor(parsed.progressionPoints)) : defaults.progressionPoints;
    const progressionPoints = Math.max(parsedPoints, Math.max(0, normalizedLevel - 1 - validAllocatedCount));
    const specialization = normalizedLevel >= 15 && specializationDefinitions.some((definition) => definition.id === parsed.specialization) ? parsed.specialization : null;
    const specializationOverclock = normalizedLevel >= 16 && !!specialization && parsed.specializationOverclock === true;
    return {
      ...defaults,
      ...parsed,
      xp: normalizedXp,
      level: normalizedLevel,
      progressionPoints,
      specialization,
      specializationOverclock,
      settings: { ...defaults.settings, ...parsed.settings },
      abilityMods: { ...defaults.abilityMods, ...parsed.abilityMods },
      equipped: { ...defaults.equipped, ...parsed.equipped },
      inventory: parsed.inventory.map((item) => cloneItem(item)),
      allocatedNodes
    };
  } catch {
    return createDefaultProfile();
  }
}
function saveProfile(profile) {
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}
function levelForXp(xp) {
  let level = 1;
  for (let index = 1; index < levelThresholds.length; index += 1) if (xp >= levelThresholds[index]) level = index + 1;
  return level;
}
const PROFILE_STORAGE_KEY = "ironshade-vector-profile-v3";
const CAMPAIGN_STORAGE_KEY = "ironshade-vector-campaign-v1";
const GAME_STATE_STORAGE_KEY = "ironshade-vector-state-v1";
const RECOVERY_DATABASE = "ironshade-vector-recovery";
const RECOVERY_STORE = "backups";
const PROFILE_VERSION = 3;
const CAMPAIGN_VERSION = 1;
const profileSlots = /* @__PURE__ */ new Set(["carbine", "breacher", "rail", "suit", "rig", "implant"]);
const profileRarities = /* @__PURE__ */ new Set(["Field", "Refined", "Prototype", "Singular"]);
const modifierIds = /* @__PURE__ */ new Set([
  "hypervelocity",
  "countermass",
  "overdrive",
  "cryoloop",
  "extendedFeed",
  "tungsten",
  "vacuumSeal",
  "servoWeave",
  "capacitorRecycler",
  "railFracture",
  "dodgeVent",
  "magRedirect",
  "breachPropulsion",
  "markShear",
  "arcDrone"
]);
const frameIdentityById = new Map(frameIdentityDefinitions.map((definition) => [definition.id, definition]));
const augmentById = new Map(augmentDefinitions.map((definition) => [definition.id, definition]));
function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function invalidProfileReason(value) {
  if (!isRecord(value)) return "profile root is not an object";
  if (value.version !== PROFILE_VERSION) return `unsupported profile version ${String(value.version ?? "missing")}`;
  if (!Array.isArray(value.inventory)) return "profile inventory is not an array";
  for (let index = 0; index < value.inventory.length; index += 1) {
    const item = value.inventory[index];
    if (!isRecord(item)) return `inventory item ${index} is not an object`;
    if (typeof item.slot !== "string" || !profileSlots.has(item.slot)) return `inventory item ${index} has an unknown equipment slot`;
    if (typeof item.rarity !== "string" || !profileRarities.has(item.rarity)) return `inventory item ${index} has an unknown rarity`;
    if (!Array.isArray(item.modifiers)) return `inventory item ${index} modifiers are not an array`;
    for (const modifier of item.modifiers) {
      if (!isRecord(modifier) || typeof modifier.id !== "string" || !modifierIds.has(modifier.id)) return `inventory item ${index} contains an unknown modifier`;
      const grade = modifier.grade;
      if (grade !== void 0 && (typeof grade !== "number" || !Number.isFinite(grade) || grade < 1 || grade > 5)) return `inventory item ${index} contains an invalid modifier grade`;
    }
    if (item.frameIdentity !== void 0) {
      if (typeof item.frameIdentity !== "string") return `inventory item ${index} has an invalid frame identity`;
      const frame = frameIdentityById.get(item.frameIdentity);
      if (!frame || frame.slot !== item.slot) return `inventory item ${index} has an unknown or mismatched frame identity`;
    }
    if (item.augments !== void 0) {
      if (!Array.isArray(item.augments)) return `inventory item ${index} augments are not an array`;
      for (const augmentId of item.augments) {
        if (typeof augmentId !== "string") return `inventory item ${index} contains an invalid Augment id`;
        const augment = augmentById.get(augmentId);
        if (!augment || !augment.slots.includes(item.slot)) return `inventory item ${index} contains an unknown or incompatible Augment`;
      }
    }
  }
  return null;
}
function objectFieldReason(value, field) {
  const candidate = value[field];
  return candidate !== void 0 && !isRecord(candidate) ? `${field} is not an object` : null;
}
function arrayFieldReason(value, label, field) {
  if (!isRecord(value)) return null;
  const candidate = value[field];
  return candidate !== void 0 && !Array.isArray(candidate) ? `${label}.${field} is not an array` : null;
}
function invalidCampaignReason(value) {
  if (!isRecord(value)) return "campaign root is not an object";
  if (value.version !== CAMPAIGN_VERSION) return `unsupported campaign version ${String(value.version ?? "missing")}`;
  for (const field of ["resources", "consumables", "reputation", "shipUpgrades", "story", "escalation", "directives"]) {
    const reason = objectFieldReason(value, field);
    if (reason) return reason;
  }
  const story = value.story;
  if (isRecord(story)) {
    const arcsReason = objectFieldReason(story, "arcs");
    if (arcsReason) return `story.${arcsReason}`;
    for (const chapter of ["blackLattice", "postKhepri", "interdiction"]) {
      const chapterValue = story[chapter];
      if (chapterValue !== void 0 && !isRecord(chapterValue)) return `story.${chapter} is not an object`;
      for (const field of chapter === "interdiction" ? ["completed", "evidence", "identifiedTargets"] : ["completed", "evidence"]) {
        const reason = arrayFieldReason(chapterValue, `story.${chapter}`, field);
        if (reason) return reason;
      }
    }
  }
  const escalationReason = arrayFieldReason(value.escalation, "escalation", "completed");
  if (escalationReason) return escalationReason;
  const directivesReason = arrayFieldReason(value.directives, "directives", "inventory");
  if (directivesReason) return directivesReason;
  return null;
}
function validateStoredProfile(value) {
  return invalidProfileReason(value);
}
function validateStoredCampaign(value) {
  return invalidCampaignReason(value);
}
function invalidGameStateReason(value) {
  if (!isRecord(value)) return "game-state root is not an object";
  if (value.version !== 1) return `unsupported game-state version ${String(value.version ?? "missing")}`;
  const profileReason = invalidProfileReason(value.profile);
  if (profileReason) return `profile: ${profileReason}`;
  const campaignReason = invalidCampaignReason(value.campaign);
  if (campaignReason) return `campaign: ${campaignReason}`;
  return null;
}
function browserStorage$1() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function browserIndexedDb() {
  if (typeof indexedDB === "undefined") return null;
  return indexedDB;
}
function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}
function backupToIndexedDb(factory, key, record) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    try {
      const request = factory.open(RECOVERY_DATABASE, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(RECOVERY_STORE)) database.createObjectStore(RECOVERY_STORE);
      };
      request.onerror = () => finish(false);
      request.onblocked = () => finish(false);
      request.onsuccess = () => {
        const database = request.result;
        try {
          const transaction = database.transaction(RECOVERY_STORE, "readwrite");
          transaction.objectStore(RECOVERY_STORE).put(record, key);
          transaction.oncomplete = () => {
            database.close();
            finish(true);
          };
          transaction.onerror = () => {
            database.close();
            finish(false);
          };
          transaction.onabort = () => {
            database.close();
            finish(false);
          };
        } catch {
          database.close();
          finish(false);
        }
      };
    } catch {
      finish(false);
    }
  });
}
async function preserveRawSave(storage2, indexedDb, sourceKey, kind, raw, reason, createdAt, suffix) {
  const backupKey = `${sourceKey}-recovery-${createdAt.replace(/[^0-9]/g, "")}-${suffix}`;
  const record = { version: 1, sourceKey, kind, createdAt, reason, raw };
  if (indexedDb && await backupToIndexedDb(indexedDb, backupKey, record)) {
    return { kind, sourceKey, backupKey, medium: "indexeddb", reason };
  }
  try {
    storage2.setItem(backupKey, raw);
    if (storage2.getItem(backupKey) === raw) return { kind, sourceKey, backupKey, medium: "localStorage", reason };
  } catch {
  }
  return null;
}
async function inspectSave(storage2, indexedDb, sourceKey, kind, validator, createdAt, suffix) {
  let raw;
  try {
    raw = storage2.getItem(sourceKey);
  } catch {
    return { blocked: true, notice: `${kind.toUpperCase()} SAVE RECOVERY LOCK // existing browser storage could not be read, so the game was not started and no save was overwritten.`, backup: null };
  }
  if (!raw) return { blocked: false, notice: null, backup: null };
  let parsed;
  let reason = null;
  try {
    parsed = JSON.parse(raw);
    reason = validator(parsed);
  } catch {
    reason = "save JSON could not be parsed";
  }
  if (!reason) return { blocked: false, notice: null, backup: null };
  const backup = await preserveRawSave(storage2, indexedDb, sourceKey, kind, raw, reason, createdAt, suffix);
  if (!backup) {
    return { blocked: true, notice: `${kind.toUpperCase()} SAVE RECOVERY LOCK // ${reason}. The original save remains untouched because a verified backup could not be created.`, backup: null };
  }
  try {
    storage2.removeItem(sourceKey);
    if (storage2.getItem(sourceKey) !== null) throw new Error("save key still present");
  } catch {
    return { blocked: true, notice: `${kind.toUpperCase()} SAVE RECOVERY LOCK // ${reason}. A backup was preserved in ${backup.medium}, but the unsafe primary save could not be detached, so startup was stopped.`, backup };
  }
  return {
    blocked: false,
    notice: `${kind.toUpperCase()} SAVE RECOVERY // ${reason}. The original raw save was preserved in ${backup.medium} as ${backup.backupKey} before a clean save was allowed to start.`,
    backup
  };
}
async function prepareSaveRecovery(environment = {}) {
  if (typeof window === "undefined" && environment.storage === void 0) return { blocked: false, notices: [], backups: [] };
  const storage2 = environment.storage === void 0 ? browserStorage$1() : environment.storage;
  const indexedDb = environment.indexedDb === void 0 ? browserIndexedDb() : environment.indexedDb;
  if (!storage2) return { blocked: true, notices: ["SAVE RECOVERY LOCK // persistent browser storage is unavailable, so startup was stopped before any existing save could be replaced."], backups: [] };
  const now = (environment.now ?? (() => /* @__PURE__ */ new Date()))();
  const createdAt = now.toISOString();
  const makeId = environment.id ?? randomId;
  const state = await inspectSave(storage2, indexedDb ?? null, GAME_STATE_STORAGE_KEY, "state", invalidGameStateReason, createdAt, makeId());
  const profile = await inspectSave(storage2, indexedDb ?? null, PROFILE_STORAGE_KEY, "profile", invalidProfileReason, createdAt, makeId());
  const campaign2 = await inspectSave(storage2, indexedDb ?? null, CAMPAIGN_STORAGE_KEY, "campaign", invalidCampaignReason, createdAt, makeId());
  const backups = [state.backup, profile.backup, campaign2.backup].filter((backup) => !!backup);
  const notices = [state.notice, profile.notice, campaign2.notice].filter((notice) => !!notice);
  return { blocked: state.blocked || profile.blocked || campaign2.blocked, notices, backups };
}
function browserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function legacySnapshot() {
  return { profile: loadProfile(), campaign: loadCampaign() };
}
function loadGameState(storage2 = browserStorage()) {
  if (!storage2) return legacySnapshot();
  try {
    const raw = storage2.getItem(GAME_STATE_STORAGE_KEY);
    if (!raw) return legacySnapshot();
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1) return legacySnapshot();
    if (validateStoredProfile(parsed.profile) || validateStoredCampaign(parsed.campaign)) return legacySnapshot();
    return { profile: parsed.profile, campaign: parsed.campaign };
  } catch {
    return legacySnapshot();
  }
}
function saveGameState(profile, campaign2, storage2 = browserStorage()) {
  if (!storage2) return typeof window === "undefined";
  if (validateStoredProfile(profile) || validateStoredCampaign(campaign2)) return false;
  const envelope = { version: 1, profile, campaign: campaign2, savedAt: (/* @__PURE__ */ new Date()).toISOString() };
  try {
    storage2.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}
function carryExpeditionLoot(collectedLoot) {
  return collectedLoot.map((receipt) => ({ ...receipt }));
}
const storage = /* @__PURE__ */ new Map();
let failStorageWrites = false;
let failBackupWrites = false;
const localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => {
    if (failStorageWrites || failBackupWrites && key.includes("-recovery-")) throw new Error("storage blocked");
    storage.set(key, String(value));
  },
  removeItem: (key) => {
    storage.delete(key);
  },
  clear: () => {
    storage.clear();
  }
};
globalThis.window = { localStorage };
const migratedSource = createDefaultCampaign();
const { consumables: _oldConsumables, ...legacyCampaign } = migratedSource;
localStorage.setItem("ironshade-vector-campaign-v1", JSON.stringify(legacyCampaign));
const migrated = loadCampaign();
assert.deepEqual(migrated.consumables, { medGel: 1, armorPatch: 0, capacitorCell: 0 }, "existing saves should receive compatible default consumable storage");
let campaign = createDefaultCampaign();
const creditsBefore = campaign.resources.credits;
const stockBefore = campaign.consumables.medGel;
const purchase = buyConsumable(campaign, "medGel");
campaign = purchase.campaign;
assert.equal(campaign.resources.credits, creditsBefore - 45, "Trauma Gel should cost Credits");
assert.equal(campaign.consumables.medGel, stockBefore + 1, "purchase should increase persistent stock");
saveCampaign(campaign);
assert.equal(loadCampaign().consumables.medGel, stockBefore + 1, "consumable stock should round-trip through campaign save");
const healState = createSimulation();
healState.player.hp = 25;
assert.equal(triggerConsumable(healState, "medGel"), true);
assert.equal(healState.player.hp, 65);
assert.equal(triggerConsumable(healState, "medGel"), false, "consumables should respect the shared use cooldown");
healState.player.consumableCooldown = 0;
healState.player.armor = 10;
assert.equal(triggerConsumable(healState, "armorPatch"), true);
assert.equal(healState.player.armor, 45);
healState.player.consumableCooldown = 0;
healState.player.capacitor = 20;
healState.player.weaponHeat.carbine = 0.8;
assert.equal(triggerConsumable(healState, "capacitorCell"), true);
assert.equal(healState.player.capacitor, 65);
assert.ok(Math.abs(healState.player.weaponHeat.carbine - 0.56) < 1e-4);
const deathState = createSimulation();
deathState.player.hp = 1;
deathState.player.armor = deathState.player.maxArmor;
applyPlayerDamage(deathState, 5, 0);
assert.equal(deathState.player.dead, true, "a real damaging hit at displayed 1 HP must be lethal");
assert.equal(deathState.player.hp, 0);
assert.equal(deathState.telemetry.deaths, 1);
const aimState = createSimulation();
aimState.player.x = 1e3;
aimState.player.y = 500;
aimState.player.aim = { x: 1, y: 0 };
for (const enemy of aimState.enemies) enemy.active = false;
const target = aimState.enemies.find((enemy) => enemy.id === 1);
target.active = true;
target.dead = false;
target.x = 700;
target.y = 500;
assert.equal(aimAtMobileTarget(aimState, "balanced", target.id), target.id);
assert.ok(aimState.player.aim.x > 0.95, "first target-switch frame should turn toward the new target instead of snapping 180 degrees");
for (let i = 0; i < 30; i += 1) aimAtMobileTarget(aimState, "balanced", target.id);
assert.ok(aimState.player.aim.x < -0.95, "assisted aim should still converge fully on the target");
const expeditionLootSource = [{ id: "stage-1-drop", enemyId: 7, enemyLabel: "Stage One Elite", rarity: "Prototype", source: "elite", recoveryQualityFloor: 3, recoveryLevel: 24, monsterLevel: 8 }];
const expeditionLootCarry = carryExpeditionLoot(expeditionLootSource);
assert.deepEqual(expeditionLootCarry, expeditionLootSource, "megastructure stage transit should preserve every collected field-loot receipt");
assert.notEqual(expeditionLootCarry, expeditionLootSource, "stage transit should copy the receipt list instead of sharing the mutable array");
assert.notEqual(expeditionLootCarry[0], expeditionLootSource[0], "stage transit should copy individual receipts so later mutation cannot rewrite earlier-stage recovery data");
const gameCanvasSource = readFileSync("src/components/GameCanvas.tsx", "utf8");
assert.match(gameCanvasSource, /state\.collectedLoot = carryExpeditionLoot\(carry\.collectedLoot\);/, "GameCanvas must carry collected expedition loot into each new megastructure stage");
failStorageWrites = true;
assert.equal(saveCampaign(campaign), false, "campaign persistence should report blocked storage without throwing");
assert.equal(saveProfile(createDefaultProfile()), false, "profile persistence should report blocked storage without throwing");
failStorageWrites = false;
storage.clear();
const atomicProfile = createDefaultProfile();
atomicProfile.xp = 111;
const atomicCampaign = createDefaultCampaign();
atomicCampaign.resources.credits = 777;
assert.equal(saveGameState(atomicProfile, atomicCampaign, localStorage), true, "combined game state should commit profile and campaign in one storage write");
const committedEnvelope = localStorage.getItem(GAME_STATE_STORAGE_KEY);
assert.ok(committedEnvelope, "combined persistence should create a versioned game-state envelope");
const nextAtomicProfile = { ...atomicProfile, xp: 222 };
const nextAtomicCampaign = { ...atomicCampaign, resources: { ...atomicCampaign.resources, credits: 888 } };
failStorageWrites = true;
assert.equal(saveGameState(nextAtomicProfile, nextAtomicCampaign, localStorage), false, "failed combined persistence should report the failed transaction");
failStorageWrites = false;
assert.equal(localStorage.getItem(GAME_STATE_STORAGE_KEY), committedEnvelope, "a failed transaction must leave the previous committed envelope byte-for-byte intact");
const reloadedAtomic = loadGameState(localStorage);
assert.equal(reloadedAtomic.profile.xp, 111, "failed persistence must not expose the newer profile without its matching campaign");
assert.equal(reloadedAtomic.campaign.resources.credits, 777, "failed persistence must not expose the newer campaign without its matching profile");
storage.clear();
const legacyProfile = createDefaultProfile();
legacyProfile.xp = 63;
const legacyAtomicCampaign = createDefaultCampaign();
legacyAtomicCampaign.resources.credits = 432;
assert.equal(saveProfile(legacyProfile), true);
assert.equal(saveCampaign(legacyAtomicCampaign), true);
const migratedAtomic = loadGameState(localStorage);
assert.equal(migratedAtomic.profile.xp, 63, "combined persistence should migrate from the existing profile key when no envelope exists");
assert.equal(migratedAtomic.campaign.resources.credits, 432, "combined persistence should migrate from the existing campaign key when no envelope exists");
async function runSaveRecoveryRegressions() {
  storage.clear();
  const validProfileRaw = JSON.stringify(createDefaultProfile());
  localStorage.setItem(PROFILE_STORAGE_KEY, validProfileRaw);
  const validRecovery = await prepareSaveRecovery({ storage: localStorage, indexedDb: null, now: () => /* @__PURE__ */ new Date("2026-09-16T12:00:00.000Z"), id: () => "valid" });
  assert.equal(validRecovery.blocked, false, "valid saves should not block startup");
  assert.equal(validRecovery.backups.length, 0, "valid saves should not be copied into recovery storage");
  assert.equal(localStorage.getItem(PROFILE_STORAGE_KEY), validProfileRaw, "valid saves should remain untouched");
  storage.clear();
  const defaultProfile = createDefaultProfile();
  const malformedProfileRaw = JSON.stringify({
    ...defaultProfile,
    inventory: defaultProfile.inventory.map((item, index) => index === 0 ? { ...item, augments: ["future-unknown-augment"] } : item)
  });
  localStorage.setItem(PROFILE_STORAGE_KEY, malformedProfileRaw);
  const malformedProfileRecovery = await prepareSaveRecovery({ storage: localStorage, indexedDb: null, now: () => /* @__PURE__ */ new Date("2026-09-16T12:01:00.000Z"), id: () => "profile" });
  assert.equal(malformedProfileRecovery.blocked, false, "a malformed profile should start only after its raw data is backed up");
  assert.equal(localStorage.getItem(PROFILE_STORAGE_KEY), null, "unsafe profile save should be detached before the normal loader can replace it");
  const profileBackup = malformedProfileRecovery.backups.find((backup) => backup.kind === "profile");
  assert.ok(profileBackup, "malformed profile should produce a recovery backup");
  assert.equal(localStorage.getItem(profileBackup.backupKey), malformedProfileRaw, "profile recovery backup must preserve the exact original bytes");
  assert.deepEqual(loadProfile(), createDefaultProfile(), "normal profile loading should see a clean slot after quarantine");
  storage.clear();
  const incompatibleCampaignRaw = JSON.stringify({ ...createDefaultCampaign(), version: 99 });
  localStorage.setItem(CAMPAIGN_STORAGE_KEY, incompatibleCampaignRaw);
  const campaignRecovery = await prepareSaveRecovery({ storage: localStorage, indexedDb: null, now: () => /* @__PURE__ */ new Date("2026-09-16T12:02:00.000Z"), id: () => "campaign" });
  assert.equal(campaignRecovery.blocked, false, "an incompatible campaign should be quarantined before startup");
  assert.equal(localStorage.getItem(CAMPAIGN_STORAGE_KEY), null, "incompatible campaign should be detached from the primary key");
  const campaignBackup = campaignRecovery.backups.find((backup) => backup.kind === "campaign");
  assert.ok(campaignBackup, "incompatible campaign should produce a recovery backup");
  assert.equal(localStorage.getItem(campaignBackup.backupKey), incompatibleCampaignRaw, "campaign recovery backup must preserve the exact original bytes");
  assert.deepEqual(loadCampaign(), createDefaultCampaign(), "normal campaign loading should see a clean slot after quarantine");
  storage.clear();
  const incompatibleStateRaw = JSON.stringify({ version: 1, profile: createDefaultProfile(), campaign: { ...createDefaultCampaign(), version: 99 }, savedAt: "2026-09-16T12:02:30.000Z" });
  localStorage.setItem(GAME_STATE_STORAGE_KEY, incompatibleStateRaw);
  const stateRecovery = await prepareSaveRecovery({ storage: localStorage, indexedDb: null, now: () => /* @__PURE__ */ new Date("2026-09-16T12:02:30.000Z"), id: () => "state" });
  assert.equal(stateRecovery.blocked, false, "an incompatible combined state should be quarantined before startup");
  assert.equal(localStorage.getItem(GAME_STATE_STORAGE_KEY), null, "unsafe combined state should be detached before the game loader can use it");
  const stateBackup = stateRecovery.backups.find((backup) => backup.kind === "state");
  assert.ok(stateBackup, "invalid combined state should produce a recovery backup");
  assert.equal(localStorage.getItem(stateBackup.backupKey), incompatibleStateRaw, "combined state recovery must preserve the exact original bytes");
  storage.clear();
  const unreadableRaw = "{bad-profile-json";
  localStorage.setItem(PROFILE_STORAGE_KEY, unreadableRaw);
  failBackupWrites = true;
  const blockedRecovery = await prepareSaveRecovery({ storage: localStorage, indexedDb: null, now: () => /* @__PURE__ */ new Date("2026-09-16T12:03:00.000Z"), id: () => "blocked" });
  failBackupWrites = false;
  assert.equal(blockedRecovery.blocked, true, "startup must stop if an unreadable save cannot be backed up");
  assert.equal(localStorage.getItem(PROFILE_STORAGE_KEY), unreadableRaw, "failed backup must leave the original save untouched");
  assert.equal(blockedRecovery.backups.length, 0, "a failed copy must never be reported as a verified backup");
  return malformedProfileRecovery.backups.length + campaignRecovery.backups.length + stateRecovery.backups.length;
}
runSaveRecoveryRegressions().then((saveRecoveryCount) => console.log(`GAMEPLAY_REGRESSIONS_PASS credits=${campaign.resources.credits} med=${campaign.consumables.medGel} hp=${deathState.player.hp} aim=${aimState.player.aim.x.toFixed(3)} expeditionLoot=${expeditionLootCarry.length} saveRecovery=${saveRecoveryCount} transactional=1`)).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
