import { protocolAimPenalty, protocolAnchorsEnemy, protocolCarriesObjective, protocolIgnoresPressureRetreat, protocolMobilityScale, protocolRewardForEnemy, protocolVacuumImmune, stepEnemyProtocols } from './eliteProtocolRuntime';
import type { EnemyCombatClass, EnemyProtocolInstance } from './eliteProtocols';
import { mutationFireCadenceScale, mutationHazardCadenceScale, mutationMobilityScale, type HighTierMutationId } from './t9Mutations';
import { bossPhaseFireCadenceScale, bossPhasePulseDefinitions, type BossPhaseMutationId } from './bossPhaseMutations';
import { commandTargetFireCadenceScale, commandTargetMutationDefinition, commandTargetPulseDefinitions, type CommandTargetMutationId } from './commandTargetMutations';
import type { ConsumableId } from './consumables';
import { lootFeedLabel, rollGroundLoot, type GroundLootDrop, type GroundLootReceipt } from './fieldLoot';
import { getAbilityKitForClass, operatorWeaponFamilyForClass, type OperatorClassId } from './classSkills';
import { weaponVariantDefinition, type WeaponVariantId } from './classArsenal';
export { abilityMeta, classAbilityKits, getAbilityKitForClass } from './classSkills';
export type { AbilityMeta, OperatorClassId } from './classSkills';

export type Vec2 = { x: number; y: number };
export type PressureState = 'normal' | 'leaking' | 'decompressing' | 'vacuum';
export type WeaponId = 'carbine' | 'breacher' | 'rail';
export type SpecializationId = 'pressure-diver' | 'momentum-broker' | 'grid-weaver' | 'survey-deadeye' | 'redline-pilot' | 'breach-vanguard' | 'bulkhead-warden' | 'capacitor-conductor' | 'thermal-shunter';
export type EnemyRole = 'assault' | 'suppressor' | 'technician' | 'elite' | 'boss';
export type EnemyVariant = 'standard' | 'vectorSkirmisher' | 'anchorEngineer' | 'barricadeTrooper' | 'pressureLockTech' | 'tetherRigger' | 'maintenanceDrone' | 'gravityDrone' | 'shieldBoarder' | 'tetherOperator' | 'droneCarrier' | 'coverBreacher' | 'marksman' | 'vacuumSaboteur' | 'repairDrone' | 'gravitySpecialist' | 'meleeExosuit' | 'salvageThief' | 'impulseRigger' | 'boiloffTech' | 'partitionRigger' | 'recoilBroker' | 'siphonTech' | 'purgeOrchestrator' | 'custodyPorter' | 'geometryTech' | 'orison' | 'foundryMarshal' | 'meridianCommander' | 'salvageCaptain' | 'yardmind' | 'pressureBroker' | 'bondArbiter' | 'forgeChorus' | 'cascadeCustodian' | 'perseidSteward' | 'orphelineWarden' | 'hecateYardmaster' | 'latticeCustodian' | 'transferAdjudicator' | 'umbraMarshal' | 'custodyDirector' | 'parallaxSkirmisher' | 'referenceTech' | 'baselineMarksman' | 'baselineKeeper';
export type SingularTraitId = 'vacuumWake' | 'atlasDodgeCap' | 'redlineVelocity' | 'relayCrown' | 'palisadeDoctrine' | 'pressureMantle' | 'lockstepArc' | 'rheaBackblast' | 'tetherhand' | 'scraplineDodge' | 'thermalGovernor' | 'machineSight' | 'sunwardFracture' | 'arcspindle' | 'ghostline' | 'borecutter' | 'stormVentgun' | 'nullpoint' | 'glasswalker' | 'cryostack' | 'salvageDynamo' | 'deadreckon' | 'stormskin' | 'axisGhost' | 'pendulumBreach' | 'massTap' | 'boiloffSink' | 'cryolineRail' | 'inertiaSpool' | 'clutchstep' | 'recoilLedger' | 'coldStartBreach' | 'purgeWake' | 'gridReclaimer' | 'custodyShear' | 'shutterLine' | 'archiveRelay' | 'pressureReservoir' | 'recoilDynamo' | 'relayOrchard' | 'coldWitness' | 'redlineBulwark' | 'closeBreach' | 'abilityRosary' | 'pressureBallistics' | 'momentumMark' | 'scrapCircuit' | 'boiloffDash' | 'splitReference' | 'forkedSpool' | 'breachEcho' | 'railDoublet' | 'magBloom' | 'markCascade';
export type Material = 'light' | 'industrial' | 'bulkhead' | 'system';
export type ImpactEvent =
  | { serial: number; target: 'enemy'; surface: 'armor' | 'steel' | 'field'; heavy: boolean }
  | { serial: number; target: 'object'; material: Material; objectKind: CombatObject['kind']; heavy: boolean };
type ImpactEventInput =
  | Omit<Extract<ImpactEvent, { target: 'enemy' }>, 'serial'>
  | Omit<Extract<ImpactEvent, { target: 'object' }>, 'serial'>;

type Rect = { x: number; y: number; w: number; h: number };
type StatusTimers = { armorBreach: number; disrupted: number; marked: number; stagger: number; conductive: number; vacuum: number };

export type Sector = Rect & { id: string; label: string; pressure: number; pressureState: PressureState; gravity: number; rapidTimer: number; targetPressure: number };
export type CombatObject = Rect & { id: string; label: string; kind: 'cover' | 'conduit' | 'coolant' | 'breachPlate' | 'doorControl' | 'gravityControl' | 'sealControl' | 'powerControl' | 'salvageNode' | 'anchorNode'; material: Material; hp: number; maxHp: number; destructible: boolean; active: boolean; exposed: boolean };
export type PressureLink = { id: string; a: string; b: string; open: boolean; conductance: number };
export type Breach = { id: string; sectorId: string; x: number; y: number; active: boolean; sealed: boolean; strength: number; radius: number; boss: boolean };
export type Projectile = { active: boolean; x: number; y: number; vx: number; vy: number; radius: number; damage: number; life: number; owner: 'player' | 'enemy'; weapon: WeaponId | 'enemy'; penetration: number; armorDamage: number; healthMultiplier: number; knockback: number; lastObjectId: string | null; lastObjectT: number };
export type Enemy = { id: number; role: EnemyRole; variant: EnemyVariant; combatClass: EnemyCombatClass; protocols: EnemyProtocolInstance[]; mutations: HighTierMutationId[]; commandTargetMutations: CommandTargetMutationId[]; commandMutationCooldown: number; bossPhaseMutations: BossPhaseMutationId[]; bossMutationCooldown: number; protocolPulse: number; label: string; x: number; y: number; vx: number; vy: number; hp: number; maxHp: number; armor: number; maxArmor: number; effectiveness: number; fireCooldown: number; telegraph: number; telegraphAim: Vec2; strafeSign: number; dead: boolean; deathT: number; active: boolean; state: 'hold' | 'advance' | 'retreat' | 'cover' | 'attack'; hazardCooldown: number; burst: number; carriedObjectId: string | null; statuses: StatusTimers; bossPhase: 1 | 2; bossPattern: 'none' | 'coilFan' | 'massPulse' | 'craneLock' | 'forgeSweep' | 'gravityFlip' | 'anchorCast' | 'barricadeCommand' | 'pressureLock' | 'armorVolley' | 'tetherCast' | 'backblastRush' | 'scrapFan' | 'droneCommand' | 'doorCycle' | 'gravityOverride' | 'pressureCascade' | 'shutterDebt' | 'latticePulse' | 'certifiedVolley' | 'seizureWall' | 'auditPulse' | 'machineChoir' | 'phaseFork' | 'thermalCascade' | 'surveySweep' | 'referenceLock' | 'archivePurge' | 'brakeWave' | 'partitionSweep' | 'recoilVector' | 'purgeLance' | 'busSiphon' | 'busReroute' | 'shutterGeometry' | 'referenceVolley' | 'relayRecall' | 'parallaxSweep' | 'baselineFork' | 'shearCollapse'; patternIndex: number; anchored: boolean };
export type Player = { x: number; y: number; vx: number; vy: number; aim: Vec2; move: Vec2; hp: number; maxHp: number; armor: number; maxArmor: number; capacitor: number; maxCapacitor: number; fireCooldown: number; abilityCooldowns: [number, number, number]; dodgeCooldown: number; dodgeTime: number; lastDodgeAt: number; invulnerable: number; consumableCooldown: number; weaponHeat: Record<WeaponId, number>; mags: Record<WeaponId, number>; reloadT: number; reloadWeapon: WeaponId; ventT: number; dead: boolean; currentWeapon: WeaponId; vacuumExposure: number; disrupted: number };
export type Hazard = { active: boolean; x: number; y: number; radius: number; life: number; kind: 'shockGrid' | 'gravityWell' | 'coolantJet' | 'vacuumWake' | 'vectorWash' | 'boiloffJet'; owner: 'enemy' | 'environment' | 'player' };
export type Debris = { active: boolean; x: number; y: number; vx: number; vy: number; radius: number; sectorId: string };
export type Effect = { active: boolean; x: number; y: number; kind: 'pulse' | 'arc' | 'impact' | 'breach' | 'mark' | 'vanguard' | 'vector' | 'systems'; life: number; maxLife: number; radius: number };
export type DamageNumber = { active: boolean; serial: number; x: number; y: number; value: number; kind: 'armor' | 'health' | 'heavy'; life: number; maxLife: number };
export type RunTracePoint = { t: number; x: number; y: number; hp: number; armor: number; weapon: WeaponId };
export type Telemetry = { damageDealt: number; damageTaken: number; deaths: number; kills: number; eliteKills: number; eliteProtocolsDefeated: number; killIntervalTotal: number; killIntervalSamples: number; lastKillAt: number; protocolCombinations: Record<string, number>; weaponShots: Record<WeaponId, number>; abilityUses: [number, number, number]; encounterStart: number; bossStart: number; duration: number; trace: RunTracePoint[]; nextTraceAt: number };
export type ClassRuntimeState = { vanguardGuard: number; vectorWindow: number; systemsLinks: number; systemsCrossfeed: number };
export type SimState = { time: number; build: CombatBuild; weapons: Record<WeaponId, WeaponConfig>; droneTick: number; lastAbilityIndex: number; lastAbilityAt: number; abilityChain: number; classState: ClassRuntimeState; bossGateHold: boolean; operationTier: number; monsterLevel: number; maxRecoveryLevel: number; monsterDamageScale: number; groundLoot: GroundLootDrop[]; collectedLoot: GroundLootReceipt[]; player: Player; enemies: Enemy[]; projectiles: Projectile[]; objects: CombatObject[]; sectors: Sector[]; links: PressureLink[]; breaches: Breach[]; hazards: Hazard[]; debris: Debris[]; effects: Effect[]; damageNumbers: DamageNumber[]; damageNumberSerial: number; impactEvent: ImpactEvent | null; impactSerial: number; complete: boolean; bossActive: boolean; bossDefeated: boolean; pulse: number; weaponFlash: number; kills: number; squadSuppressing: boolean; eventText: string; eventT: number; telemetry: Telemetry };
export type WeaponConfig = { id: WeaponId; name: string; shortName: string; variantId: WeaponVariantId | null; roundsPerTrigger: number; damage: number; rate: number; projectileSpeed: number; penetration: number; recoil: number; spread: number; heatPerShot: number; heatDissipation: number; magazine: number; reloadSeconds: number; armorDamage: number; healthMultiplier: number; knockback: number; pellets: number; capacitorCost: number };
export type ClassSkillFamilyBuild = {
  family: WeaponId | null;
  frameGeneration: number;
  frameIdentity: string | null;
  weaponVariant: WeaponVariantId | null;
  singularLinked: boolean;
  powerMul: number;
  rangeMul: number;
  controlMul: number;
  armorMul: number;
  recoveryMul: number;
  costMul: number;
  chainBonus: number;
  sources: string[];
};
export type WeaponHandlingProfile = {
  stance: 'mobile' | 'breach' | 'precision';
  reloadStyle: 'mag-swap' | 'chamber-feed' | 'coil-index';
  ventStyle: 'fan-purge' | 'chamber-dump' | 'coil-quench';
  recoilImpulseMul: number;
  recoilVisual: number;
  shotVelocityRetention: number;
  postShotMoveScale: number;
  reloadMoveScale: number;
  ventMoveScale: number;
  reloadDurationMul: number;
  ventSeconds: number;
  cameraKick: number;
  muzzleLength: number;
  muzzleWidth: number;
  budget: { mobility: number; control: number; recovery: number; thermal: number; impact: number };
};
export const weaponHandlingProfiles: Record<WeaponId, WeaponHandlingProfile> = {
  carbine: { stance: 'mobile', reloadStyle: 'mag-swap', ventStyle: 'fan-purge', recoilImpulseMul: 0.78, recoilVisual: 0.55, shotVelocityRetention: 0.98, postShotMoveScale: 1, reloadMoveScale: 0.92, ventMoveScale: 0.88, reloadDurationMul: 0.92, ventSeconds: 0.72, cameraKick: 0.55, muzzleLength: 1.05, muzzleWidth: 0.72, budget: { mobility: 28, control: 25, recovery: 22, thermal: 17, impact: 8 } },
  breacher: { stance: 'breach', reloadStyle: 'chamber-feed', ventStyle: 'chamber-dump', recoilImpulseMul: 1.08, recoilVisual: 1.15, shotVelocityRetention: 0.9, postShotMoveScale: 0.86, reloadMoveScale: 0.76, ventMoveScale: 0.68, reloadDurationMul: 1.05, ventSeconds: 0.98, cameraKick: 2.35, muzzleLength: 1.55, muzzleWidth: 1.35, budget: { mobility: 15, control: 10, recovery: 16, thermal: 19, impact: 40 } },
  rail: { stance: 'precision', reloadStyle: 'coil-index', ventStyle: 'coil-quench', recoilImpulseMul: 0.82, recoilVisual: 1.4, shotVelocityRetention: 0.58, postShotMoveScale: 0.68, reloadMoveScale: 0.62, ventMoveScale: 0.54, reloadDurationMul: 1.12, ventSeconds: 1.18, cameraKick: 3.2, muzzleLength: 2.3, muzzleWidth: 0.48, budget: { mobility: 8, control: 34, recovery: 10, thermal: 18, impact: 30 } },
};
export type CombatBuild = { operatorClass: OperatorClassId | null; classResonanceTier: 0 | 1 | 2; classSkillFamily: ClassSkillFamilyBuild; attackSpeedMul: number; weapon: Record<WeaponId, { damageMul: number; speedMul: number; penetrationAdd: number; recoilMul: number; heatPerShotMul: number; heatDissipationMul: number; magazineAdd: number; reloadMul: number; armorDamageMul: number; healthMultiplierMul: number; knockbackMul: number }>; player: { maxHpAdd: number; maxArmorAdd: number; maxCapAdd: number; moveSpeedMul: number; capRegenMul: number; vacuumResistance: number; lowGControl: number; ventSpeedMul: number }; mechanics: { railFragment: boolean; railFragmentScale: number; dodgeVent: boolean; dodgeVentScale: number; magRedirect: boolean; magRedirectScale: number; breacherPropulsion: boolean; breacherPropulsionScale: number; markWeakArmor: boolean; markWeakArmorScale: number; arcDrone: boolean; arcDroneScale: number; recoilVectoring: boolean; breachDoctrine: boolean; sensorPenetration: boolean; widebandMark: boolean; magOverdriveKick: boolean; arcGroundLoop: boolean; magBoundarySink: boolean; markExecutionTrace: boolean; arcCascadeLattice: boolean; vanguardSiegeRam: boolean; vanguardFaultlineTag: boolean; vanguardReprisalPulse: boolean; vectorSlingshotShift: boolean; vectorTriangulationLock: boolean; vectorNeedleFan: boolean; systemsAnchorLattice: boolean; systemsRecursiveIntrusion: boolean; systemsReturnCurrent: boolean }; singularTraits: SingularTraitId[]; specialization: SpecializationId | null; specializationOverclock: boolean; abilities: [{ costMul: number; cooldownMul: number; powerMul: number }, { costMul: number; cooldownMul: number; powerMul: number }, { costMul: number; cooldownMul: number; powerMul: number }] };

export const weaponConfigs: Record<WeaponId, WeaponConfig> = {
  carbine: { id: 'carbine', name: 'Vektor M-7 Coil Carbine', shortName: 'M-7 CARBINE', variantId: null, roundsPerTrigger: 1, damage: 13.5, rate: 7.8, projectileSpeed: 860, penetration: 20, recoil: 38, spread: 0.018, heatPerShot: 0.058, heatDissipation: 0.23, magazine: 30, reloadSeconds: 1.35, armorDamage: 0.72, healthMultiplier: 1, knockback: 0.055, pellets: 1, capacitorCost: 0 },
  breacher: { id: 'breacher', name: 'Kestrel B-4 Breach Scattergun', shortName: 'B-4 BREACHER', variantId: null, roundsPerTrigger: 1, damage: 8.25, rate: 1.25, projectileSpeed: 560, penetration: 8, recoil: 112, spread: 0.16, heatPerShot: 0.17, heatDissipation: 0.2, magazine: 6, reloadSeconds: 1.85, armorDamage: 0.34, healthMultiplier: 1.45, knockback: 0.11, pellets: 7, capacitorCost: 0 },
  rail: { id: 'rail', name: 'Helix R-2 Rail Lance', shortName: 'R-2 RAIL LANCE', variantId: null, roundsPerTrigger: 1, damage: 36, rate: 0.82, projectileSpeed: 1380, penetration: 115, recoil: 168, spread: 0.004, heatPerShot: 0.28, heatDissipation: 0.16, magazine: 5, reloadSeconds: 2.1, armorDamage: 1.75, healthMultiplier: 0.92, knockback: 0.12, pellets: 1, capacitorCost: 10 },
};
export function getAbilityKit(state: Pick<SimState, 'build'>) { return getAbilityKitForClass(state.build.operatorClass); }

export const neutralCombatBuild: CombatBuild = { operatorClass: null, classResonanceTier: 0, classSkillFamily: { family: null, frameGeneration: 1, frameIdentity: null, weaponVariant: null, singularLinked: false, powerMul: 1, rangeMul: 1, controlMul: 1, armorMul: 1, recoveryMul: 1, costMul: 1, chainBonus: 0, sources: [] }, attackSpeedMul: 1, weapon: { carbine: { damageMul: 1, speedMul: 1, penetrationAdd: 0, recoilMul: 1, heatPerShotMul: 1, heatDissipationMul: 1, magazineAdd: 0, reloadMul: 1, armorDamageMul: 1, healthMultiplierMul: 1, knockbackMul: 1 }, breacher: { damageMul: 1, speedMul: 1, penetrationAdd: 0, recoilMul: 1, heatPerShotMul: 1, heatDissipationMul: 1, magazineAdd: 0, reloadMul: 1, armorDamageMul: 1, healthMultiplierMul: 1, knockbackMul: 1 }, rail: { damageMul: 1, speedMul: 1, penetrationAdd: 0, recoilMul: 1, heatPerShotMul: 1, heatDissipationMul: 1, magazineAdd: 0, reloadMul: 1, armorDamageMul: 1, healthMultiplierMul: 1, knockbackMul: 1 } }, player: { maxHpAdd: 0, maxArmorAdd: 0, maxCapAdd: 0, moveSpeedMul: 1, capRegenMul: 1, vacuumResistance: 0, lowGControl: 0, ventSpeedMul: 1 }, mechanics: { railFragment: false, railFragmentScale: 0, dodgeVent: false, dodgeVentScale: 0, magRedirect: false, magRedirectScale: 0, breacherPropulsion: false, breacherPropulsionScale: 0, markWeakArmor: false, markWeakArmorScale: 0, arcDrone: false, arcDroneScale: 0, recoilVectoring: false, breachDoctrine: false, sensorPenetration: false, widebandMark: false, magOverdriveKick: false, arcGroundLoop: false, magBoundarySink: false, markExecutionTrace: false, arcCascadeLattice: false, vanguardSiegeRam: false, vanguardFaultlineTag: false, vanguardReprisalPulse: false, vectorSlingshotShift: false, vectorTriangulationLock: false, vectorNeedleFan: false, systemsAnchorLattice: false, systemsRecursiveIntrusion: false, systemsReturnCurrent: false }, singularTraits: [], specialization: null, specializationOverclock: false, abilities: [{ costMul: 1, cooldownMul: 1, powerMul: 1 }, { costMul: 1, cooldownMul: 1, powerMul: 1 }, { costMul: 1, cooldownMul: 1, powerMul: 1 }] };
function resolveWeaponConfig(build: CombatBuild, id: WeaponId): WeaponConfig {
  const base = weaponConfigs[id];
  const requestedVariant = build.classSkillFamily.family === id && build.classSkillFamily.weaponVariant
    ? weaponVariantDefinition(build.classSkillFamily.weaponVariant)
    : null;
  const variant = requestedVariant?.family === id ? requestedVariant : null;
  const authoredBase: WeaponConfig = variant
    ? { ...base, ...variant.stats, name: variant.name, shortName: variant.shortName, variantId: variant.id }
    : base;
  const mod = build.weapon[id];
  return { ...authoredBase, rate: authoredBase.rate * build.attackSpeedMul, damage: authoredBase.damage * mod.damageMul, projectileSpeed: authoredBase.projectileSpeed * mod.speedMul, penetration: authoredBase.penetration + mod.penetrationAdd, recoil: authoredBase.recoil * mod.recoilMul, heatPerShot: authoredBase.heatPerShot * mod.heatPerShotMul, heatDissipation: authoredBase.heatDissipation * mod.heatDissipationMul, magazine: Math.max(1, Math.round(authoredBase.magazine + mod.magazineAdd)), reloadSeconds: authoredBase.reloadSeconds * mod.reloadMul, armorDamage: authoredBase.armorDamage * mod.armorDamageMul, healthMultiplier: authoredBase.healthMultiplier * mod.healthMultiplierMul, knockback: authoredBase.knockback * mod.knockbackMul };
}
export function getWeaponConfig(state: SimState, id: WeaponId) { return state.weapons[id]; }
export function getAbilityConfig(state: SimState, index: number) {
  const kit = getAbilityKit(state);
  const base = kit[index] ?? kit[0];
  const tuning = state.build.abilities[index] ?? state.build.abilities[0];
  const family = state.build.classSkillFamily;
  const familyBound = !!base.weaponFamily && base.weaponFamily === family.family;
  return {
    ...base,
    cost: Math.round(base.cost * tuning.costMul * (familyBound ? family.costMul : 1)),
    cooldown: base.cooldown * tuning.cooldownMul / (familyBound ? family.recoveryMul : 1),
    power: tuning.powerMul * (familyBound ? family.powerMul : 1),
    range: familyBound ? family.rangeMul : 1,
    control: familyBound ? family.controlMul : 1,
    armor: familyBound ? family.armorMul : 1,
    chainBonus: familyBound ? family.chainBonus : 0,
    familyBound,
  };
}

const world = { w: 2320, h: 1040 };
const playerRadius = 22;
const enemyRadius = 21;
let seed = 0x5f3759df;
function rand() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }
function len(v: Vec2) { return Math.hypot(v.x, v.y); }
function norm(v: Vec2): Vec2 { const l = len(v); return l > 0.0001 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 }; }
function rotateAimToward(current: Vec2, desired: Vec2, maxRadians: number): Vec2 {
  const target = norm(desired);
  if (len(target) < 0.1) return current;
  const currentAngle = Math.atan2(current.y, current.x);
  const targetAngle = Math.atan2(target.y, target.x);
  const delta = Math.atan2(Math.sin(targetAngle - currentAngle), Math.cos(targetAngle - currentAngle));
  if (Math.abs(delta) <= maxRadians) return target;
  const next = currentAngle + Math.sign(delta) * maxRadians;
  return { x: Math.cos(next), y: Math.sin(next) };
}
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function pointInRect(x: number, y: number, r: Rect) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
function distanceToRect(x: number, y: number, r: Rect) { const cx = clamp(x, r.x, r.x + r.w); const cy = clamp(y, r.y, r.y + r.h); return Math.hypot(x - cx, y - cy); }

function resolveCircleRect(body: { x: number; y: number; vx: number; vy: number }, radius: number, r: Rect) {
  const cx = clamp(body.x, r.x, r.x + r.w);
  const cy = clamp(body.y, r.y, r.y + r.h);
  const dx = body.x - cx;
  const dy = body.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return;

  let nx = 0;
  let ny = 0;
  if (d2 < 0.0001) {
    const left = Math.abs(body.x - r.x);
    const right = Math.abs(r.x + r.w - body.x);
    const top = Math.abs(body.y - r.y);
    const bottom = Math.abs(r.y + r.h - body.y);
    const nearest = Math.min(left, right, top, bottom);
    if (nearest === left) { body.x = r.x - radius; nx = -1; }
    else if (nearest === right) { body.x = r.x + r.w + radius; nx = 1; }
    else if (nearest === top) { body.y = r.y - radius; ny = -1; }
    else { body.y = r.y + r.h + radius; ny = 1; }
  } else {
    const distance = Math.sqrt(d2);
    nx = dx / distance;
    ny = dy / distance;
    const push = radius - distance;
    body.x += nx * push;
    body.y += ny * push;
  }

  const inwardSpeed = body.vx * nx + body.vy * ny;
  if (inwardSpeed < 0) {
    body.vx -= nx * inwardSpeed;
    body.vy -= ny * inwardSpeed;
  }
}

function currentSector(state: SimState, x: number, y: number) { return state.sectors.find(s => pointInRect(x, y, s)) ?? state.sectors[0]; }
function isSolidObject(object: CombatObject) { return object.active && (object.kind === 'cover' || object.kind === 'conduit' || object.kind === 'coolant' || object.kind === 'breachPlate' || object.kind === 'anchorNode'); }
function clearLine(state: SimState, ax: number, ay: number, bx: number, by: number) {
  for (let i = 1; i < 20; i += 1) { const t = i / 20; const x = ax + (bx - ax) * t; const y = ay + (by - ay) * t; if (state.objects.some(object => isSolidObject(object) && pointInRect(x, y, object))) return false; }
  return true;
}

export type TargetingIntent = 'manual' | 'acquire';
export type TargetAcquisitionRequest = {
  maxDistance: number;
  projectileSpeed?: number;
  maxAngleScore?: number;
  aimWeight?: number;
  rangeWeight?: number;
  visibilityPenalty?: number;
  threatWeight?: number;
  markWeight?: number;
  bossWeight?: number;
  protocolWeight?: number;
  leadScale?: number;
  maxLeadSeconds?: number;
};
export type TargetAcquisitionResult = {
  enemy: Enemy;
  direction: Vec2;
  distance: number;
  visible: boolean;
  angleScore: number;
  score: number;
};

export type TargetControlMemory = {
  targetId: number | null;
  lastVisibleAt: number;
  acquiredAt: number;
};

export function createTargetControlMemory(): TargetControlMemory {
  return { targetId: null, lastVisibleAt: Number.NEGATIVE_INFINITY, acquiredAt: Number.NEGATIVE_INFINITY };
}

export function resetTargetControlMemory(memory: TargetControlMemory) {
  memory.targetId = null;
  memory.lastVisibleAt = Number.NEGATIVE_INFINITY;
  memory.acquiredAt = Number.NEGATIVE_INFINITY;
}

function evaluateCombatTarget(state: SimState, enemy: Enemy, request: TargetAcquisitionRequest): TargetAcquisitionResult | null {
  if (!enemy.active || enemy.dead) return null;
  const p = state.player;
  const delta = { x: enemy.x - p.x, y: enemy.y - p.y };
  const distance = len(delta);
  if (distance < 1 || distance > request.maxDistance) return null;

  const rawDirection = norm(delta);
  const angleScore = 1 - (rawDirection.x * p.aim.x + rawDirection.y * p.aim.y);
  if (request.maxAngleScore != null && angleScore > request.maxAngleScore) return null;

  const visible = clearLine(state, p.x, p.y, enemy.x, enemy.y);
  const projectileSpeed = request.projectileSpeed ?? 0;
  const leadScale = request.leadScale ?? 0.72;
  const maxLeadSeconds = request.maxLeadSeconds ?? 0.38;
  const leadSeconds = projectileSpeed > 0 ? Math.min(maxLeadSeconds, distance / Math.max(1, projectileSpeed) * leadScale) : 0;
  const direction = norm({
    x: enemy.x + enemy.vx * leadSeconds - p.x,
    y: enemy.y + enemy.vy * leadSeconds - p.y,
  });

  const aimWeight = request.aimWeight ?? 0.42;
  const rangeWeight = request.rangeWeight ?? 0.28;
  const visibilityPenalty = request.visibilityPenalty ?? 0.7;
  const threatWeight = request.threatWeight ?? 1;
  const markWeight = request.markWeight ?? 1;
  const bossWeight = request.bossWeight ?? 1;
  const protocolWeight = request.protocolWeight ?? 1;

  let score = angleScore * aimWeight + (distance / request.maxDistance) * rangeWeight;
  if (!visible) score += visibilityPenalty;
  if (enemy.telegraph > 0) score -= 0.2 * threatWeight;
  if (enemy.role === 'assault' && distance < 380) score -= 0.16 * threatWeight;
  if (enemy.role === 'suppressor' && state.squadSuppressing) score -= 0.08 * threatWeight;
  if (enemy.role === 'technician' && enemy.hazardCooldown < 1.2) score -= 0.05 * threatWeight;
  if (enemy.statuses.marked > 0) score -= 0.1 * markWeight;
  if (state.bossActive && enemy.role === 'boss') score -= 0.16 * bossWeight;
  score += protocolAimPenalty(enemy) * protocolWeight;

  return { enemy, direction, distance, visible, angleScore, score };
}

function targetCandidatePrecedes(candidate: TargetAcquisitionResult, best: TargetAcquisitionResult) {
  const scoreDelta = candidate.score - best.score;
  if (Math.abs(scoreDelta) > 1e-9) return scoreDelta < 0;
  if (candidate.visible !== best.visible) return candidate.visible;
  const distanceDelta = candidate.distance - best.distance;
  if (Math.abs(distanceDelta) > 1e-9) return distanceDelta < 0;
  return candidate.enemy.id < best.enemy.id;
}

export function acquireCombatTarget(state: SimState, request: TargetAcquisitionRequest): TargetAcquisitionResult | null {
  let best: TargetAcquisitionResult | null = null;
  for (const enemy of state.enemies) {
    const candidate = evaluateCombatTarget(state, enemy, request);
    if (!candidate) continue;
    if (!best || targetCandidatePrecedes(candidate, best)) best = candidate;
  }
  return best;
}

function acquirePreferredCombatTarget(state: SimState, request: TargetAcquisitionRequest, preferredTargetId: number | null) {
  if (preferredTargetId != null) {
    const preferred = state.enemies.find(enemy => enemy.id === preferredTargetId) ?? null;
    const scored = preferred ? evaluateCombatTarget(state, preferred, request) : null;
    if (scored) return scored;
  }
  return acquireCombatTarget(state, request);
}

function focusAcquiredTarget(state: SimState, target: TargetAcquisitionResult | null) {
  if (!target) return null;
  state.player.aim = target.direction;
  return target.enemy;
}

function weaponAcquisitionRange(weapon: WeaponId) {
  if (weapon === 'breacher') return 680;
  if (weapon === 'rail') return 980;
  return 860;
}
function blankStatuses(): StatusTimers { return { armorBreach: 0, disrupted: 0, marked: 0, stagger: 0, conductive: 0, vacuum: 0 }; }
function staggerDuration(enemy: Enemy, duration: number) { return duration / Math.max(1, enemy.effectiveness); }
function spawnEffect(state: SimState, x: number, y: number, kind: Effect['kind'], radius: number, life = 0.45) { const effect = state.effects.find(item => !item.active); if (!effect) return; Object.assign(effect, { active: true, x, y, kind, radius, life, maxLife: life }); }
function spawnCapstoneEffect(state: SimState, operatorClass: 'vanguard' | 'vector' | 'systems', x: number, y: number, radius = 150, life = 0.62) { spawnEffect(state, x, y, operatorClass, radius, life); }
function spawnDamageNumber(state: SimState, enemy: Enemy, value: number, kind: DamageNumber['kind']) {
  if (value < 1) return;
  const slot = state.damageNumbers.find(item => !item.active) ?? state.damageNumbers.reduce((oldest, item) => item.life < oldest.life ? item : oldest, state.damageNumbers[0]);
  if (!slot) return;
  const serial = ++state.damageNumberSerial;
  const jitter = ((serial * 37) % 23) - 11;
  Object.assign(slot, { active: true, serial, x: enemy.x + jitter, y: enemy.y, value, kind, life: 0.78, maxLife: 0.78 });
}
function pushEvent(state: SimState, text: string, duration = 2.2) { state.eventText = text; state.eventT = duration; }
function hasTrait(state: SimState, trait: SingularTraitId) { return state.build.singularTraits.includes(trait); }

function addProjectile(state: SimState, x: number, y: number, dir: Vec2, speed: number, damage: number, owner: 'player' | 'enemy', options?: { weapon?: WeaponId | 'enemy'; penetration?: number; armorDamage?: number; healthMultiplier?: number; knockback?: number; radius?: number }) {
  const p = state.projectiles.find(item => !item.active); if (!p) return;
  p.active = true; p.x = x; p.y = y; p.vx = dir.x * speed; p.vy = dir.y * speed; p.radius = options?.radius ?? (owner === 'player' ? 4 : 6); p.damage = damage; p.life = owner === 'player' ? 2 : 2.8; p.owner = owner; p.weapon = options?.weapon ?? (owner === 'player' ? 'carbine' : 'enemy'); p.penetration = options?.penetration ?? 0; p.armorDamage = options?.armorDamage ?? 0.6; p.healthMultiplier = options?.healthMultiplier ?? 1; p.knockback = options?.knockback ?? 0.05; p.lastObjectId = null; p.lastObjectT = 0;
}

export function applyPlayerDamage(state: SimState, amount: number, armorPierce = 0) {
  const p = state.player; if (p.invulnerable > 0 || p.dead || amount <= 0) return;
  const wasCritical = p.hp <= 1;
  const bypass = clamp(armorPierce, 0, 1);
  const directHealthDamage = amount * bypass;
  const vanguardGuardActive = state.build.operatorClass === 'vanguard' && state.classState.vanguardGuard > 0;
  const vanguardGuardScale = vanguardGuardActive ? (state.build.classResonanceTier >= 2 ? 0.74 : state.build.classResonanceTier >= 1 ? 0.82 : 0.88) : 1;
  const bulkheadWardenScale = vanguardGuardActive && state.build.specialization === 'bulkhead-warden' ? 0.8 : 1;
  const rawBlockableDamage = Math.max(0, amount - directHealthDamage);
  const blockableDamage = rawBlockableDamage * vanguardGuardScale * bulkheadWardenScale;
  const armorTake = Math.min(p.armor, blockableDamage);
  p.armor -= armorTake;
  const healthDamage = directHealthDamage + Math.max(0, blockableDamage - armorTake);
  const appliedHealthDamage = Math.min(p.hp, Math.max(0, healthDamage));
  p.hp = Math.max(0, p.hp - appliedHealthDamage);
  state.telemetry.damageTaken += armorTake + appliedHealthDamage;
  if (vanguardGuardActive && state.build.specialization === 'bulkhead-warden') {
    const recycledImpact = Math.max(0, rawBlockableDamage - blockableDamage);
    p.abilityCooldowns[2] = Math.max(0, p.abilityCooldowns[2] - Math.min(0.9, recycledImpact * 0.06));
    if (state.build.specializationOverclock && recycledImpact > 0) p.capacitor = Math.min(p.maxCapacitor, p.capacitor + Math.min(7, recycledImpact * 0.55));
  }
  if (p.hp <= 0 || wasCritical) { p.hp = 0; p.dead = true; p.vx *= 0.25; p.vy *= 0.25; state.telemetry.deaths += 1; }
}

function dropCarriedObjective(state: SimState, enemy: Enemy, recovered = true) {
  if (!enemy.carriedObjectId) return;
  const object = state.objects.find(item => item.id === enemy.carriedObjectId);
  if (object) {
    object.active = true;
    object.x = clamp(enemy.x - object.w / 2, 120, world.w - object.w - 120);
    object.y = clamp(enemy.y - object.h / 2, 190, world.h - object.h - 120);
    object.exposed = recovered;
  }
  enemy.carriedObjectId = null;
}

function spawnGroundLoot(state: SimState, enemy: Enemy) {
  const drop = rollGroundLoot({ enemyId: enemy.id, enemyLabel: enemy.label, role: enemy.role, combatClass: enemy.combatClass, x: enemy.x, y: enemy.y, operationTier: state.operationTier, maxRecoveryLevel: state.maxRecoveryLevel, monsterLevel: state.monsterLevel, modifierCount: enemy.protocols.length, sequence: state.groundLoot.length + state.collectedLoot.length }, rand);
  if (!drop) return;
  state.groundLoot.push(drop);
  spawnEffect(state, drop.x, drop.y, drop.rarity === 'Singular' ? 'arc' : 'pulse', drop.rarity === 'Singular' ? 86 : 54, 0.6);
}

function finishEnemyDeath(state: SimState, enemy: Enemy) {
  if (enemy.dead) return;
  const markedKill = enemy.statuses.marked > 0;
  enemy.hp = 0;
  enemy.dead = true;
  enemy.deathT = 0.8;
  spawnGroundLoot(state, enemy);
  if (enemy.carriedObjectId) {
    dropCarriedObjective(state, enemy, true);
    pushEvent(state, 'STOLEN RECOVERY PACKAGE DROPPED // TAG RESTORED', 1.6);
  }
  for (const tether of state.objects) if (tether.id.startsWith('enemy-tether') && tether.label.endsWith(`#${enemy.id}`)) tether.active = false;
  if (markedKill && hasTrait(state, 'deadreckon')) state.player.abilityCooldowns[1] = Math.min(state.player.abilityCooldowns[1], 1.2);
  if (markedKill && hasTrait(state, 'markCascade')) {
    const relay = state.enemies.filter(candidate => candidate.active && !candidate.dead && candidate.id !== enemy.id && Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y) <= 430).sort((a, b) => Math.hypot(a.x - enemy.x, a.y - enemy.y) - Math.hypot(b.x - enemy.x, b.y - enemy.y))[0];
    if (relay) { relay.statuses.marked = Math.max(relay.statuses.marked, 4.2); spawnEffect(state, relay.x, relay.y, 'mark', 46, 0.5); pushEvent(state, `CASCADE SIGHT // MARK RELAYED TO ${relay.label.toUpperCase()}`, 1.4); }
  }
  if (enemy.role === 'boss') {
    state.bossDefeated = true;
    pushEvent(state, `${enemy.label.toUpperCase()} OFFLINE // COMMAND RECOVERY EJECTED`, 4);
    return;
  }
  if (enemy.role === 'elite' || enemy.combatClass === 'elite') state.telemetry.eliteKills += 1;
  state.telemetry.eliteProtocolsDefeated += protocolRewardForEnemy(enemy);
  state.telemetry.kills += 1;
  const sinceLastKill = Math.max(0, state.time - state.telemetry.lastKillAt);
  state.telemetry.killIntervalTotal += sinceLastKill;
  state.telemetry.killIntervalSamples += 1;
  state.telemetry.lastKillAt = state.time;
  if (enemy.protocols.length > 0) {
    const combination = enemy.protocols.map(protocol => `${protocol.enhanced ? '▲' : ''}${protocol.id}`).sort().join(' + ');
    state.telemetry.protocolCombinations[combination] = (state.telemetry.protocolCombinations[combination] ?? 0) + 1;
  }
  state.kills += 1;
}

function recordImpact(state: SimState, event: ImpactEventInput) {
  state.impactSerial += 1;
  state.impactEvent = { ...event, serial: state.impactSerial } as ImpactEvent;
}

function dealEnemyDamage(state: SimState, enemy: Enemy, amount: number, armorDamageFactor: number, healthMultiplier: number, sourceKnockback = 0, sourceVelocity?: Vec2, impactSource: 'ballistic' | 'field' | 'debris' = 'field') {
  if (enemy.dead || !enemy.active) return;
  const markedBonus = enemy.statuses.marked > 0 ? (state.build.mechanics.markWeakArmor ? 1.18 + 0.16 * (state.build.mechanics.markWeakArmorScale || 1) : 1.18) : 1;
  const directScale = state.build.mechanics.breachDoctrine ? 0.92 : 1;
  const foundryAnchored = enemy.variant === 'foundryMarshal' && enemy.statuses.disrupted <= 0 && state.objects.some(object => object.kind === 'anchorNode' && object.id.startsWith('foundry-anchor') && object.active && object.hp > 0);
  const latticeReferenced = enemy.variant === 'latticeCustodian' && enemy.statuses.disrupted <= 0 && state.objects.some(object => object.kind === 'anchorNode' && object.id.startsWith('lattice-reference') && object.active && object.hp > 0);
  const anchorScale = foundryAnchored ? 0.58 : latticeReferenced ? 0.64 : 1;
  let shieldScale = 1;
  if (enemy.variant === 'shieldBoarder' && enemy.armor > 0 && sourceVelocity) {
    const incomingSource = norm({ x: -sourceVelocity.x, y: -sourceVelocity.y });
    const facing = norm(enemy.telegraphAim);
    const frontal = incomingSource.x * facing.x + incomingSource.y * facing.y > 0.25;
    const penetrated = amount >= 40;
    if (frontal && !penetrated) shieldScale = 0.22;
  }
  const armorBefore = enemy.armor;
  const hpBefore = enemy.hp;
  let healthDamage = amount * 0.2 * markedBonus * directScale * anchorScale * shieldScale;
  if (enemy.armor > 0) {
    enemy.armor = Math.max(0, enemy.armor - amount * armorDamageFactor * markedBonus * anchorScale * shieldScale);
    if (enemy.armor <= 0) { enemy.statuses.armorBreach = state.build.mechanics.breachDoctrine ? 12 : 8; spawnEffect(state, enemy.x, enemy.y, 'impact', 48, 0.55); }
  } else healthDamage = amount * healthMultiplier * markedBonus * directScale * anchorScale;
  if (enemy.statuses.armorBreach > 0) healthDamage *= 1.18;
  enemy.hp -= healthDamage;
  state.telemetry.damageDealt += Math.max(0, healthDamage);
  const appliedArmorDamage = Math.max(0, armorBefore - enemy.armor);
  const appliedHealthDamage = Math.max(0, hpBefore - Math.max(0, enemy.hp));
  const displayedDamage = appliedArmorDamage + appliedHealthDamage;
  const armorBroken = armorBefore > 0 && enemy.armor <= 0;
  const damageKind: DamageNumber['kind'] = armorBroken || displayedDamage >= 34 ? 'heavy' : armorBefore > 0 ? 'armor' : 'health';
  spawnDamageNumber(state, enemy, displayedDamage, damageKind);
  if (displayedDamage > 0) {
    const surface = impactSource === 'field' ? 'field' : armorBefore > 0 ? 'armor' : 'steel';
    recordImpact(state, { target: 'enemy', surface, heavy: damageKind === 'heavy' });
  }
  if (sourceVelocity && sourceKnockback > 0) { enemy.vx += sourceVelocity.x * sourceKnockback; enemy.vy += sourceVelocity.y * sourceKnockback; }
  if (enemy.hp <= 0) finishEnemyDeath(state, enemy);
}

function materialResistance(material: Material) { if (material === 'light') return 16; if (material === 'industrial') return 72; if (material === 'system') return 30; return 9999; }
function activateBreach(state: SimState, id: string) {
  const breach = state.breaches.find(item => item.id === id); if (!breach || breach.active) return; breach.active = true; breach.sealed = false;
  const sector = state.sectors.find(item => item.id === breach.sectorId); if (sector) { sector.rapidTimer = breach.boss ? 6 : 4.2; sector.targetPressure = 0; sector.pressureState = 'decompressing'; }
  spawnEffect(state, breach.x, breach.y, 'breach', 180, 1.1); pushEvent(state, breach.boss ? 'BOSS PHASE II // HULL SHUTTER FAILED // RAPID DECOMPRESSION' : 'SERVICE PLATE BREACHED // TRANSFER BAY DECOMPRESSING', 3.8); for (const debris of state.debris) if (debris.sectorId === breach.sectorId) debris.active = true;
}
function sealBreach(state: SimState, id: string) { const breach = state.breaches.find(item => item.id === id); if (!breach || !breach.active) return; breach.active = false; breach.sealed = true; const sector = state.sectors.find(item => item.id === breach.sectorId); if (sector) { sector.targetPressure = breach.boss ? 0.42 : 0.72; sector.rapidTimer = 0; } pushEvent(state, 'EMERGENCY SHUTTER SEALED // PRESSURE RECOVERY STARTED'); }
function damageObject(state: SimState, object: CombatObject, projectile: Projectile) {
  if (!object.destructible || !object.active) return; let multiplier = 0.55; if (projectile.weapon === 'rail') multiplier = 1.45; if (projectile.weapon === 'breacher') multiplier = 0.9; if (projectile.owner === 'player' && hasTrait(state, 'borecutter')) multiplier *= 1.8; object.hp -= projectile.damage * multiplier;
  if (object.kind === 'conduit' && object.hp <= object.maxHp * 0.55 && !object.exposed) { object.exposed = true; pushEvent(state, 'POWER CONDUIT EXPOSED // ARC PATH AVAILABLE'); }
  if (object.hp > 0) return; object.hp = 0;
  if (projectile.owner === 'player' && hasTrait(state, 'salvageDynamo')) { state.player.capacitor = Math.min(state.player.maxCapacitor, state.player.capacitor + 16); state.player.weaponHeat[state.player.currentWeapon] = Math.max(0, state.player.weaponHeat[state.player.currentWeapon] - 0.08); } if (projectile.owner === 'player' && hasTrait(state, 'scrapCircuit') && object.kind !== 'cover' && state.player.capacitor >= 4) { state.player.capacitor -= 4; state.player.abilityCooldowns[2] = Math.max(0, state.player.abilityCooldowns[2] - 0.9); }
  if (object.kind === 'cover') { object.active = false; if (object.id === 'meridian-pressure-door') { const link = state.links.find(item => item.id === 'door-ab'); if (link) link.open = true; pushEvent(state, 'MERIDIAN PRESSURE LANE BREACHED // FLOW RESTORED', 1.8); } else pushEvent(state, `${object.label.toUpperCase()} COLLAPSED // LINE OF FIRE OPEN`); }
  else if (object.kind === 'coolant') { object.active = false; const hazard = state.hazards.find(item => !item.active); if (hazard) Object.assign(hazard, { active: true, x: object.x + object.w / 2, y: object.y + object.h / 2, radius: 150, life: 7, kind: 'coolantJet', owner: 'environment' }); pushEvent(state, 'COOLANT LINE RUPTURE // THRUST PLUME ACTIVE'); }
  else if (object.kind === 'breachPlate') { object.active = false; activateBreach(state, 'service-breach'); }
  else if (object.kind === 'anchorNode') { object.active = false; object.exposed = true; spawnEffect(state, object.x + object.w / 2, object.y + object.h / 2, 'arc', 92, 0.6); pushEvent(state, object.id.startsWith('enemy-tether') ? 'MAG-TETHER COUPLING BROKEN // FULL MOBILITY RESTORED' : `${object.label.toUpperCase()} DESTROYED // VECTOR ANCHOR LOST`, 1.6); }
  if (projectile.owner === 'player' && hasTrait(state, 'archiveRelay')) { const cx = object.x + object.w / 2; const cy = object.y + object.h / 2; let hits = 0; for (const enemy of state.enemies) { if (!enemy.active || enemy.dead || Math.hypot(enemy.x - cx, enemy.y - cy) > 250) continue; enemy.statuses.disrupted = Math.max(enemy.statuses.disrupted, 2.4); enemy.statuses.conductive = Math.max(enemy.statuses.conductive, 4.2); dealEnemyDamage(state, enemy, 12, 0.55, 0.9); hits += 1; } if (hits > 0) { spawnEffect(state, cx, cy, 'arc', 250, 0.55); pushEvent(state, `ARCHIVE RELAY DYNAMO // HARDWARE COLLAPSE ARCED TO ${hits} TARGET${hits === 1 ? '' : 'S'}`, 1.5); } }
  else if (object.kind === 'conduit') { object.hp = 1; object.exposed = true; }
}

function sectorState(sector: Sector): PressureState { if (sector.rapidTimer > 0 && sector.pressure > 0.08) return 'decompressing'; if (sector.pressure <= 0.07) return 'vacuum'; if (sector.pressure < 0.82) return 'leaking'; return 'normal'; }
function applyPressureForce(state: SimState, body: { x: number; y: number; vx: number; vy: number }, sectorId: string, dt: number, scale: number) {
  for (const breach of state.breaches) { if (!breach.active || breach.sectorId !== sectorId) continue; const dx = breach.x - body.x; const dy = breach.y - body.y; const distance = Math.hypot(dx, dy); if (distance < 1 || distance > breach.radius) continue; const pressure = state.sectors.find(item => item.id === sectorId)?.pressure ?? 0; const weight = Math.pow(1 - distance / breach.radius, 1.35); const force = breach.strength * pressure * weight * scale; body.vx += (dx / distance) * force * dt; body.vy += (dy / distance) * force * dt; }
}
function nearestActiveBreach(state: SimState, sectorId: string) { return state.breaches.find(item => item.active && item.sectorId === sectorId) ?? null; }
function isAnchoredByElite(state: SimState, enemy: Enemy) {
  const node = state.objects.find(object => object.kind === 'anchorNode' && !object.id.startsWith('enemy-tether') && object.active && object.hp > 0 && Math.hypot(object.x + object.w / 2 - enemy.x, object.y + object.h / 2 - enemy.y) < 270);
  if (node) return true;
  const elite = state.enemies.find(item => item.combatClass === 'elite' && !item.dead && item.active && item.statuses.disrupted <= 0);
  return !!elite && Math.hypot(elite.x - enemy.x, elite.y - enemy.y) < 300;
}
function activeSquadCount(state: SimState) { let count = 0; for (const enemy of state.enemies) if (enemy.role !== 'boss' && enemy.active && !enemy.dead) count += 1; return count; }
function findBoss(state: SimState) { return state.enemies.find(enemy => enemy.role === 'boss') ?? null; }
function spawnEnemy(id: number, role: EnemyRole, label: string, x: number, y: number, hp: number, armor: number, sign: number, active = true, variant: EnemyVariant = 'standard'): Enemy { return { id, role, variant, combatClass: role === 'boss' ? 'command' : role === 'elite' ? 'elite' : 'standard', protocols: [], mutations: [], commandTargetMutations: [], commandMutationCooldown: 0, bossPhaseMutations: [], bossMutationCooldown: 0, protocolPulse: 0, label, x, y, vx: 0, vy: 0, hp, maxHp: hp, armor, maxArmor: armor, effectiveness: 1, fireCooldown: 0.8 + id * 0.17, telegraph: 0, telegraphAim: { x: -1, y: 0 }, strafeSign: sign, dead: false, deathT: 0, active, state: 'hold', hazardCooldown: 2.5 + id * 0.4, burst: 0, carriedObjectId: null, statuses: blankStatuses(), bossPhase: 1, bossPattern: 'none', patternIndex: 0, anchored: role === 'elite' || role === 'boss' }; }

export function createSimulation(build: CombatBuild = neutralCombatBuild): SimState {
  seed = 0x5f3759df;
  const classWeapon = build.operatorClass ? operatorWeaponFamilyForClass(build.operatorClass) : 'carbine';
  const carbineConfig = resolveWeaponConfig(build, 'carbine'); const breacherConfig = resolveWeaponConfig(build, 'breacher'); const railConfig = resolveWeaponConfig(build, 'rail');
  const classBootText = build.operatorClass === 'vanguard'
    ? 'VANGUARD ONLINE // RUSH / BREAK / GUARD // BREACH LANE READY'
    : build.operatorClass === 'vector'
      ? 'VECTOR ONLINE // SHIFT / LOCK / SPLIT // PRECISION ROUTE READY'
      : build.operatorClass === 'systems'
        ? 'SYSTEMS ONLINE // WELL / HACK / CHAIN // CLOSED LOOP READY'
        : 'VECTOR SYSTEM ONLINE // MULTI-SYSTEM COMBAT AUTHORIZED';
  const objects: CombatObject[] = [
    { id: 'crate-a', label: 'Light cargo stack', kind: 'cover', material: 'light', x: 540, y: 390, w: 120, h: 180, hp: 70, maxHp: 70, destructible: true, active: true, exposed: false },
    { id: 'bulkhead-a', label: 'Compressor housing', kind: 'cover', material: 'bulkhead', x: 860, y: 650, w: 190, h: 82, hp: 9999, maxHp: 9999, destructible: false, active: true, exposed: false },
    { id: 'crate-b', label: 'Transfer pallet', kind: 'cover', material: 'light', x: 1060, y: 285, w: 120, h: 150, hp: 62, maxHp: 62, destructible: true, active: true, exposed: false },
    { id: 'bulkhead-b', label: 'Pressure machinery', kind: 'cover', material: 'industrial', x: 1310, y: 585, w: 150, h: 120, hp: 170, maxHp: 170, destructible: true, active: true, exposed: false },
    { id: 'conduit-a', label: 'Main bus conduit', kind: 'conduit', material: 'system', x: 1185, y: 735, w: 78, h: 70, hp: 75, maxHp: 75, destructible: true, active: true, exposed: false },
    { id: 'coolant-a', label: 'Coolant riser', kind: 'coolant', material: 'system', x: 920, y: 300, w: 52, h: 86, hp: 54, maxHp: 54, destructible: true, active: true, exposed: false },
    { id: 'service-plate', label: 'Service hull plate', kind: 'breachPlate', material: 'industrial', x: 1285, y: 175, w: 170, h: 42, hp: 82, maxHp: 82, destructible: true, active: true, exposed: false },
    { id: 'door-control', label: 'Pressure door control', kind: 'doorControl', material: 'system', x: 745, y: 735, w: 34, h: 58, hp: 40, maxHp: 40, destructible: false, active: true, exposed: false },
    { id: 'gravity-control', label: 'Transfer spin control', kind: 'gravityControl', material: 'system', x: 1240, y: 205, w: 42, h: 58, hp: 40, maxHp: 40, destructible: false, active: true, exposed: false },
    { id: 'arena-conduit', label: 'Crane power trunk', kind: 'conduit', material: 'system', x: 1850, y: 710, w: 82, h: 72, hp: 88, maxHp: 88, destructible: true, active: true, exposed: false },
    { id: 'arena-cover', label: 'Crane carriage', kind: 'cover', material: 'industrial', x: 1900, y: 330, w: 180, h: 88, hp: 185, maxHp: 185, destructible: true, active: true, exposed: false },
    { id: 'boss-gate', label: 'Crane well pressure gate', kind: 'cover', material: 'bulkhead', x: 1492, y: 160, w: 28, h: 760, hp: 9999, maxHp: 9999, destructible: false, active: true, exposed: false },
    { id: 'boss-seal', label: 'Emergency hull shutter', kind: 'sealControl', material: 'system', x: 1688, y: 228, w: 42, h: 62, hp: 40, maxHp: 40, destructible: false, active: true, exposed: false },
    { id: 'enemy-tether-a', label: 'Mag tether coupling', kind: 'anchorNode', material: 'system', x: 0, y: 0, w: 34, h: 34, hp: 48, maxHp: 48, destructible: true, active: false, exposed: true },
    { id: 'enemy-tether-b', label: 'Mag tether coupling', kind: 'anchorNode', material: 'system', x: 0, y: 0, w: 34, h: 34, hp: 48, maxHp: 48, destructible: true, active: false, exposed: true },
    { id: 'protocol-shutter-a', label: 'Protocol emergency shutter', kind: 'cover', material: 'industrial', x: 1030, y: 330, w: 54, h: 168, hp: 110, maxHp: 110, destructible: true, active: false, exposed: false },
    { id: 'protocol-shutter-b', label: 'Protocol emergency shutter', kind: 'cover', material: 'industrial', x: 1230, y: 610, w: 54, h: 168, hp: 110, maxHp: 110, destructible: true, active: false, exposed: false },
  ];
  return {
    time: 0,
    build,
    weapons: { carbine: carbineConfig, breacher: breacherConfig, rail: railConfig },
    droneTick: 0,
    lastAbilityIndex: -1,
    lastAbilityAt: -99,
    abilityChain: 0,
    classState: { vanguardGuard: 0, vectorWindow: 0, systemsLinks: 0, systemsCrossfeed: 0 },
    bossGateHold: false,
    operationTier: 1,
    monsterLevel: 1,
    maxRecoveryLevel: 12,
    monsterDamageScale: 1,
    groundLoot: [],
    collectedLoot: [],
    damageNumbers: Array.from({ length: 24 }, () => ({ active: false, serial: 0, x: 0, y: 0, value: 0, kind: 'health' as const, life: 0, maxLife: 0.78 })),
    damageNumberSerial: 0,
    impactEvent: null,
    impactSerial: 0,
    player: { x: 330, y: 590, vx: 0, vy: 0, aim: { x: 1, y: 0 }, move: { x: 0, y: 0 }, hp: 100 + build.player.maxHpAdd, maxHp: 100 + build.player.maxHpAdd, armor: 68 + build.player.maxArmorAdd, maxArmor: 68 + build.player.maxArmorAdd, capacitor: 100 + build.player.maxCapAdd, maxCapacitor: 100 + build.player.maxCapAdd, fireCooldown: 0, abilityCooldowns: [0, 0, 0], dodgeCooldown: 0, dodgeTime: 0, lastDodgeAt: -99, invulnerable: 0, consumableCooldown: 0, weaponHeat: { carbine: 0, breacher: 0, rail: 0 }, mags: { carbine: carbineConfig.magazine, breacher: breacherConfig.magazine, rail: railConfig.magazine }, reloadT: 0, reloadWeapon: classWeapon, ventT: 0, dead: false, currentWeapon: classWeapon, vacuumExposure: 0, disrupted: 0 },
    enemies: [spawnEnemy(1, 'assault', 'Pressure Raider', 760, 500, 76, 38, 1), spawnEnemy(2, 'suppressor', 'Line Suppressor', 1030, 655, 82, 46, -1), spawnEnemy(3, 'technician', 'Systems Tech', 1140, 330, 70, 34, 1), spawnEnemy(4, 'assault', 'Pressure Raider', 1320, 540, 78, 40, -1), spawnEnemy(5, 'suppressor', 'Line Suppressor', 1370, 760, 84, 48, 1), spawnEnemy(6, 'elite', 'Anchor Marshal', 1270, 430, 140, 105, -1), spawnEnemy(7, 'assault', 'Reserve Raider', 1450, 300, 76, 38, 1, false), spawnEnemy(8, 'technician', 'Reserve Systems Tech', 1320, 790, 72, 36, -1, false), spawnEnemy(9, 'technician', 'Carrier Repair Drone', 0, 0, 52, 20, 1, false, 'repairDrone'), spawnEnemy(10, 'technician', 'Carrier Repair Drone', 0, 0, 52, 20, -1, false, 'repairDrone'), spawnEnemy(99, 'boss', 'Dock Warden Orison', 2070, 525, 560, 185, 1, false, 'orison')],
    projectiles: Array.from({ length: 112 }, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 4, damage: 0, life: 0, owner: 'player' as const, weapon: 'carbine' as const, penetration: 0, armorDamage: 0.5, healthMultiplier: 1, knockback: 0.05, lastObjectId: null, lastObjectT: 0 })),
    objects,
    sectors: [
      { id: 'A', label: 'SPIN DECK', x: 80, y: 160, w: 690, h: 760, pressure: 1, pressureState: 'normal', gravity: 1, rapidTimer: 0, targetPressure: 1 },
      { id: 'B', label: 'TRANSFER BAY', x: 770, y: 160, w: 740, h: 760, pressure: 0.88, pressureState: 'normal', gravity: 0.34, rapidTimer: 0, targetPressure: 0.88 },
      { id: 'C', label: 'CRANE WELL', x: 1510, y: 160, w: 730, h: 760, pressure: 1, pressureState: 'normal', gravity: 0.72, rapidTimer: 0, targetPressure: 1 },
    ],
    links: [{ id: 'door-ab', a: 'A', b: 'B', open: true, conductance: 0.045 }, { id: 'door-bc', a: 'B', b: 'C', open: false, conductance: 0.055 }],
    breaches: [{ id: 'service-breach', sectorId: 'B', x: 1370, y: 160, active: false, sealed: false, strength: 980, radius: 620, boss: false }, { id: 'boss-breach', sectorId: 'C', x: 2220, y: 515, active: false, sealed: false, strength: 1280, radius: 690, boss: true }],
    hazards: Array.from({ length: 12 }, () => ({ active: false, x: 0, y: 0, radius: 0, life: 0, kind: 'shockGrid' as const, owner: 'enemy' as const })),
    debris: Array.from({ length: 16 }, (_, index) => ({ active: false, x: index < 8 ? 930 + (index % 4) * 145 : 1770 + (index % 4) * 135, y: 265 + (index % 5) * 115, vx: 0, vy: 0, radius: 8 + (index % 3) * 3, sectorId: index < 8 ? 'B' : 'C' })),
    effects: Array.from({ length: 30 }, () => ({ active: false, x: 0, y: 0, kind: 'impact' as const, life: 0, maxLife: 0, radius: 0 })),
    complete: false, bossActive: false, bossDefeated: false, pulse: 0, weaponFlash: 0, kills: 0, squadSuppressing: false, eventText: classBootText, eventT: 3,
    telemetry: { damageDealt: 0, damageTaken: 0, deaths: 0, kills: 0, eliteKills: 0, eliteProtocolsDefeated: 0, killIntervalTotal: 0, killIntervalSamples: 0, lastKillAt: 0, protocolCombinations: {}, weaponShots: { carbine: 0, breacher: 0, rail: 0 }, abilityUses: [0, 0, 0], encounterStart: 0, bossStart: 0, duration: 0, trace: [], nextTraceAt: 0 },
  };
}

export function setMove(state: SimState, move: Vec2) { state.player.move = len(move) > 1 ? norm(move) : move; }
export function setAim(state: SimState, aim: Vec2, touchAssist: boolean | number) {
  let desired = norm(aim); const assist = typeof touchAssist === 'number' ? touchAssist : touchAssist ? 0.2 : 0;
  if (assist > 0 && len(desired) > 0.1) { let best: Enemy | null = null; let bestScore = 999; for (const enemy of state.enemies) { if (enemy.dead || !enemy.active) continue; const toEnemy = { x: enemy.x - state.player.x, y: enemy.y - state.player.y }; const distance = len(toEnemy); if (distance > 520) continue; const n = norm(toEnemy); const angleScore = 1 - (n.x * desired.x + n.y * desired.y); const score = angleScore + distance / 14000 + (enemy.statuses.marked > 0 ? -0.012 : 0); if (angleScore < 0.025 && score < bestScore) { best = enemy; bestScore = score; } } if (best) { const toTarget = norm({ x: best.x - state.player.x, y: best.y - state.player.y }); desired = norm({ x: desired.x * (1 - assist) + toTarget.x * assist, y: desired.y * (1 - assist) + toTarget.y * assist }); } }
  if (len(desired) > 0.1) state.player.aim = desired;
}
function mobileTargetControlConfig(state: SimState, mode: 'light' | 'balanced') {
  const p = state.player;
  const weapon = getWeaponConfig(state, p.currentWeapon);
  const maxDistance = p.currentWeapon === 'breacher'
    ? (mode === 'balanced' ? 680 : 560)
    : p.currentWeapon === 'rail'
      ? (mode === 'balanced' ? 980 : 820)
      : (mode === 'balanced' ? 860 : 720);
  const request: TargetAcquisitionRequest = {
    maxDistance,
    projectileSpeed: weapon.projectileSpeed,
    aimWeight: mode === 'balanced' ? 0.18 : 0.46,
    rangeWeight: 0.44,
    visibilityPenalty: p.currentWeapon === 'rail' ? 0.38 : mode === 'balanced' ? 0.68 : 0.92,
    markWeight: 0.8,
    protocolWeight: mode === 'balanced' ? 1 : 0.6,
    leadScale: mode === 'balanced' ? 0.72 : 0.35,
    maxLeadSeconds: mode === 'balanced' ? 0.38 : 0.2,
  };
  return {
    request,
    stickiness: mode === 'balanced' ? 0.24 : 0.12,
    occlusionGrace: mode === 'balanced' ? 0.45 : 0.24,
    turnRate: 0.14 * state.build.attackSpeedMul,
  };
}

function scoreMobileTarget(state: SimState, mode: 'light' | 'balanced', enemy: Enemy, request: TargetAcquisitionRequest) {
  const p = state.player;
  if (!enemy.active || enemy.dead) return null;
  if (enemy.role === 'boss' && (state.bossGateHold || !state.bossActive)) return null;
  const delta = { x: enemy.x - p.x, y: enemy.y - p.y };
  const distance = len(delta);
  if (distance > request.maxDistance || distance < 1) return null;
  const rawDirection = norm(delta);
  const angleScore = 1 - (rawDirection.x * p.aim.x + rawDirection.y * p.aim.y);
  const closeThreat = distance < (enemy.role === 'assault' ? 380 : 270);
  if (mode === 'light' && angleScore > 0.5) return null;
  if (mode === 'balanced' && !closeThreat && enemy.role !== 'boss' && angleScore > 1.55) return null;
  return evaluateCombatTarget(state, enemy, request);
}

export function updateMobileTargetControl(state: SimState, mode: 'light' | 'balanced', memory: TargetControlMemory) {
  const p = state.player;
  const { request, stickiness, occlusionGrace, turnRate } = mobileTargetControlConfig(state, mode);
  let bestVisible: TargetAcquisitionResult | null = null;
  let bestAny: TargetAcquisitionResult | null = null;

  for (const enemy of state.enemies) {
    const scored = scoreMobileTarget(state, mode, enemy, request);
    if (!scored) continue;
    if (!bestAny || targetCandidatePrecedes(scored, bestAny)) bestAny = scored;
    if (scored.visible && (!bestVisible || targetCandidatePrecedes(scored, bestVisible))) bestVisible = scored;
  }

  const currentEnemy = memory.targetId == null ? null : state.enemies.find(enemy => enemy.id === memory.targetId) ?? null;
  const current = currentEnemy ? scoreMobileTarget(state, mode, currentEnemy, request) : null;
  if (!current && memory.targetId != null) resetTargetControlMemory(memory);

  if (current) {
    if (current.visible) memory.lastVisibleAt = state.time;
    const withinOcclusionGrace = !current.visible && state.time - memory.lastVisibleAt <= occlusionGrace;
    const challenger = bestVisible ?? bestAny;
    const visibilityPenalty = current.visible ? 0 : request.visibilityPenalty ?? 0;
    const effectiveCurrentScore = current.score - (withinOcclusionGrace ? visibilityPenalty : 0);
    if ((current.visible || withinOcclusionGrace) && (!challenger || effectiveCurrentScore <= challenger.score + stickiness)) {
      p.aim = rotateAimToward(p.aim, current.direction, turnRate);
      return current.enemy.id;
    }
  }

  const next = bestVisible;
  if (!next) {
    resetTargetControlMemory(memory);
    return null;
  }

  if (memory.targetId !== next.enemy.id) memory.acquiredAt = state.time;
  memory.targetId = next.enemy.id;
  memory.lastVisibleAt = next.visible ? state.time : Number.NEGATIVE_INFINITY;
  p.aim = rotateAimToward(p.aim, next.direction, turnRate);
  return next.enemy.id;
}

export function aimAtMobileTarget(state: SimState, mode: 'light' | 'balanced' = 'balanced', preferredId: number | null = null) {
  const memory = createTargetControlMemory();
  memory.targetId = preferredId;
  return updateMobileTargetControl(state, mode, memory);
}

export function selectWeapon(state: SimState, weapon: WeaponId) {
  const p = state.player;
  if (p.dead || state.complete) return false;
  if (state.build.operatorClass) {
    const classWeapon = operatorWeaponFamilyForClass(state.build.operatorClass);
    if (weapon !== classWeapon) {
      pushEvent(state, `${weaponConfigs[classWeapon].shortName} // CLASS ARSENAL LOCK`, 1.1);
      return false;
    }
  }
  if (p.ventT > 0) { pushEvent(state, 'THERMAL VENT ACTIVE // WEAPON BUS LOCKED', 1.1); return false; }
  p.currentWeapon = weapon;
  p.reloadT = 0;
  p.fireCooldown = Math.max(p.fireCooldown, 0.12);
  pushEvent(state, `${weaponConfigs[weapon].shortName} SELECTED`, 1.2);
  return true;
}
export function cycleWeapon(state: SimState) {
  if (state.build.operatorClass) {
    const classWeapon = operatorWeaponFamilyForClass(state.build.operatorClass);
    if (state.player.currentWeapon !== classWeapon) return selectWeapon(state, classWeapon);
    pushEvent(state, `${weaponConfigs[classWeapon].shortName} // CLASS ARSENAL LOCK`, 1.1);
    return false;
  }
  const order: WeaponId[] = ['carbine', 'breacher', 'rail'];
  const index = order.indexOf(state.player.currentWeapon);
  return selectWeapon(state, order[(index + 1) % order.length]);
}
export function triggerReload(state: SimState) {
  const p = state.player; const weapon = getWeaponConfig(state, p.currentWeapon); const handling = weaponHandlingProfiles[p.currentWeapon];
  if (!p.dead && p.reloadT <= 0 && p.mags[p.currentWeapon] < weapon.magazine) {
    p.reloadWeapon = p.currentWeapon;
    p.reloadT = weapon.reloadSeconds * handling.reloadDurationMul;
    return true;
  }
  return false;
}
export function triggerVent(state: SimState) { const p = state.player; const handling = weaponHandlingProfiles[p.currentWeapon]; if (p.dead || p.ventT > 0 || p.weaponHeat[p.currentWeapon] < 0.3) return false; p.ventT = handling.ventSeconds / Math.max(0.5, state.build.player.ventSpeedMul); const ventSector = currentSector(state, p.x, p.y); if (hasTrait(state, 'purgeWake') && ventSector.pressure < 0.45) { plantHazard(state, p.x + p.aim.x * 120, p.y + p.aim.y * 120, 'coolantJet', 3.8, 'player'); pushEvent(state, 'PURGEWAKE RIG // THERMAL VENT BECOMES THRUST PLUME', 1.5); } if (hasTrait(state, 'thermalGovernor')) { for (const id of ['carbine', 'breacher', 'rail'] as WeaponId[]) p.weaponHeat[id] = Math.max(0, p.weaponHeat[id] - 0.08); p.abilityCooldowns = p.abilityCooldowns.map(value => Math.max(0, value - 0.45)) as [number, number, number]; pushEvent(state, 'HELIOS GOVERNOR // THERMAL LOAD DISTRIBUTED // ABILITY CLOCKS ADVANCED', 1.5); } else pushEvent(state, `${handling.ventStyle.replace('-', ' ').toUpperCase()} // MOBILITY PROFILE ACTIVE // WEAPON BUS LOCKED`, 1.2); return true; }


export function triggerConsumable(state: SimState, id: ConsumableId) {
  const p = state.player;
  if (p.dead || state.complete || p.consumableCooldown > 0) return false;
  if (id === 'medGel') {
    if (p.hp >= p.maxHp) return false;
    p.hp = Math.min(p.maxHp, p.hp + 40);
    pushEvent(state, 'TRAUMA GEL // +40 HEALTH', 1.2);
  } else if (id === 'armorPatch') {
    if (p.armor >= p.maxArmor) return false;
    p.armor = Math.min(p.maxArmor, p.armor + 35);
    pushEvent(state, 'ARMOR SEALANT // +35 ARMOR', 1.2);
  } else {
    const hot = (['carbine', 'breacher', 'rail'] as WeaponId[]).some(weapon => p.weaponHeat[weapon] > 0.02);
    if (p.capacitor >= p.maxCapacitor && !hot) return false;
    p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 45);
    for (const weapon of ['carbine', 'breacher', 'rail'] as WeaponId[]) p.weaponHeat[weapon] = Math.max(0, p.weaponHeat[weapon] - 0.24);
    pushEvent(state, 'CAPACITOR CELL // +45 CAP // THERMAL SINK', 1.2);
  }
  p.consumableCooldown = 1.25;
  return true;
}

export function triggerFire(state: SimState, targetingIntent: TargetingIntent = 'manual', preferredTargetId: number | null = null) {
  const p = state.player; const weapon = getWeaponConfig(state, p.currentWeapon); const handling = weaponHandlingProfiles[weapon.id];
  if (p.dead || state.complete || p.reloadT > 0 || p.fireCooldown > 0 || p.ventT > 0 || p.weaponHeat[p.currentWeapon] >= 0.98) { if (p.weaponHeat[p.currentWeapon] >= 0.98) pushEvent(state, 'WEAPON OVERHEAT // CEASE FIRE OR VENT', 1.1); return false; }
  if (p.mags[p.currentWeapon] <= 0) { triggerReload(state); return false; }
  const roundsToFire = Math.min(weapon.roundsPerTrigger, p.mags[p.currentWeapon]);
  if (p.capacitor < weapon.capacitorCost * roundsToFire) { pushEvent(state, 'CAPACITOR LOW // RAIL LANCE INHIBITED', 1.1); return false; }
  if (targetingIntent === 'acquire') {
    if (preferredTargetId == null) return false;
    const assistedEnemy = state.enemies.find(enemy => enemy.id === preferredTargetId) ?? null;
    if (!assistedEnemy || (assistedEnemy.role === 'boss' && (state.bossGateHold || !state.bossActive))) return false;
    const assistedTarget = evaluateCombatTarget(state, assistedEnemy, {
      maxDistance: weaponAcquisitionRange(p.currentWeapon),
      projectileSpeed: weapon.projectileSpeed,
      visibilityPenalty: p.currentWeapon === 'rail' ? 0.42 : 0.68,
    });
    if (!assistedTarget?.visible) return false;
    const convergence = 1 - (assistedTarget.direction.x * p.aim.x + assistedTarget.direction.y * p.aim.y);
    const maxConvergence = 1 - Math.cos(10 * Math.PI / 180);
    if (convergence > maxConvergence) return false;
  }
  const sector = currentSector(state, p.x, p.y); const speed = Math.hypot(p.vx, p.vy); const velocityDot = speed > 1 ? (p.vx * p.aim.x + p.vy * p.aim.y) / speed : 0;
  const markedTarget = (state.build.mechanics.sensorPenetration || state.build.specialization === 'survey-deadeye') ? targetInAimCone(state, 760, 0.12) : null;
  const penetrationBonus = markedTarget?.statuses.marked ? 24 : 0; const redlineScale = weapon.id === 'breacher' && hasTrait(state, 'redlineVelocity') ? 1 + Math.min(0.6, speed / 350 * 0.6) : 1; const lateralSpool = weapon.id === 'carbine' && hasTrait(state, 'inertiaSpool') && speed > 180 && Math.abs(velocityDot) < 0.55; const pendulumBrake = weapon.id === 'breacher' && hasTrait(state, 'pendulumBreach') && speed > 150 && velocityDot < -0.35; const cryoline = weapon.id === 'rail' && hasTrait(state, 'cryolineRail') && p.weaponHeat.rail < 0.18; const coldStartBreach = weapon.id === 'breacher' && hasTrait(state, 'coldStartBreach') && p.weaponHeat.breacher < 0.18; const nearBreach = weapon.id === 'breacher' && hasTrait(state, 'stormVentgun') && state.breaches.some(breach => breach.active && breach.sectorId === sector.id && Math.hypot(breach.x - p.x, breach.y - p.y) < 420); const ghostline = weapon.id === 'carbine' && hasTrait(state, 'ghostline') && sector.pressure < 0.35; const pressurePsalm = weapon.id === 'carbine' && hasTrait(state, 'pressureBallistics'); const pressureVelocity = pressurePsalm ? (sector.pressure < 0.45 ? 1.22 : sector.pressure > 0.75 ? 0.92 : 1) : 1;
  const shotOrdinal = state.telemetry.weaponShots[p.currentWeapon] + 1;
  const forkedSpool = weapon.id === 'carbine' && hasTrait(state, 'forkedSpool') && shotOrdinal % 6 === 0;
  const breachEcho = weapon.id === 'breacher' && hasTrait(state, 'breachEcho') && state.time - p.lastDodgeAt <= 0.65;
  const railDoublet = weapon.id === 'rail' && hasTrait(state, 'railDoublet') && p.weaponHeat.rail < 0.22 && p.capacitor >= weapon.capacitorCost + 8;
  const vectorSlipstream = state.build.operatorClass === 'vector' && state.classState.vectorWindow > 0;
  const redlineHot = state.build.specialization === 'redline-pilot' && p.weaponHeat[p.currentWeapon] >= 0.75;
  const redlineSlipstream = vectorSlipstream && redlineHot;
  const inertialDividend = vectorSlipstream && state.build.specialization === 'momentum-broker' && state.build.mechanics.vectorSlingshotShift;
  const referenceSolution = vectorSlipstream && state.build.specialization === 'survey-deadeye' && state.build.mechanics.vectorTriangulationLock && !!markedTarget?.statuses.marked;
  const systemsCrossfeed = state.build.specialization === 'thermal-shunter' && state.classState.systemsCrossfeed > 0;
  const inductionSink = systemsCrossfeed && state.build.mechanics.systemsAnchorLattice && state.classState.systemsCrossfeed > 3.2;
  const slipstreamSpeedMul = state.build.classResonanceTier >= 2 ? 1.28 : state.build.classResonanceTier >= 1 ? 1.22 : 1.15; const slipstreamPenetration = state.build.classResonanceTier >= 2 ? 22 : state.build.classResonanceTier >= 1 ? 16 : 10;
  const projectileSpeed = weapon.projectileSpeed * (ghostline ? 1.35 : 1) * (lateralSpool ? 1.18 : 1) * (coldStartBreach ? 1.12 : 1) * pressureVelocity * (vectorSlipstream ? slipstreamSpeedMul : 1) * (redlineSlipstream ? 1.08 : 1) * (referenceSolution ? 1.06 : 1) * (systemsCrossfeed ? 1.12 : 1) * (inductionSink ? 1.07 : 1);
  const shotDamage = weapon.damage * redlineScale * (nearBreach ? 1.22 : 1) * (pendulumBrake ? 1.22 : 1) * (cryoline ? 1.18 : 1) * (lateralSpool ? 1.22 : 1) * (coldStartBreach ? 1.24 : 1) * (vectorSlipstream && state.build.classResonanceTier >= 2 ? 1.08 : 1) * (redlineSlipstream ? 1.12 : 1) * (referenceSolution ? 1.1 : 1) * (systemsCrossfeed ? 1.1 : 1) * (inductionSink ? 1.08 : 1);
  const shotPenetration = weapon.penetration + penetrationBonus + (ghostline ? 28 : 0) + (cryoline ? 24 : 0) + (coldStartBreach ? 18 : 0) + (pressurePsalm && sector.pressure < 0.45 ? 16 : 0) + (vectorSlipstream ? slipstreamPenetration : 0) + (redlineSlipstream ? 12 : 0) + (referenceSolution ? 16 : 0) + (systemsCrossfeed ? 10 : 0) + (inductionSink ? 8 : 0);
  const shotKnockback = weapon.knockback * (nearBreach ? 1.75 : 1);
  for (let round = 0; round < roundsToFire; round += 1) {
    const packetOffset = weapon.variantId === 'carbine-burst' ? (round - (roundsToFire - 1) / 2) * 0.006 : 0;
    const packetSpeed = projectileSpeed * (weapon.variantId === 'carbine-burst' ? 1 - round * 0.032 : 1);
    for (let pellet = 0; pellet < weapon.pellets; pellet += 1) { const spread = packetOffset + (rand() - 0.5) * weapon.spread * 2; const c = Math.cos(spread); const s = Math.sin(spread); const dir = norm({ x: p.aim.x * c - p.aim.y * s, y: p.aim.x * s + p.aim.y * c }); addProjectile(state, p.x + dir.x * 28, p.y + dir.y * 28, dir, packetSpeed, shotDamage, 'player', { weapon: weapon.id, penetration: shotPenetration, armorDamage: weapon.armorDamage, healthMultiplier: weapon.healthMultiplier, knockback: shotKnockback, radius: weapon.id === 'rail' ? 5 : 4 }); }
  }
  if (forkedSpool) for (const angle of [-0.13, 0.13]) { const c = Math.cos(angle); const s = Math.sin(angle); const dir = { x: p.aim.x * c - p.aim.y * s, y: p.aim.x * s + p.aim.y * c }; addProjectile(state, p.x + dir.x * 28, p.y + dir.y * 28, dir, projectileSpeed * 0.96, shotDamage * 0.55, 'player', { weapon: 'carbine', penetration: shotPenetration * 0.58, armorDamage: weapon.armorDamage * 0.72, healthMultiplier: weapon.healthMultiplier * 0.8, knockback: shotKnockback * 0.6, radius: 3 }); }
  if (breachEcho) for (const angle of [-0.19, 0, 0.19]) { const c = Math.cos(angle); const s = Math.sin(angle); const dir = { x: p.aim.x * c - p.aim.y * s, y: p.aim.x * s + p.aim.y * c }; addProjectile(state, p.x + dir.x * 30, p.y + dir.y * 30, dir, projectileSpeed * 0.9, shotDamage * 0.55, 'player', { weapon: 'breacher', penetration: Math.max(5, shotPenetration * 0.55), armorDamage: weapon.armorDamage * 0.7, healthMultiplier: weapon.healthMultiplier * 0.75, knockback: shotKnockback * 0.8, radius: 3 }); }
  if (railDoublet) { const angle = 0.012; const c = Math.cos(angle); const s = Math.sin(angle); const dir = { x: p.aim.x * c - p.aim.y * s, y: p.aim.x * s + p.aim.y * c }; addProjectile(state, p.x + dir.x * 30, p.y + dir.y * 30, dir, projectileSpeed * 0.92, shotDamage * 0.58, 'player', { weapon: 'rail', penetration: shotPenetration * 0.72, armorDamage: weapon.armorDamage * 0.82, healthMultiplier: weapon.healthMultiplier * 0.82, knockback: shotKnockback * 0.65, radius: 4 }); p.capacitor = Math.max(0, p.capacitor - 8); }
  if (weapon.id === 'rail' && hasTrait(state, 'sunwardFracture') && p.weaponHeat.rail > 0.55) for (const angle of [-0.045, 0.045]) { const c = Math.cos(angle); const s = Math.sin(angle); const dir = { x: p.aim.x * c - p.aim.y * s, y: p.aim.x * s + p.aim.y * c }; addProjectile(state, p.x + dir.x * 28, p.y + dir.y * 28, dir, weapon.projectileSpeed * 0.92, weapon.damage * 0.38, 'player', { weapon: 'rail', penetration: Math.max(20, weapon.penetration * 0.45), armorDamage: 0.8, healthMultiplier: 0.7, knockback: 0.04, radius: 3 }); }
  if (weapon.id === 'rail' && hasTrait(state, 'vacuumWake')) plantHazard(state, p.x + p.aim.x * 300, p.y + p.aim.y * 300, 'vacuumWake', 2.4);
  p.mags[p.currentWeapon] -= roundsToFire; p.capacitor = Math.max(0, p.capacitor - weapon.capacitorCost * roundsToFire); p.fireCooldown = 1 / weapon.rate; p.weaponHeat[p.currentWeapon] = Math.min(1, p.weaponHeat[p.currentWeapon] + weapon.heatPerShot * roundsToFire + (coldStartBreach ? 0.06 : 0) + (weapon.id === 'breacher' && hasTrait(state, 'redlineBulwark') && p.weaponHeat.breacher >= 0.72 ? 0.04 : 0) + (forkedSpool ? 0.05 : 0) + (breachEcho ? 0.07 : 0) + (railDoublet ? 0.08 : 0)); if (nearBreach) p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - 0.06); if (hasTrait(state, 'cryostack') && p.weaponHeat[p.currentWeapon] >= 0.92) p.abilityCooldowns = p.abilityCooldowns.map(value => Math.max(0, value - 0.65)) as [number, number, number]; if (weapon.id === 'carbine' && hasTrait(state, 'palisadeDoctrine') && speed < 55) p.armor = Math.min(p.maxArmor, p.armor + 0.7); const gravity = sector.gravity; const recoilScale = (0.22 + (1 - gravity) * 0.92) * (ghostline ? 0.35 : 1) * (lateralSpool ? 0.55 : 1) * (vectorSlipstream ? (state.build.classResonanceTier >= 2 ? 0.35 : state.build.classResonanceTier >= 1 ? 0.42 : 0.55) : 1) * (weapon.id === 'rail' && hasTrait(state, 'recoilLedger') ? 1.3 : 1) * (weapon.id === 'carbine' && hasTrait(state, 'recoilDynamo') ? 1.18 : 1) * (weapon.id === 'breacher' && hasTrait(state, 'rheaBackblast') ? 1.45 : 1); const propulsion = weapon.id === 'breacher' && gravity < 0.15 && state.build.mechanics.breacherPropulsion ? 1 + 0.6 * (state.build.mechanics.breacherPropulsionScale || 1) : 1; const control = Math.max(0.68, 1 - state.build.player.lowGControl * (gravity < 0.35 ? 0.28 : 0.08)); p.vx *= handling.shotVelocityRetention; p.vy *= handling.shotVelocityRetention; const recoilForce = weapon.recoil * recoilScale * propulsion * control * handling.recoilImpulseMul; if (state.build.mechanics.recoilVectoring && len(p.move) > 0.15) { p.vx += -p.aim.x * recoilForce * 0.65 + p.move.x * recoilForce * 0.35; p.vy += -p.aim.y * recoilForce * 0.65 + p.move.y * recoilForce * 0.35; } else { p.vx -= p.aim.x * recoilForce; p.vy -= p.aim.y * recoilForce; } const recoilReturn = Math.max(weapon.id === 'rail' && hasTrait(state, 'recoilLedger') ? 7 : 0, weapon.id === 'carbine' && hasTrait(state, 'recoilDynamo') ? Math.min(8, recoilForce * 0.16) : 0, state.build.specialization === 'momentum-broker' ? Math.min(state.build.specializationOverclock ? 10 : 8, recoilForce * 0.07 + (state.hazards.some(hazard => hazard.active && hazard.owner !== 'player' && (hazard.kind === 'gravityWell' || hazard.kind === 'vectorWash') && Math.hypot(hazard.x - p.x, hazard.y - p.y) < 320) ? 2 : 0)) : 0, pendulumBrake ? 8 : 0); if (recoilReturn > 0) p.capacitor = Math.min(p.maxCapacitor, p.capacitor + recoilReturn); if (systemsCrossfeed) { state.classState.systemsCrossfeed = 0; p.capacitor = Math.min(p.maxCapacitor, p.capacitor + (inductionSink ? 6 : 4)); if (state.build.specializationOverclock) { if (state.lastAbilityIndex >= 0) p.abilityCooldowns[state.lastAbilityIndex] = Math.max(0, p.abilityCooldowns[state.lastAbilityIndex] - (inductionSink ? 0.7 : 0.5)); p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - (inductionSink ? 0.07 : 0.05)); } if (inductionSink) spawnCapstoneEffect(state, 'systems', p.x, p.y, 166, 0.64); pushEvent(state, inductionSink ? `INDUCTION SINK // ${weapon.shortName} CROSSFIRE OVERCHARGED` : `THERMAL CROSSFIRE // ${weapon.shortName} BUS ENERGY DISCHARGED`, 1.25); } if (vectorSlipstream) {
    state.classState.vectorWindow = 0;
    if (state.build.specialization === 'momentum-broker' && recoilReturn > 0) {
      const recoveryDividend = inertialDividend
        ? Math.min(state.build.specializationOverclock ? 1.05 : 0.85, 0.35 + recoilReturn * 0.065)
        : Math.min(state.build.specializationOverclock ? 0.8 : 0.6, 0.25 + recoilReturn * 0.05);
      p.abilityCooldowns[0] = Math.max(0, p.abilityCooldowns[0] - recoveryDividend);
      p.dodgeCooldown = Math.max(0, p.dodgeCooldown - recoveryDividend * (inertialDividend ? 0.72 : 0.55));
      let dividendCap = 0;
      if (inertialDividend) {
        dividendCap = Math.min(4, recoilReturn * 0.4);
        p.capacitor = Math.min(p.maxCapacitor, p.capacitor + dividendCap);
      }
      if (inertialDividend) spawnCapstoneEffect(state, 'vector', p.x, p.y, 160, 0.58);
      pushEvent(state, inertialDividend
        ? `INERTIAL DIVIDEND // ${weapon.shortName} RECOIL ROUTED // +${dividendCap.toFixed(1)} CAP // SHIFT + DODGE RECYCLED`
        : `MOMENTUM DIVIDEND // ${weapon.shortName} RECOIL BANKED // SHIFT + DODGE RECYCLED`, 1.25);
    } else if (referenceSolution) {
      p.abilityCooldowns[2] = Math.max(0, p.abilityCooldowns[2] - (state.build.specializationOverclock ? 0.85 : 0.65));
      if (state.build.specializationOverclock) p.abilityCooldowns[1] = Math.max(0, p.abilityCooldowns[1] - 0.25);
      spawnCapstoneEffect(state, 'vector', markedTarget?.x ?? p.x, markedTarget?.y ?? p.y, 150, 0.62);
      pushEvent(state, `REFERENCE SOLUTION // MARKED ${weapon.shortName} VECTOR COMMITTED // SPLITSHOT RECYCLED`, 1.25);
    } else if (redlineSlipstream) {
      if (state.build.specializationOverclock) { p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - 0.04); p.dodgeCooldown = Math.max(0, p.dodgeCooldown - 0.2); }
      pushEvent(state, `REDLINE VECTOR // HOT ${weapon.shortName} SLIPSTREAM DISCHARGED`, 1.25);
    } else pushEvent(state, `VECTOR SLIPSTREAM // ${weapon.shortName} STABILIZED`, 1.15);
  } if (weapon.id === 'breacher' && hasTrait(state, 'rheaBackblast')) p.dodgeCooldown = Math.max(0, p.dodgeCooldown - 0.22); if (pendulumBrake) { p.vx *= 0.55; p.vy *= 0.55; pushEvent(state, 'PENDULUM KESTREL // COUNTER-IMPULSE BANKED', 1.2); } state.weaponFlash = weapon.variantId === 'rail-charge' ? 0.15 : weapon.variantId === 'rail-repeater' ? 0.08 : weapon.variantId === 'carbine-burst' ? 0.11 : weapon.variantId === 'carbine-precision' ? 0.075 : weapon.variantId === 'breacher-slug' ? 0.13 : weapon.variantId === 'breacher-rapid' ? 0.085 : 0.07; state.telemetry.weaponShots[p.currentWeapon] += 1; if (p.mags[p.currentWeapon] === 0) triggerReload(state); return true;
}
export function triggerDodge(state: SimState) {
  const p = state.player; if (p.dead || state.complete || p.dodgeCooldown > 0) return false;
  const preSpeed = Math.hypot(p.vx, p.vy); const dir = norm(len(p.move) > 0.15 ? p.move : p.aim); const sector = currentSector(state, p.x, p.y); const gravity = sector.gravity; const scrapline = hasTrait(state, 'scraplineDodge') && gravity < 0.35; let speed = lerp(650, 535, gravity) * (scrapline ? 1.24 : 1);
  const thermalField = hasTrait(state, 'boiloffDash') && p.capacitor >= 8 ? state.hazards.filter(hazard => hazard.active && (hazard.kind === 'coolantJet' || hazard.kind === 'boiloffJet') && Math.hypot(hazard.x - p.x, hazard.y - p.y) < 240).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0] : null;
  if (thermalField) { thermalField.active = false; p.capacitor -= 8; speed *= 1.22; for (const id of ['carbine', 'breacher', 'rail'] as WeaponId[]) p.weaponHeat[id] = Math.max(0, p.weaponHeat[id] - 0.08); spawnEffect(state, thermalField.x, thermalField.y, 'pulse', thermalField.radius, 0.45); }
  p.vx = dir.x * speed; p.vy = dir.y * speed; p.dodgeTime = 0.18; p.lastDodgeAt = state.time; p.invulnerable = 0.24; p.dodgeCooldown = scrapline ? 1.0 : 1.3;
  if (state.build.operatorClass === 'vector') { state.classState.vectorWindow = state.build.classResonanceTier >= 2 ? 1.75 : state.build.classResonanceTier >= 1 ? 1.25 : 0.95; pushEvent(state, 'VECTOR SLIPSTREAM // NEXT SHOT STABILIZED', 1.05); }
  if (hasTrait(state, 'atlasDodgeCap')) p.capacitor = Math.min(p.maxCapacitor, p.capacitor + Math.min(28, preSpeed * 0.065));
  if (hasTrait(state, 'clutchstep')) { const field = state.hazards.filter(hazard => hazard.active && (hazard.kind === 'gravityWell' || hazard.kind === 'vectorWash') && Math.hypot(hazard.x - p.x, hazard.y - p.y) < 310).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]; if (field) { field.active = false; p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 16); p.dodgeCooldown = Math.max(0.7, p.dodgeCooldown - 0.28); spawnEffect(state, field.x, field.y, 'pulse', field.radius, 0.45); } }
  if (hasTrait(state, 'pressureReservoir') && sector.pressure < 0.35 && p.capacitor >= 8) { p.capacitor -= 8; plantHazard(state, p.x, p.y, 'vacuumWake', 2.3, 'player'); }
  if (hasTrait(state, 'momentumMark') && preSpeed >= 180 && p.capacitor >= 6) { const target = state.enemies.filter(enemy => enemy.active && !enemy.dead && Math.hypot(enemy.x - p.x, enemy.y - p.y) < 620 && clearLine(state, p.x, p.y, enemy.x, enemy.y)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]; if (target) { p.capacitor -= 6; target.statuses.marked = Math.max(target.statuses.marked, 4.5); spawnEffect(state, target.x, target.y, 'mark', 48, 0.5); } }
  if (state.build.mechanics.dodgeVent) p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - 0.22 * (state.build.mechanics.dodgeVentScale || 1));
  if (state.build.specialization === 'redline-pilot' && state.build.specializationOverclock && p.weaponHeat[p.currentWeapon] >= 0.75) { p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - 0.12); p.dodgeCooldown += 0.18; const referenceShear = state.hazards.filter(hazard => hazard.active && hazard.owner !== 'player' && (hazard.kind === 'gravityWell' || hazard.kind === 'vectorWash') && Math.hypot(hazard.x - p.x, hazard.y - p.y) < 280).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]; if (referenceShear) { referenceShear.active = false; p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 4); spawnEffect(state, referenceShear.x, referenceShear.y, 'pulse', referenceShear.radius, 0.42); } for (const enemy of state.enemies) { const distance = Math.hypot(enemy.x - p.x, enemy.y - p.y); if (!enemy.active || enemy.dead || distance > 210) continue; enemy.statuses.stagger = Math.max(enemy.statuses.stagger, staggerDuration(enemy, 0.32)); } spawnEffect(state, p.x, p.y, 'pulse', 210, 0.42); }
  if (hasTrait(state, 'axisGhost') && gravity < 0.12) { for (const enemy of state.enemies) { if (!enemy.active || enemy.dead) continue; const delta = { x: enemy.x - p.x, y: enemy.y - p.y }; const distance = len(delta); if (distance <= 0 || distance > 255) continue; const away = norm(delta); enemy.vx += away.x * 440 * (1 - distance / 310); enemy.vy += away.y * 440 * (1 - distance / 310); enemy.statuses.stagger = Math.max(enemy.statuses.stagger, staggerDuration(enemy, 0.45)); } spawnEffect(state, p.x, p.y, 'pulse', 255, 0.5); }
  return true;
}

function targetInAimCone(state: SimState, maxDistance: number, coneScore: number) { const p = state.player; let target: Enemy | null = null; let best = 999; for (const enemy of state.enemies) { if (enemy.dead || !enemy.active) continue; const delta = { x: enemy.x - p.x, y: enemy.y - p.y }; const distance = len(delta); if (distance > maxDistance) continue; const n = norm(delta); const score = 1 - (n.x * p.aim.x + n.y * p.aim.y) + distance / 15000; if (score < coneScore && score < best && clearLine(state, p.x, p.y, enemy.x, enemy.y)) { best = score; target = enemy; } } return target; }
function findAimConduit(state: SimState, maxDistance: number) {
  const p = state.player;
  let target: CombatObject | null = null;
  let best = 999;
  for (const object of state.objects) {
    if (!object.active) continue;
    if (object.kind === 'conduit' && !object.exposed) continue;
    if (object.kind !== 'conduit' && object.kind !== 'anchorNode') continue;
    const cx = object.x + object.w / 2;
    const cy = object.y + object.h / 2;
    const delta = { x: cx - p.x, y: cy - p.y };
    const distance = len(delta);
    if (distance > maxDistance) continue;
    const n = norm(delta);
    const score = 1 - (n.x * p.aim.x + n.y * p.aim.y) + distance / 12000;
    if (score < 0.11 && score < best) { best = score; target = object; }
  }
  return target;
}

export function abilityUsesTargetAcquisition(state: SimState, index: number) {
  if (index === 1) return true;
  return index === 2 && state.build.operatorClass !== 'vanguard' && state.build.operatorClass !== 'vector';
}

export function triggerAbility(state: SimState, index = 0, targetingIntent: TargetingIntent = 'manual', preferredTargetId: number | null = null) {
  const p = state.player; const meta = getAbilityConfig(state, index);
  let parallaxClassCounterEvent: string | null = null;
  let vanguardCapstoneEvent: string | null = null;
  let systemsCapstoneEvent: string | null = null;
  let vanguardSiegeContacts = 0;
  let vanguardSiegeWakePoint: Vec2 | null = null;
  let vanguardFaultlineRelay: Enemy | null = null;
  let vanguardFaultlineRelayArmorBefore = 0;
  let systemsAnchorContacts = 0;
  let systemsRecursiveRelays = 0;
  let systemsReturnNodes = 0;
  let systemsGridReturnNodes = 0;
  if (p.dead || state.complete || p.abilityCooldowns[index] > 0) return false;
  if (p.capacitor < meta.cost) { pushEvent(state, 'CAPACITOR LOW // ABILITY INHIBITED', 1.1); return false; }
  const previousAbility = state.lastAbilityIndex; const chained = previousAbility >= 0 && previousAbility !== index && state.time - state.lastAbilityAt <= 3.4;
  const thermalShunterHeat = state.build.specialization === 'thermal-shunter' ? p.weaponHeat[p.currentWeapon] : 0;
  p.capacitor -= meta.cost; const capacitorAfterCost = p.capacitor; p.abilityCooldowns[index] = meta.cooldown; state.telemetry.abilityUses[index] += 1;
  if (index === 0) {
    state.pulse = 0.36;
    if (state.build.operatorClass === 'vanguard') {
      const rushSpeed = (state.build.classResonanceTier >= 2 ? 620 : state.build.classResonanceTier >= 1 ? 560 : 510) * meta.power * meta.control;
      p.vx += p.aim.x * rushSpeed; p.vy += p.aim.y * rushSpeed;
      p.invulnerable = Math.max(p.invulnerable, 0.14);
      state.classState.vanguardGuard = Math.max(state.classState.vanguardGuard, state.build.classResonanceTier >= 2 ? 4.2 : 3.4);
    } else if (state.build.operatorClass === 'vector') {
      const slingshotShift = state.build.mechanics.vectorSlingshotShift;
      const shiftSpeed = (state.build.classResonanceTier >= 2 ? 760 : state.build.classResonanceTier >= 1 ? 700 : 640) * meta.power * meta.control * (slingshotShift ? 1.18 : 1);
      p.vx += p.aim.x * shiftSpeed; p.vy += p.aim.y * shiftSpeed;
      p.invulnerable = Math.max(p.invulnerable, slingshotShift ? 0.2 : 0.16);
      state.classState.vectorWindow = Math.max(state.classState.vectorWindow, slingshotShift ? (state.build.classResonanceTier >= 2 ? 2.95 : 2.65) : state.build.classResonanceTier >= 2 ? 2.1 : 1.55);
      if (slingshotShift) p.dodgeCooldown = Math.max(0, p.dodgeCooldown - 0.35);
    }
    for (const enemy of state.enemies) { if (enemy.dead || !enemy.active) continue; const delta = { x: enemy.x - p.x, y: enemy.y - p.y }; const distance = len(delta); const fieldRange = (state.build.operatorClass === 'systems' ? 470 : state.build.operatorClass === 'vanguard' ? 325 : state.build.operatorClass === 'vector' ? 250 : 285) * meta.range; if (distance > fieldRange || distance < 1) continue; const dir = norm(delta); if (dir.x * p.aim.x + dir.y * p.aim.y < 0.1) continue; const exosuit = enemy.variant === 'meleeExosuit'; const anchored = !exosuit && (enemy.combatClass === 'elite' || enemy.role === 'boss' || protocolAnchorsEnemy(enemy) || isAnchoredByElite(state, enemy)) && enemy.statuses.disrupted <= 0; const polarityPoint = { x: p.x + p.aim.x * 185, y: p.y + p.aim.y * 185 }; const impulseDir = state.build.operatorClass === 'systems' ? norm({ x: polarityPoint.x - enemy.x, y: polarityPoint.y - enemy.y }) : dir; const classForce = state.build.operatorClass === 'vanguard' ? 1.3 : state.build.operatorClass === 'vector' ? 0.55 : state.build.operatorClass === 'systems' ? 1.18 : 1; const force = 610 * meta.power * meta.control * classForce * Math.max(0.08, 1 - distance / (fieldRange + 90)) * (anchored ? 0.18 : 1) * (exosuit ? 1.75 : 1); enemy.vx += impulseDir.x * force; enemy.vy += impulseDir.y * force; enemy.statuses.stagger = Math.max(enemy.statuses.stagger, staggerDuration(enemy, state.build.operatorClass === 'vanguard' ? 1.05 : exosuit ? 1.35 : anchored ? 0.2 : 0.8)); if (state.build.operatorClass === 'systems') { enemy.statuses.disrupted = Math.max(enemy.statuses.disrupted, 1.6); if (state.build.mechanics.systemsAnchorLattice) { enemy.statuses.conductive = Math.max(enemy.statuses.conductive, 4.8); systemsAnchorContacts += 1; } } dealEnemyDamage(state, enemy, (state.build.operatorClass === 'vanguard' ? 13 : exosuit ? 13 : 8) * meta.power, state.build.operatorClass === 'vanguard' ? 0.65 : 0.28, 0.6); if (state.build.operatorClass === 'vanguard' && enemy.variant === 'parallaxSkirmisher') { enemy.hazardCooldown = Math.max(enemy.hazardCooldown, 5.8); enemy.statuses.disrupted = Math.max(enemy.statuses.disrupted, 2.2); enemy.statuses.stagger = Math.max(enemy.statuses.stagger, staggerDuration(enemy, 1.4)); parallaxClassCounterEvent = 'VANGUARD INTERCEPT // SHEAR RUNNER COUNTERSTEP BROKEN'; } }
    if (state.build.operatorClass === 'systems' && state.build.mechanics.systemsAnchorLattice && systemsAnchorContacts > 0) {
      p.abilityCooldowns[1] = Math.max(0, p.abilityCooldowns[1] - Math.min(1.5, systemsAnchorContacts * 0.35));
      spawnEffect(state, p.x + p.aim.x * 185, p.y + p.aim.y * 185, 'arc', 110, 0.45);
    }
    if (state.build.operatorClass === 'vanguard' && state.build.mechanics.vanguardSiegeRam) {
      for (const enemy of state.enemies) {
        if (!enemy.active || enemy.dead) continue;
        const delta = { x: enemy.x - p.x, y: enemy.y - p.y };
        const distance = len(delta);
        if (distance <= 0 || distance > 390) continue;
        const direction = norm(delta);
        if (direction.x * p.aim.x + direction.y * p.aim.y < 0.25) continue;
        enemy.armor = Math.max(0, enemy.armor - 22 * meta.power * meta.armor);
        enemy.statuses.armorBreach = Math.max(enemy.statuses.armorBreach, 3.6);
        enemy.statuses.stagger = Math.max(enemy.statuses.stagger, staggerDuration(enemy, 0.6));
        enemy.vx += p.aim.x * 120;
        enemy.vy += p.aim.y * 120;
        spawnEffect(state, enemy.x, enemy.y, 'impact', 54, 0.35);
        if (state.build.specialization === 'pressure-diver') {
          enemy.statuses.vacuum = Math.max(enemy.statuses.vacuum, state.build.specializationOverclock ? 3 : 2.4);
          if (!vanguardSiegeWakePoint) vanguardSiegeWakePoint = { x: enemy.x, y: enemy.y };
        }
        vanguardSiegeContacts += 1;
      }
      if (vanguardSiegeContacts > 0) state.classState.vanguardGuard = Math.min(6.4, state.classState.vanguardGuard + Math.min(1.8, vanguardSiegeContacts * 0.6));
      if (vanguardSiegeWakePoint && state.build.specialization === 'pressure-diver') {
        plantHazard(state, vanguardSiegeWakePoint.x, vanguardSiegeWakePoint.y, 'vacuumWake', state.build.specializationOverclock ? 2.8 : 2.1, 'player');
        p.vacuumExposure = Math.max(0, p.vacuumExposure - (state.build.specializationOverclock ? 0.65 : 0.35));
        vanguardCapstoneEvent = `VOID RAM // ${vanguardSiegeContacts} CONTACT${vanguardSiegeContacts === 1 ? '' : 'S'} // VACUUM TRAIL SEEDED`;
        spawnCapstoneEffect(state, 'vanguard', vanguardSiegeWakePoint.x, vanguardSiegeWakePoint.y, 178, 0.7);
      }
    }
    for (const projectile of state.projectiles) { if (!projectile.active || projectile.owner !== 'enemy') continue; const delta = { x: projectile.x - p.x, y: projectile.y - p.y }; const distance = len(delta); if (distance > 250 || distance < 1) continue; const dir = norm(delta); if (dir.x * p.aim.x + dir.y * p.aim.y > 0) { if (state.build.mechanics.magRedirect) { projectile.owner = 'player'; projectile.weapon = state.build.classSkillFamily.family ?? 'carbine'; projectile.damage = 16 * meta.power * (state.build.mechanics.magRedirectScale || 1); projectile.penetration = 10 * (state.build.mechanics.magRedirectScale || 1); const speed = Math.max(560, Math.hypot(projectile.vx, projectile.vy)); projectile.vx = dir.x * speed; projectile.vy = dir.y * speed; } else { projectile.vx += dir.x * 620; projectile.vy += dir.y * 620; } } }
    if (hasTrait(state, 'magBloom')) {
      for (let spoke = 0; spoke < 8; spoke += 1) { const angle = Math.PI * 2 * spoke / 8; const dir = { x: Math.cos(angle), y: Math.sin(angle) }; addProjectile(state, p.x + dir.x * 34, p.y + dir.y * 34, dir, 590 * meta.range, 10 * meta.power, 'player', { weapon: state.build.classSkillFamily.family ?? 'carbine', penetration: 9 * meta.armor, armorDamage: 0.52 * meta.armor, healthMultiplier: 0.8, knockback: 0.035 * meta.control, radius: 3 }); }
      spawnEffect(state, p.x, p.y, 'pulse', 190, 0.5);
    }
    const baseCounterKick = state.build.operatorClass === 'vector' ? 0 : state.build.operatorClass === 'vanguard' ? 18 : state.build.operatorClass === 'systems' ? 42 : 62; const counterKick = state.build.mechanics.magOverdriveKick ? baseCounterKick * 1.68 : baseCounterKick; p.vx -= p.aim.x * counterKick; p.vy -= p.aim.y * counterKick;
    const canConsumeField = hasTrait(state, 'massTap') || state.build.mechanics.magBoundarySink;
    const field = canConsumeField ? state.hazards.filter(hazard => hazard.active && (hazard.kind === 'gravityWell' || hazard.kind === 'vectorWash' || (state.build.mechanics.magBoundarySink && (hazard.kind === 'boiloffJet' || hazard.kind === 'shockGrid'))) && Math.hypot(hazard.x - p.x, hazard.y - p.y) < 330).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0] : null;
    if (field) { field.active = false; if (hasTrait(state, 'massTap')) p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 14); if (state.build.mechanics.magBoundarySink) { for (const enemy of state.enemies) { const delta = { x: enemy.x - field.x, y: enemy.y - field.y }; const distance = len(delta); if (!enemy.active || enemy.dead || distance <= 0 || distance > 260) continue; const away = norm(delta); enemy.vx += away.x * 280 * (1 - distance / 300); enemy.vy += away.y * 280 * (1 - distance / 300); } } spawnEffect(state, field.x, field.y, 'pulse', Math.max(120, field.radius), 0.55); }
    const pressureDiverField = state.build.specialization === 'pressure-diver' ? state.hazards.filter(hazard => hazard.active && hazard.owner !== 'player' && (hazard.kind === 'gravityWell' || hazard.kind === 'vectorWash') && Math.hypot(hazard.x - p.x, hazard.y - p.y) < 340).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0] : null;
    if (pressureDiverField) { pressureDiverField.active = false; spawnEffect(state, pressureDiverField.x, pressureDiverField.y, 'pulse', pressureDiverField.radius, 0.5); }
    const sector = currentSector(state, p.x, p.y); if (state.build.specialization === 'pressure-diver' && (sector.pressure < 0.45 || !!pressureDiverField)) plantHazard(state, p.x + p.aim.x * 145, p.y + p.aim.y * 145, 'vacuumWake', state.build.specializationOverclock ? 3 : 2.2, 'player');
    const slotOneEvent = vanguardCapstoneEvent
      ? vanguardCapstoneEvent
      : pressureDiverField
      ? 'PRESSURE DIVER // REFERENCE SHEAR COLLAPSED TO VACUUM WAKE'
      : state.build.operatorClass === 'vanguard'
      ? state.build.mechanics.vanguardSiegeRam ? `SIEGE RAM // ${vanguardSiegeContacts} ARMOR CONTACT${vanguardSiegeContacts === 1 ? '' : 'S'} // GUARD FED` : 'BREACH RUSH // RAM LINE COMMITTED // GUARD UP'
      : state.build.operatorClass === 'vector'
        ? state.build.mechanics.vectorSlingshotShift ? 'SLINGSHOT SHIFT // EXTENDED VECTOR // SLIPSTREAM BANKED' : 'VECTOR SHIFT // SLIPSTREAM PRIMED'
        : state.build.operatorClass === 'systems'
          ? state.build.mechanics.systemsAnchorLattice && systemsAnchorContacts > 0 ? `ANCHOR LATTICE // ${systemsAnchorContacts} NODE${systemsAnchorContacts === 1 ? '' : 'S'} PINNED // HACK RECYCLED` : 'POLARITY WELL // FORMATION COLLAPSED'
          : field ? hasTrait(state, 'massTap') ? 'MASS RETURN // LOCAL FIELD COLLAPSED TO CAPACITOR' : 'BOUNDARY SINK // HOSTILE FIELD GEOMETRY COLLAPSED' : state.build.mechanics.magRedirect ? 'MAGNETIC IMPULSE // HOSTILE VECTORS REDIRECTED' : 'MAGNETIC IMPULSE // VECTOR DISPLACEMENT';
    pushEvent(state, parallaxClassCounterEvent ?? slotOneEvent, parallaxClassCounterEvent ? 1.6 : 1.2);
  } else if (index === 1) {
    const targetRange = (state.build.operatorClass === 'vector' ? 930 : state.build.operatorClass === 'vanguard' ? 620 : 760) * meta.range;
    const acquiredTarget = targetingIntent === 'acquire'
      ? acquirePreferredCombatTarget(state, {
        maxDistance: targetRange,
        aimWeight: state.build.operatorClass === 'vector' ? 0.5 : 0.38,
        rangeWeight: state.build.operatorClass === 'vanguard' ? 0.36 : 0.26,
        visibilityPenalty: 0.82,
      }, preferredTargetId)
      : null;
    const target = targetingIntent === 'acquire'
      ? focusAcquiredTarget(state, acquiredTarget)
      : state.build.operatorClass === 'systems'
        ? state.enemies.filter(enemy => enemy.active && !enemy.dead && Math.hypot(enemy.x - p.x, enemy.y - p.y) <= targetRange).sort((a, b) => {
          const score = (enemy: Enemy) => { const delta = norm({ x: enemy.x - p.x, y: enemy.y - p.y }); return (1 - (delta.x * p.aim.x + delta.y * p.aim.y)) * 360 + Math.hypot(enemy.x - p.x, enemy.y - p.y); };
          return score(a) - score(b) || a.id - b.id;
        })[0] ?? null
        : targetInAimCone(state, targetRange, state.build.operatorClass === 'vector' ? 0.075 : 0.1);
    const vanguardFaultlinePrimaryArmorBefore = target?.armor ?? 0;
    if (target) { target.statuses.marked = (state.build.operatorClass === 'vector' ? 10 : 7.5) * meta.power * (hasTrait(state, 'markCascade') ? 0.78 : 1); if (state.build.operatorClass === 'vanguard') { target.statuses.armorBreach = Math.max(target.statuses.armorBreach, 4.8); const towardOperator = norm({ x: p.x - target.x, y: p.y - target.y }); target.vx += towardOperator.x * 320; target.vy += towardOperator.y * 320; target.armor = Math.max(0, target.armor - 18 * meta.power * meta.armor); target.statuses.stagger = Math.max(target.statuses.stagger, staggerDuration(target, 0.55)); } if (state.build.operatorClass === 'vector') { state.classState.vectorWindow = Math.max(state.classState.vectorWindow, state.build.classResonanceTier >= 2 ? 2.6 : 2.1); p.weaponHeat.rail = Math.max(0, p.weaponHeat.rail - 0.06); } if (target.role === 'technician' || target.combatClass === 'elite' || target.role === 'boss' || target.protocols.length > 0) target.statuses.disrupted = Math.max(target.statuses.disrupted, 2.8); target.anchored = false; spawnEffect(state, target.x, target.y, 'mark', 64, 0.7); if (hasTrait(state, 'tetherhand')) plantHazard(state, target.x, target.y, 'gravityWell', 2.8); if (state.build.mechanics.widebandMark) { const secondary = state.enemies.find(enemy => enemy.active && !enemy.dead && enemy.id !== target.id && Math.hypot(enemy.x - target.x, enemy.y - target.y) < 260 * meta.range); if (secondary) { secondary.statuses.marked = 5.2 * meta.power; spawnEffect(state, secondary.x, secondary.y, 'mark', 48, 0.55); } } if (state.build.operatorClass === 'systems') { let relays = 0; const relayLimit = (state.build.classResonanceTier >= 2 ? 3 : 2) + (state.build.mechanics.systemsRecursiveIntrusion ? 1 : 0) + meta.chainBonus; const relayCandidates = state.enemies.filter(enemy => enemy.active && !enemy.dead && enemy.id !== target.id && Math.hypot(enemy.x - p.x, enemy.y - p.y) < 900 * meta.range).sort((a, b) => { const aTarget = Math.hypot(a.x - target.x, a.y - target.y); const bTarget = Math.hypot(b.x - target.x, b.y - target.y); return aTarget - bTarget || Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y); }); for (const secondary of relayCandidates) { secondary.statuses.marked = Math.max(secondary.statuses.marked, 4.6 * meta.power); secondary.statuses.disrupted = Math.max(secondary.statuses.disrupted, 2.2); if (state.build.mechanics.systemsRecursiveIntrusion) secondary.statuses.conductive = Math.max(secondary.statuses.conductive, 4.8); spawnEffect(state, secondary.x, secondary.y, 'mark', 42, 0.5); relays += 1; if (relays >= relayLimit) break; } if (state.build.mechanics.systemsRecursiveIntrusion && relays > 0) { systemsRecursiveRelays = relays; p.abilityCooldowns[2] = Math.max(0, p.abilityCooldowns[2] - Math.min(1.4, relays * 0.45)); if (state.build.specialization === 'capacitor-conductor') { const relayRefund = Math.min(state.build.specializationOverclock ? 8 : 6, relays * 2); p.capacitor = Math.min(p.maxCapacitor, p.capacitor + relayRefund); if (state.build.specializationOverclock) p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - Math.min(0.08, relays * 0.02)); systemsCapstoneEvent = `RECURSIVE BUS // ${relays} RELAY${relays === 1 ? '' : 'S'} // +${relayRefund} CAP`; spawnCapstoneEffect(state, 'systems', target.x, target.y, 158, 0.68); } } } if (hasTrait(state, 'custodyShear') && target.carriedObjectId) { dropCarriedObjective(state, target, true); p.abilityCooldowns[1] = Math.min(p.abilityCooldowns[1], 1.4); pushEvent(state, 'CUSTODY SHEAR // CARRIED MISSION HARDWARE RELEASED // TAG RESTORED', 1.6); } if (hasTrait(state, 'custodyShear')) { const hardware = state.objects.filter(object => object.active && object.kind === 'anchorNode' && (object.id.includes('custody-') || object.id.includes('siphon')) && Math.hypot(object.x + object.w / 2 - target.x, object.y + object.h / 2 - target.y) < 360).sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))[0]; if (hardware) { hardware.hp = 0; hardware.active = false; hardware.exposed = true; spawnEffect(state, hardware.x + hardware.w / 2, hardware.y + hardware.h / 2, 'arc', 80, 0.45); } } if (hasTrait(state, 'relayCrown')) { const relay = state.objects.find(object => object.active && (object.kind === 'conduit' || object.kind === 'anchorNode') && (object.exposed || object.kind === 'anchorNode') && Math.hypot(object.x + object.w / 2 - target.x, object.y + object.h / 2 - target.y) < 330); if (relay) { const cx = relay.x + relay.w / 2; const cy = relay.y + relay.h / 2; let jumped = 0; for (const enemy of state.enemies) { if (!enemy.active || enemy.dead || enemy.id === target.id || Math.hypot(enemy.x - cx, enemy.y - cy) > 310) continue; enemy.statuses.marked = Math.max(enemy.statuses.marked, 4.8 * meta.power); spawnEffect(state, enemy.x, enemy.y, 'mark', 42, 0.5); jumped += 1; if (jumped >= 2) break; } if (jumped > 0) pushEvent(state, `RELAY CROWN // SENSOR SPIKE JUMPED THROUGH ${relay.label.toUpperCase()}`, 1.7); else pushEvent(state, `SENSOR SPIKE // ${target.label.toUpperCase()} MARKED`, 1.4); } else pushEvent(state, `SENSOR SPIKE // ${target.label.toUpperCase()} MARKED`, 1.4); } else pushEvent(state, `SENSOR SPIKE // ${target.label.toUpperCase()} MARKED`, 1.4); }
    else { p.capacitor = Math.min(p.maxCapacitor, p.capacitor + meta.cost * 0.55); p.abilityCooldowns[index] = 1.2; pushEvent(state, state.build.operatorClass === 'vanguard' ? 'FRACTURE TAG // NO TARGET IN BREACH LANE' : state.build.operatorClass === 'vector' ? 'DEADEYE LOCK // NO FIRING SOLUTION' : state.build.operatorClass === 'systems' ? 'RELAY HACK // NO HOSTILE NODE FOUND' : 'SENSOR SPIKE // NO VALID RETURN', 1.1); }
    if (target && state.build.operatorClass === 'vector' && state.build.mechanics.vectorTriangulationLock) {
      const referenceSolution = state.build.specialization === 'survey-deadeye';
      target.statuses.armorBreach = Math.max(target.statuses.armorBreach, referenceSolution ? 4.4 : 2.8);
      p.abilityCooldowns[2] = Math.max(0, p.abilityCooldowns[2] - (referenceSolution ? 1.8 : 1.2));
      if (referenceSolution) {
        state.classState.vectorWindow = Math.max(state.classState.vectorWindow, state.build.specializationOverclock ? 3.45 : 3.15);
        p.weaponHeat.rail = Math.max(0, p.weaponHeat.rail - 0.04);
      }
      spawnEffect(state, target.x, target.y, 'mark', referenceSolution ? 92 : 78, 0.6);
    }
    if (target && state.build.operatorClass === 'vanguard' && state.build.mechanics.vanguardFaultlineTag) {
      const secondary = state.enemies
        .filter(enemy => enemy.active && !enemy.dead && enemy.id !== target.id && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= 300 * meta.range)
        .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))[0] ?? null;
      if (secondary) {
        vanguardFaultlineRelayArmorBefore = secondary.armor;
        secondary.armor = Math.max(0, secondary.armor - 12 * meta.power * meta.armor);
        secondary.statuses.armorBreach = Math.max(secondary.statuses.armorBreach, 3.8);
        secondary.statuses.stagger = Math.max(secondary.statuses.stagger, staggerDuration(secondary, 0.4));
        const towardOperator = norm({ x: p.x - secondary.x, y: p.y - secondary.y });
        secondary.vx += towardOperator.x * 170;
        secondary.vy += towardOperator.y * 170;
        spawnEffect(state, secondary.x, secondary.y, 'mark', 48, 0.55);
        vanguardFaultlineRelay = secondary;
      }
    }
    if (target && state.build.specialization === 'breach-vanguard' && state.build.mechanics.vanguardFaultlineTag) {
      target.armor = Math.max(0, target.armor - 8 * meta.power * meta.armor);
      target.statuses.armorBreach = Math.max(target.statuses.armorBreach, 6);
      if (vanguardFaultlineRelay) {
        vanguardFaultlineRelay.armor = Math.max(0, vanguardFaultlineRelay.armor - 8 * meta.power * meta.armor);
        vanguardFaultlineRelay.statuses.armorBreach = Math.max(vanguardFaultlineRelay.statuses.armorBreach, 5.2);
      }
      const breaks = (vanguardFaultlinePrimaryArmorBefore > 0 && target.armor <= 0 ? 1 : 0)
        + (vanguardFaultlineRelay && vanguardFaultlineRelayArmorBefore > 0 && vanguardFaultlineRelay.armor <= 0 ? 1 : 0);
      if (breaks > 0) {
        state.classState.vanguardGuard = Math.max(state.classState.vanguardGuard, Math.min(5.2, 3.6 + breaks * 0.7));
        if (state.build.specializationOverclock) p.armor = Math.min(p.maxArmor, p.armor + Math.min(8, breaks * 4));
      }
      vanguardCapstoneEvent = breaks > 0
        ? `BREACH CASCADE // ${breaks} ARMOR BREAK${breaks === 1 ? '' : 'S'} // GUARD FED`
        : 'BREACH CASCADE // DUAL FRACTURE DEEPENED';
      spawnCapstoneEffect(state, 'vanguard', target.x, target.y, breaks > 0 ? 170 : 145, 0.66);
    }
    if (target && state.build.operatorClass === 'vector' && target.variant === 'baselineMarksman') { target.telegraph = 0; target.fireCooldown = Math.max(target.fireCooldown, 3.2); target.statuses.disrupted = Math.max(target.statuses.disrupted, 2.4); parallaxClassCounterEvent = 'VECTOR COUNTER-SNIPE // BASELINE FIRING SOLUTION BROKEN'; }
    else if (target && state.build.operatorClass === 'systems' && target.variant === 'referenceTech') { target.hazardCooldown = Math.max(target.hazardCooldown, 8.4); target.statuses.disrupted = Math.max(target.statuses.disrupted, 4.2); target.statuses.conductive = Math.max(target.statuses.conductive, 8); p.abilityCooldowns[2] = Math.min(p.abilityCooldowns[2], 2.2); parallaxClassCounterEvent = 'SYSTEMS BASELINE SPOOF // REFERENCE TECH BUS OVERLOADED'; }
    if (parallaxClassCounterEvent) pushEvent(state, parallaxClassCounterEvent, 1.6);
    else if (target && state.build.operatorClass === 'vanguard') pushEvent(state, vanguardCapstoneEvent ?? (vanguardFaultlineRelay ? `FAULTLINE TAG // ${target.label.toUpperCase()} + ${vanguardFaultlineRelay.label.toUpperCase()} FRACTURED` : `FRACTURE TAG // ${target.label.toUpperCase()} ARMOR PATH OPEN`), 1.35);
    else if (target && state.build.operatorClass === 'vector') pushEvent(state, state.build.mechanics.vectorTriangulationLock ? (state.build.specialization === 'survey-deadeye' ? `REFERENCE SOLUTION // ${target.label.toUpperCase()} // DEEP LOCK + SPLITSHOT RECYCLED` : `TRIANGULATION LOCK // ${target.label.toUpperCase()} // SPLITSHOT RECYCLED`) : `DEADEYE LOCK // ${target.label.toUpperCase()} // SLIPSTREAM READY`, 1.35);
    else if (target && state.build.operatorClass === 'systems') pushEvent(state, systemsCapstoneEvent ?? (state.build.mechanics.systemsRecursiveIntrusion ? `RECURSIVE INTRUSION // ${target.label.toUpperCase()} // ${systemsRecursiveRelays} RELAY${systemsRecursiveRelays === 1 ? '' : 'S'} // CASCADE RECYCLED` : `RELAY HACK // ${target.label.toUpperCase()} NETWORK COMPROMISED`), 1.35);
  } else if (state.build.operatorClass === 'vanguard') {
    state.pulse = 0.46;
    const bulkheadWarden = state.build.specialization === 'bulkhead-warden';
    state.classState.vanguardGuard = Math.max(state.classState.vanguardGuard, bulkheadWarden ? (state.build.specializationOverclock ? 7 : 6.5) : state.build.classResonanceTier >= 2 ? 6 : 5);
    p.invulnerable = Math.max(p.invulnerable, 0.18);
    let hits = 0;
    for (const enemy of state.enemies) {
      if (!enemy.active || enemy.dead) continue;
      const delta = { x: enemy.x - p.x, y: enemy.y - p.y };
      const distance = len(delta);
      if (distance <= 0 || distance > 330 * meta.range) continue;
      const away = norm(delta);
      enemy.vx += away.x * 360 * meta.control * (1 - distance / (390 * meta.range));
      enemy.vy += away.y * 360 * meta.control * (1 - distance / (390 * meta.range));
      enemy.statuses.stagger = Math.max(enemy.statuses.stagger, staggerDuration(enemy, 0.9));
      dealEnemyDamage(state, enemy, 16 * meta.power, 0.85 * meta.armor, 0.72);
      hits += 1;
    }
    let vanguardReprisalHits = 0;
    if (state.build.mechanics.vanguardReprisalPulse) {
      for (const enemy of state.enemies) {
        if (!enemy.active || enemy.dead || enemy.statuses.armorBreach <= 0 || Math.hypot(enemy.x - p.x, enemy.y - p.y) > 330 * meta.range) continue;
        enemy.armor = Math.max(0, enemy.armor - 11 * meta.power * meta.armor);
        enemy.statuses.stagger = Math.max(enemy.statuses.stagger, staggerDuration(enemy, 0.35));
        spawnEffect(state, enemy.x, enemy.y, 'impact', 46, 0.3);
        vanguardReprisalHits += 1;
      }
      if (vanguardReprisalHits > 0) p.abilityCooldowns[0] = Math.max(0, p.abilityCooldowns[0] - Math.min(1.8, vanguardReprisalHits * 0.45));
    }
    spawnEffect(state, p.x, p.y, 'pulse', 330 * meta.range, 0.6);
    if (bulkheadWarden && hits > 0) {
      const repair = Math.min(state.build.specializationOverclock ? 14 : 10, hits * (state.build.specializationOverclock ? 3.5 : 2.5));
      p.armor = Math.min(p.maxArmor, p.armor + repair);
    }
    if (bulkheadWarden && state.build.mechanics.vanguardReprisalPulse && vanguardReprisalHits > 0) {
      const counterfortRepair = Math.min(8, vanguardReprisalHits * 1.5);
      p.armor = Math.min(p.maxArmor, p.armor + counterfortRepair);
      state.classState.vanguardGuard = Math.min(8, state.classState.vanguardGuard + Math.min(0.8, vanguardReprisalHits * 0.2));
      if (state.build.specializationOverclock) p.capacitor = Math.min(p.maxCapacitor, p.capacitor + Math.min(9, vanguardReprisalHits * 2.25));
      vanguardCapstoneEvent = `COUNTERFORT // ${vanguardReprisalHits} REPRISAL${vanguardReprisalHits === 1 ? '' : 'S'} // GUARD + ARMOR RECYCLED`;
      spawnCapstoneEffect(state, 'vanguard', p.x, p.y, 190, 0.72);
    }
    if (state.build.mechanics.arcGroundLoop && hits > 0) p.capacitor = Math.min(p.maxCapacitor, p.capacitor + Math.min(14, 4 + hits * 2));
    if (state.build.mechanics.arcCascadeLattice) { p.abilityCooldowns[0] = Math.max(0, p.abilityCooldowns[0] - 0.45); p.abilityCooldowns[1] = Math.max(0, p.abilityCooldowns[1] - 0.45); }
    pushEvent(state, vanguardCapstoneEvent ?? (vanguardReprisalHits > 0 ? `REPRISAL PULSE // ${vanguardReprisalHits} BREACH CONTACT${vanguardReprisalHits === 1 ? '' : 'S'} // RUSH RECYCLED` : bulkheadWarden ? `BULKHEAD WARDEN // IMPACT RECYCLED // ${hits} CONTACT${hits === 1 ? '' : 'S'}` : `BULWARK PULSE // GUARD LOCKED // ${hits} CONTACT${hits === 1 ? '' : 'S'}`), 1.45);
  } else if (state.build.operatorClass === 'vector') {
    const baseDir = norm(p.aim);
    const needleFan = state.build.mechanics.vectorNeedleFan;
    const redlineNeedle = needleFan && state.build.specialization === 'redline-pilot' && p.weaponHeat[p.currentWeapon] >= 0.75;
    const fanAngles = needleFan ? [-0.075, 0, 0.075] : [-0.13, 0, 0.13];
    for (const angle of fanAngles) {
      const c = Math.cos(angle); const sin = Math.sin(angle);
      const dir = { x: baseDir.x * c - baseDir.y * sin, y: baseDir.x * sin + baseDir.y * c };
      const centerLane = needleFan && angle === 0;
      const fanSpeed = (redlineNeedle ? 1850 : needleFan ? 1700 : 1480) * meta.range;
      const fanDamage = 22 * meta.power * (redlineNeedle ? 1.16 : 1) * (centerLane ? (redlineNeedle ? 1.35 : 1.28) : 1);
      const fanPenetration = ((state.build.classResonanceTier >= 2 ? 82 : 68) + (redlineNeedle ? 34 : needleFan ? 20 : 0)) * meta.armor;
      addProjectile(state, p.x + dir.x * 30, p.y + dir.y * 30, dir, fanSpeed, fanDamage, 'player', { weapon: 'rail', penetration: fanPenetration, armorDamage: redlineNeedle ? 1.22 : needleFan ? 1.14 : 1.08, healthMultiplier: 0.96, knockback: 0.07, radius: 4 });
    }
    p.vx -= baseDir.x * 72 / meta.control; p.vy -= baseDir.y * 72 / meta.control;
    if (redlineNeedle) {
      p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - (state.build.specializationOverclock ? 0.16 : 0.12));
      p.dodgeCooldown = Math.max(0, p.dodgeCooldown - (state.build.specializationOverclock ? 0.38 : 0.28));
    }
    if (state.build.mechanics.arcGroundLoop) p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 7);
    if (state.build.mechanics.arcCascadeLattice) { p.abilityCooldowns[0] = Math.max(0, p.abilityCooldowns[0] - 0.45); p.abilityCooldowns[1] = Math.max(0, p.abilityCooldowns[1] - 0.45); }
    spawnEffect(state, p.x + baseDir.x * 60, p.y + baseDir.y * 60, 'impact', redlineNeedle ? 104 : needleFan ? 88 : 75, 0.35);
    if (redlineNeedle) spawnCapstoneEffect(state, 'vector', p.x + baseDir.x * 72, p.y + baseDir.y * 72, 172, 0.6);
    pushEvent(state, redlineNeedle ? 'REDLINE NEEDLE // HOT HYPERVELOCITY FAN // HEAT VENTED' : needleFan ? 'NEEDLE FAN // HYPERVELOCITY CENTERLINE' : 'SPLITSHOT // THREE-LANE KINETIC FAN', 1.35);
  } else {
    const arcRange = (state.build.operatorClass === 'systems' ? 560 : 430) * meta.range;
    const acquiredTarget = targetingIntent === 'acquire'
      ? acquirePreferredCombatTarget(state, { maxDistance: arcRange, aimWeight: 0.4, rangeWeight: 0.3, visibilityPenalty: 0.88 }, preferredTargetId)
      : null;
    if (acquiredTarget) p.aim = acquiredTarget.direction;
    const conduit = findAimConduit(state, 520 * meta.range); const target = acquiredTarget?.enemy ?? targetInAimCone(state, arcRange, 0.14);
    if (conduit) { const cx = conduit.x + conduit.w / 2; const cy = conduit.y + conduit.h / 2; if (conduit.kind === 'anchorNode') { conduit.hp = Math.max(0, conduit.hp - 68 * meta.power); if (conduit.hp <= 0) { conduit.active = false; conduit.exposed = true; pushEvent(state, `${conduit.label.toUpperCase()} SHORTED // ANCHOR FIELD COLLAPSED`, 1.7); } } spawnEffect(state, cx, cy, 'arc', 260, 0.7); let hits = 0; for (const enemy of state.enemies) { if (enemy.dead || !enemy.active || Math.hypot(enemy.x - cx, enemy.y - cy) > 275 * meta.range) continue; enemy.statuses.disrupted = Math.max(enemy.statuses.disrupted, 4.2); enemy.statuses.conductive = Math.max(enemy.statuses.conductive, 5.5); enemy.anchored = false; dealEnemyDamage(state, enemy, 22 * meta.power, 0.75, 1.05); hits += 1; } if (hasTrait(state, 'machineSight')) { const extra = state.enemies.filter(enemy => enemy.active && !enemy.dead && enemy.statuses.disrupted > 0 && Math.hypot(enemy.x - cx, enemy.y - cy) > 275 * meta.range && Math.hypot(enemy.x - cx, enemy.y - cy) < 560 * meta.range).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0]; if (extra) { extra.statuses.conductive = Math.max(extra.statuses.conductive, 4.5); dealEnemyDamage(state, extra, 18 * meta.power, 0.65, 1); spawnEffect(state, extra.x, extra.y, 'arc', 64, 0.5); hits += 1; } } let markCooldownAdvance = 0; let magCooldownAdvance = 0; if (state.build.specialization === 'grid-weaver') { const remote = state.enemies.filter(enemy => enemy.active && !enemy.dead && Math.hypot(enemy.x - cx, enemy.y - cy) > 275 * meta.range && Math.hypot(enemy.x - cx, enemy.y - cy) < 520).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0]; if (remote) { remote.statuses.marked = Math.max(remote.statuses.marked, 4.2); if (state.build.mechanics.systemsReturnCurrent) { remote.statuses.disrupted = Math.max(remote.statuses.disrupted, 2.8); remote.statuses.conductive = Math.max(remote.statuses.conductive, 4.8); systemsGridReturnNodes = 1; markCooldownAdvance = Math.max(markCooldownAdvance, 0.5); } spawnEffect(state, remote.x, remote.y, 'mark', 42, 0.45); } if (state.build.specializationOverclock) markCooldownAdvance = Math.max(markCooldownAdvance, 0.8); const referenceShear = state.hazards.filter(hazard => hazard.active && hazard.owner !== 'player' && (hazard.kind === 'gravityWell' || hazard.kind === 'vectorWash') && Math.hypot(hazard.x - cx, hazard.y - cy) < 420).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0]; if (referenceShear) { referenceShear.active = false; p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 4); spawnEffect(state, referenceShear.x, referenceShear.y, 'arc', referenceShear.radius, 0.45); } } if (hasTrait(state, 'relayOrchard')) { let marked = 0; for (const enemy of state.enemies.filter(enemy => enemy.active && !enemy.dead && Math.hypot(enemy.x - cx, enemy.y - cy) < 420).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))) { enemy.statuses.marked = Math.max(enemy.statuses.marked, 3.8); spawnEffect(state, enemy.x, enemy.y, 'mark', 38, 0.4); marked += 1; if (marked >= 2) break; } markCooldownAdvance = Math.max(markCooldownAdvance, 0.55); } if (state.build.mechanics.arcCascadeLattice) { magCooldownAdvance = Math.max(magCooldownAdvance, 0.65); markCooldownAdvance = Math.max(markCooldownAdvance, 0.65); } if (magCooldownAdvance > 0) p.abilityCooldowns[0] = Math.max(0, p.abilityCooldowns[0] - magCooldownAdvance); if (markCooldownAdvance > 0) p.abilityCooldowns[1] = Math.max(0, p.abilityCooldowns[1] - markCooldownAdvance); if (hasTrait(state, 'lockstepArc')) { p.armor = Math.min(p.maxArmor, p.armor + 14); p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 10); } if (hasTrait(state, 'gridReclaimer')) { const hostileGrid = state.hazards.filter(hazard => hazard.active && hazard.kind === 'shockGrid' && Math.hypot(hazard.x - cx, hazard.y - cy) < 390).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0]; if (hostileGrid) { hostileGrid.active = false; p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 10); p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - 0.08); pushEvent(state, 'GRID RECLAIMER // HOSTILE ARC FIELD REROUTED TO OPERATOR BUS', 1.5); } } if (state.build.mechanics.systemsReturnCurrent) systemsReturnNodes = hits + systemsGridReturnNodes; if (state.build.mechanics.arcGroundLoop) p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 18); pushEvent(state, hits > 0 ? `${state.build.operatorClass === 'systems' ? 'CASCADE ARC' : 'ARC TAP'} // CONDUIT PROPAGATION // ${hits} TARGET${hits === 1 ? '' : 'S'}` : `${state.build.operatorClass === 'systems' ? 'CASCADE ARC' : 'ARC TAP'} // CONDUIT ENERGIZED // NO TARGET IN PATH`, 1.7); }
    else if (target) { const wasMarked = target.statuses.marked > 0; const bonus = wasMarked || target.statuses.conductive > 0; target.statuses.disrupted = Math.max(target.statuses.disrupted, bonus ? 4.5 : 2.2); target.statuses.conductive = Math.max(target.statuses.conductive, 4.5); target.anchored = false; dealEnemyDamage(state, target, (bonus ? 24 : 14) * meta.power, bonus ? 0.95 : 0.5, 1); if (state.build.operatorClass === 'systems') { let chainedTargets = 0; for (const secondary of state.enemies.filter(enemy => enemy.active && !enemy.dead && enemy.id !== target.id && Math.hypot(enemy.x - target.x, enemy.y - target.y) < 340 * meta.range).sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))) { secondary.statuses.disrupted = Math.max(secondary.statuses.disrupted, 3.2); secondary.statuses.conductive = Math.max(secondary.statuses.conductive, 4.2); dealEnemyDamage(state, secondary, 11 * meta.power, 0.62, 0.9); spawnEffect(state, secondary.x, secondary.y, 'arc', 58, 0.48); chainedTargets += 1; if (chainedTargets >= (state.build.classResonanceTier >= 2 ? 2 : 1) + meta.chainBonus) break; } if (state.build.mechanics.systemsReturnCurrent) systemsReturnNodes = 1 + chainedTargets; } if (hasTrait(state, 'splitReference') && wasMarked && !target.dead) { const relay = state.objects.filter(object => object.active && (object.kind === 'conduit' || object.kind === 'anchorNode') && Math.hypot(object.x + object.w / 2 - target.x, object.y + object.h / 2 - target.y) < 300).sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))[0]; if (relay) { target.statuses.marked = 0; const cx = relay.x + relay.w / 2; const cy = relay.y + relay.h / 2; const second = state.enemies.filter(enemy => enemy.active && !enemy.dead && enemy.id !== target.id && Math.hypot(enemy.x - cx, enemy.y - cy) < 340).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0]; if (second) { second.statuses.disrupted = Math.max(second.statuses.disrupted, 3); second.statuses.conductive = Math.max(second.statuses.conductive, 4); dealEnemyDamage(state, second, 12, 0.55, 0.85); spawnEffect(state, second.x, second.y, 'arc', 56, 0.45); } } } spawnEffect(state, target.x, target.y, 'arc', 90, 0.55); pushEvent(state, state.build.operatorClass === 'systems' ? (bonus ? 'CASCADE ARC // STATUS NETWORK AMPLIFIED' : 'CASCADE ARC // HOSTILE NETWORK BRIDGED') : bonus ? 'ARC TAP // STATUS COUPLING AMPLIFIED' : 'ARC TAP // LOCAL DISRUPTION', 1.4); }
    else { p.capacitor = Math.min(p.maxCapacitor, p.capacitor + meta.cost * 0.55); p.abilityCooldowns[index] = 1.3; pushEvent(state, state.build.operatorClass === 'systems' ? 'CASCADE ARC // NO NETWORK PATH' : 'ARC TAP // NO CONDUCTIVE PATH', 1.1); }
    if (state.build.operatorClass === 'systems' && state.build.mechanics.systemsReturnCurrent && systemsReturnNodes > 0) {
      const returnCap = Math.min(16, systemsReturnNodes * 4);
      p.capacitor = Math.min(p.maxCapacitor, p.capacitor + returnCap);
      p.abilityCooldowns[0] = Math.max(0, p.abilityCooldowns[0] - Math.min(1.6, systemsReturnNodes * 0.35));
      if (state.build.specialization === 'grid-weaver' && systemsGridReturnNodes > 0) {
        p.abilityCooldowns[1] = Math.max(0, p.abilityCooldowns[1] - 0.5);
        systemsCapstoneEvent = `MESH REFLUX // ${systemsReturnNodes} RETURN NODES // HACK RECYCLED`;
        spawnCapstoneEffect(state, 'systems', p.x, p.y, 176, 0.7);
      }
      pushEvent(state, systemsCapstoneEvent ?? `RETURN CURRENT // ${systemsReturnNodes} NODE${systemsReturnNodes === 1 ? '' : 'S'} // +${returnCap} CAP // WELL RECYCLED`, 1.45);
    }
  }
  const pressureSector = currentSector(state, p.x, p.y); if (state.build.specialization === 'pressure-diver' && pressureSector.pressure < 0.45) p.vacuumExposure = Math.max(0, p.vacuumExposure - (state.build.specializationOverclock ? 0.8 : 0.4));
  if (chained) { state.abilityChain = Math.min(2, state.abilityChain + 1); if (state.build.operatorClass === 'systems') { if (previousAbility >= 0) p.abilityCooldowns[previousAbility] = Math.max(0, p.abilityCooldowns[previousAbility] - (state.build.classResonanceTier >= 2 ? 0.55 : state.build.classResonanceTier >= 1 ? 0.35 : 0.22)); state.classState.systemsLinks = Math.min(2, state.classState.systemsLinks + 1); if (state.classState.systemsLinks >= 2) { p.capacitor = Math.min(p.maxCapacitor, p.capacitor + (state.build.classResonanceTier >= 2 ? 10 : state.build.classResonanceTier >= 1 ? 7 : 5)); p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - (state.build.classResonanceTier >= 2 ? 0.08 : state.build.classResonanceTier >= 1 ? 0.05 : 0.03)); state.classState.systemsLinks = 0; pushEvent(state, 'SYSTEMS CLOSED LOOP // THREE-LINK CYCLE RECYCLED', 1.2); } else pushEvent(state, 'SYSTEMS CLOSED LOOP // LINK BANKED', 1.0); } if (state.build.specialization === 'capacitor-conductor') { const desiredRefund = state.build.specializationOverclock && state.abilityChain >= 2 ? 8 : 6; const existingRecovery = Math.max(0, p.capacitor - capacitorAfterCost); const refund = Math.max(0, Math.min(desiredRefund, 8 - Math.min(8, existingRecovery))); if (refund > 0) p.capacitor = Math.min(p.maxCapacitor, p.capacitor + refund); if (state.abilityChain >= 2) { const referenceShear = state.hazards.filter(hazard => hazard.active && hazard.owner !== 'player' && (hazard.kind === 'gravityWell' || hazard.kind === 'vectorWash') && Math.hypot(hazard.x - p.x, hazard.y - p.y) < 360).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]; if (referenceShear) { referenceShear.active = false; spawnEffect(state, referenceShear.x, referenceShear.y, 'arc', referenceShear.radius, 0.42); } for (const enemy of state.enemies) if (enemy.active && !enemy.dead && isParallaxReferenceEnemy(enemy) && Math.hypot(enemy.x - p.x, enemy.y - p.y) < 520) enemy.statuses.disrupted = Math.max(enemy.statuses.disrupted, state.build.specializationOverclock ? 3 : 2.2); } if (state.build.specializationOverclock && state.abilityChain >= 2) p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - 0.08); } if (hasTrait(state, 'abilityRosary')) { p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - 0.06); if (previousAbility >= 0) p.abilityCooldowns[previousAbility] = Math.max(0, p.abilityCooldowns[previousAbility] - 0.3); } } else { state.abilityChain = 0; if (state.build.operatorClass === 'systems') state.classState.systemsLinks = 0; }
  if (thermalShunterHeat >= 0.35) { const inductionSink = index === 0 && state.build.mechanics.systemsAnchorLattice && systemsAnchorContacts > 0; const baseShunt = state.build.specializationOverclock ? 0.1 : 0.08; const bonusShunt = inductionSink ? Math.min(0.04, systemsAnchorContacts * 0.02) : 0; const shuntedHeat = Math.min(thermalShunterHeat, baseShunt + bonusShunt); p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - shuntedHeat); state.classState.systemsCrossfeed = inductionSink ? (state.build.specializationOverclock ? 4 : 3.6) : state.build.specializationOverclock ? 3 : 2.6; pushEvent(state, inductionSink ? `INDUCTION SINK // ${systemsAnchorContacts} NODE${systemsAnchorContacts === 1 ? '' : 'S'} // ${Math.round(shuntedHeat * 100)}% HEAT ROUTED // CROSSFIRE OVERCHARGED` : `THERMAL SHUNTER // ${Math.round(shuntedHeat * 100)}% HEAT ROUTED // CROSSFIRE ARMED`, 1.3); }
  state.lastAbilityIndex = index; state.lastAbilityAt = state.time;
  return true;
}

function calibratedGravityForSector(sector: Sector, fallback: number) {
  const calibratedGravity: Record<string, number> = { 'SPIN DECK': 1, 'TRANSFER BAY': 0.34, 'FORE HAB': 0.28, 'CARGO SPINE': 0.08, 'CRUSHER DECK': 0.62, 'ORE TRANSFER': 0.46, 'RIM HAB': 1.02, 'SPOKE TRANSIT': 0.42, 'PRESSURE LOCK': 0.55, 'SKIMMER DECK': 0.24, 'ACCESS BORE': 0.34, 'EXTRACTION TUNNEL': 0.22, 'SHADE GANTRY': 0.45, 'FABRICATION SPINE': 0.28, 'BRAKE DECK': 0.32, 'TRANSFER TUNNEL': 0.05, 'SERVICE COLLAR': 0.38, 'PROPELLANT GALLERY': 0.16 };
  return calibratedGravity[sector.label] ?? fallback;
}

export function getContextAction(state: SimState) {
  const p = state.player;
  let nearest: CombatObject | null = null;
  let best = 125;

  for (const object of state.objects) {
    if (!object.active) continue;
    const interactive = object.kind === 'doorControl'
      || object.kind === 'gravityControl'
      || object.kind === 'sealControl'
      || object.kind === 'powerControl'
      || object.kind === 'salvageNode';
    if (!interactive) continue;
    if ((object.kind === 'powerControl' || object.kind === 'salvageNode') && object.exposed) continue;
    if ((object.id === 'gravity-control-a' || object.id === 'gravity-control-b' || object.id === 'boarding-lock' || object.id === 'solar-shutter' || object.id === 'capture-drum-a' || object.id === 'capture-drum-b' || object.id === 'purge-valve-a' || object.id === 'purge-valve-b' || object.id.startsWith('reference-node-')) && object.exposed) continue;
    if (object.id === 'service-seal' && object.exposed) { const serviceBreach = state.breaches.find(item => item.id === 'service-breach'); if (!serviceBreach?.active) continue; }
    if (object.id === 'boss-seal' && !state.bossActive) continue;

    const distance = distanceToRect(p.x, p.y, object);
    if (distance < best) { best = distance; nearest = object; }
  }

  if (!nearest) return null;
  if (nearest.id === 'solar-shutter') return { id: nearest.id, label: 'CLOSE LOCAL THERMAL SHUTTERS' };
  if (nearest.id === 'capture-drum-a' || nearest.id === 'capture-drum-b') return { id: nearest.id, label: `LOAD ${nearest.label.toUpperCase()}` };
  if (nearest.id === 'purge-valve-a' || nearest.id === 'purge-valve-b') return { id: nearest.id, label: `ROUTE ${nearest.label.toUpperCase()}` };
  if (nearest.id.startsWith('reference-node-')) return { id: nearest.id, label: `ALIGN ${nearest.label.toUpperCase()}` };
  if (nearest.kind === 'powerControl') return { id: nearest.id, label: `ISOLATE ${nearest.label.toUpperCase()}` };
  if (nearest.kind === 'salvageNode') return { id: nearest.id, label: `TAG ${nearest.label.toUpperCase()}` };
  if (nearest.id === 'boarding-lock') return { id: nearest.id, label: 'CYCLE CARGO PRESSURE INTERLOCK' };
  if (nearest.id === 'service-seal') { const breach = state.breaches.find(item => item.id === 'service-breach'); return { id: nearest.id, label: breach?.active ? 'SEAL SERVICE RUPTURE' : 'PRESSURE MANIFOLD SECURE' }; }
  if (nearest.kind === 'doorControl') { const link = state.links.find(item => item.id === 'door-ab'); return { id: nearest.id, label: link?.open ? 'CLOSE PRESSURE DOOR' : 'OPEN PRESSURE DOOR' }; }
  if (nearest.kind === 'gravityControl') {
    if (nearest.id === 'gravity-control-a') return { id: nearest.id, label: 'CALIBRATE DECK GRAVITY' };
    if (nearest.id === 'gravity-control-b') return { id: nearest.id, label: 'CALIBRATE TRANSFER GRAVITY' };
    const sector = state.sectors.find(item => item.id === 'B');
    const restoreGravity = sector ? calibratedGravityForSector(sector, 0.34) : 0.34;
    return { id: nearest.id, label: sector && sector.gravity < 0.1 ? `RESTORE ${restoreGravity.toFixed(2)}G` : 'SPINDOWN TO 0.05G' };
  }
  const breach = state.breaches.find(item => item.id === 'boss-breach');
  return { id: nearest.id, label: breach?.active ? 'SEAL HULL SHUTTER' : 'SHUTTER STANDBY' };
}

export function triggerInteract(state: SimState) {
  const action = getContextAction(state);
  if (!action) return false;
  const object = state.objects.find(item => item.id === action.id);
  if (!object) return false;

  if (action.id === 'solar-shutter') { object.exposed = true; pushEvent(state, 'LOCAL THERMAL SHUTTERS CLOSED // RADIANT LOAD CUT', 1.8); return true; }
  if (action.id === 'capture-drum-a' || action.id === 'capture-drum-b') { object.exposed = true; const sector = state.sectors.find(item => item.id === (action.id.endsWith('-a') ? 'A' : 'B')); if (sector) sector.gravity = action.id.endsWith('-a') ? 0.32 : 0.05; for (const hazard of state.hazards) if (hazard.active && hazard.kind === 'vectorWash') hazard.active = false; pushEvent(state, `${object.label.toUpperCase()} // COUNTER-MOMENTUM REFERENCE LOADED`, 1.8); return true; }
  if (action.id === 'purge-valve-a' || action.id === 'purge-valve-b') { object.exposed = true; for (const hazard of state.hazards) if (hazard.active && hazard.kind === 'boiloffJet') hazard.active = false; const sector = state.sectors.find(item => item.id === 'B'); if (sector) sector.targetPressure = Math.max(sector.targetPressure, 0.68); pushEvent(state, `${object.label.toUpperCase()} // BOILOFF ROUTED CLEAR OF SERVICE GALLERY`, 1.8); return true; }
  if (action.id.startsWith('reference-node-')) { object.exposed = true; const sectorId = action.id.endsWith('-a') ? 'A' : action.id.endsWith('-b') ? 'B' : 'C'; const sector = state.sectors.find(item => item.id === sectorId); if (sector) sector.gravity = sectorId === 'A' ? 0.48 : sectorId === 'B' ? 0.18 : 0.22; for (const hazard of state.hazards) if (hazard.active && hazard.kind === 'vectorWash') hazard.active = false; pushEvent(state, `${object.label.toUpperCase()} // PHYSICAL BASELINE ALIGNED`, 1.8); return true; }
  if (object.kind === 'powerControl') {
    object.exposed = true;
    let disabled = 0;
    for (const hazard of state.hazards) { if (hazard.active && hazard.kind === 'shockGrid') { hazard.active = false; disabled += 1; } }
    pushEvent(state, `GRID BRANCH ISOLATED${disabled > 0 ? ` // ${disabled} ARC FIELD${disabled === 1 ? '' : 'S'} DROPPED` : ''}`, 1.6);
    return true;
  }
  if (object.kind === 'salvageNode') { object.exposed = true; pushEvent(state, `${object.label.toUpperCase()} // RECOVERY TAG LOCKED`, 1.4); return true; }
  if (action.id === 'boarding-lock') { object.exposed = true; pushEvent(state, 'CARGO PRESSURE INTERLOCK CYCLED // BOARDING ROUTE SECURED', 1.6); return true; }
  if (action.id === 'service-seal') { const breach = state.breaches.find(item => item.id === 'service-breach'); if (breach?.active) sealBreach(state, 'service-breach'); object.exposed = true; if (hasTrait(state, 'pressureMantle')) { state.player.armor = Math.min(state.player.maxArmor, state.player.armor + 16); state.player.vacuumExposure = 0; } pushEvent(state, 'SERVICE MANIFOLD SEALED // PRESSURE RECOVERY ACTIVE', 1.8); return true; }
  if (action.id === 'door-control') { const link = state.links.find(item => item.id === 'door-ab'); if (!link) return false; link.open = !link.open; object.exposed = true; if (hasTrait(state, 'pressureMantle')) { state.player.armor = Math.min(state.player.maxArmor, state.player.armor + 10); state.player.vacuumExposure = Math.max(0, state.player.vacuumExposure - 1); } pushEvent(state, link.open ? 'PRESSURE DOOR A-B OPEN' : 'PRESSURE DOOR A-B SEALED'); return true; }
  if (action.id === 'gravity-control-a' || action.id === 'gravity-control-b') { const sectorId = action.id === 'gravity-control-a' ? 'A' : 'B'; const sector = state.sectors.find(item => item.id === sectorId); if (!sector) return false; sector.gravity = calibratedGravityForSector(sector, sectorId === 'A' ? 0.72 : 0.46); object.exposed = true; pushEvent(state, `${sector.label.toUpperCase()} GRAVITY CALIBRATED // ${sector.gravity.toFixed(2)}G`, 1.6); return true; }
  if (action.id === 'gravity-control') { const sector = state.sectors.find(item => item.id === 'B'); if (!sector) return false; const restoreGravity = calibratedGravityForSector(sector, 0.34); sector.gravity = sector.gravity < 0.1 ? restoreGravity : 0.05; pushEvent(state, `TRANSFER SPIN ${sector.gravity < 0.1 ? 'OFFLINE // 0.05G' : `RESTORED // ${sector.gravity.toFixed(2)}G`}`); return true; }
  if (action.id === 'boss-seal') { const breach = state.breaches.find(item => item.id === 'boss-breach'); if (breach?.active) { sealBreach(state, 'boss-breach'); return true; } pushEvent(state, 'EMERGENCY SHUTTER // NO ACTIVE BREACH', 1.1); }
  return false;
}

function stepPressure(state: SimState, dt: number) {
  for (const sector of state.sectors) { const breach = state.breaches.find(item => item.sectorId === sector.id && item.active); if (sector.rapidTimer > 0) sector.rapidTimer = Math.max(0, sector.rapidTimer - dt); if (breach) { const drain = sector.rapidTimer > 0 ? 0.21 : 0.055; sector.pressure = Math.max(0, sector.pressure - drain * dt * breach.strength / 980); sector.targetPressure = 0; } else if (sector.pressure < sector.targetPressure) sector.pressure = Math.min(sector.targetPressure, sector.pressure + 0.045 * dt); }
  for (const link of state.links) { if (!link.open) continue; const a = state.sectors.find(item => item.id === link.a); const b = state.sectors.find(item => item.id === link.b); if (!a || !b) continue; const flow = (a.pressure - b.pressure) * link.conductance * dt; a.pressure = clamp(a.pressure - flow, 0, 1); b.pressure = clamp(b.pressure + flow, 0, 1); }
  for (const sector of state.sectors) sector.pressureState = sectorState(sector);
}
function stepStatuses(enemy: Enemy, dt: number) { enemy.statuses.armorBreach = Math.max(0, enemy.statuses.armorBreach - dt); enemy.statuses.disrupted = Math.max(0, enemy.statuses.disrupted - dt); enemy.statuses.marked = Math.max(0, enemy.statuses.marked - dt); enemy.statuses.stagger = Math.max(0, enemy.statuses.stagger - dt); enemy.statuses.conductive = Math.max(0, enemy.statuses.conductive - dt); enemy.statuses.vacuum = Math.max(0, enemy.statuses.vacuum - dt); }

function stepPlayer(state: SimState, dt: number) {
  const p = state.player; const sector = currentSector(state, p.x, p.y); state.classState.vanguardGuard = Math.max(0, state.classState.vanguardGuard - dt); state.classState.vectorWindow = Math.max(0, state.classState.vectorWindow - dt); state.classState.systemsCrossfeed = Math.max(0, state.classState.systemsCrossfeed - dt); p.fireCooldown = Math.max(0, p.fireCooldown - dt); p.abilityCooldowns = p.abilityCooldowns.map(value => Math.max(0, value - dt)) as [number, number, number]; p.dodgeCooldown = Math.max(0, p.dodgeCooldown - dt); p.dodgeTime = Math.max(0, p.dodgeTime - dt); p.invulnerable = Math.max(0, p.invulnerable - dt); p.consumableCooldown = Math.max(0, p.consumableCooldown - dt); p.disrupted = Math.max(0, p.disrupted - dt); if (p.ventT > 0) p.ventT = Math.max(0, p.ventT - dt);
  for (const id of ['carbine', 'breacher', 'rail'] as WeaponId[]) { const config = getWeaponConfig(state, id); const ventBonus = p.ventT > 0 && id === p.currentWeapon ? 3.4 : 1; p.weaponHeat[id] = Math.max(0, p.weaponHeat[id] - config.heatDissipation * ventBonus * dt); }
  if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) { p.reloadT = 0; p.mags[p.reloadWeapon] = getWeaponConfig(state, p.reloadWeapon).magazine; } }
  if (p.ventT <= 0 && p.disrupted <= 0) p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 13.5 * state.build.player.capRegenMul * dt); const siphon = state.objects.find(object => object.active && object.kind === 'anchorNode' && object.id.includes('siphon') && object.hp > 0 && Math.hypot(object.x + object.w / 2 - p.x, object.y + object.h / 2 - p.y) < 310); if (siphon) p.capacitor = Math.max(0, p.capacitor - 8 * dt);
  if (sector.pressure < 0.18) { p.vacuumExposure += dt * (1 - state.build.player.vacuumResistance * 0.55); if (p.vacuumExposure > 1.8 + state.build.player.vacuumResistance * 2.4) applyPlayerDamage(state, 3.2 * (1 - state.build.player.vacuumResistance * 0.78) * dt, 1); } else p.vacuumExposure = Math.max(0, p.vacuumExposure - dt * 1.8);
  applyPressureForce(state, p, sector.id, dt, 0.48 * (1 - state.build.player.vacuumResistance * 0.45));
  if (!p.dead && p.dodgeTime <= 0) { const glasswalker = hasTrait(state, 'glasswalker') && sector.pressure < 0.18; const redlineMove = state.build.specialization === 'redline-pilot' && p.weaponHeat[p.currentWeapon] >= 0.75; const accel = lerp(880, 1210, sector.gravity) * (glasswalker ? 1.22 : 1) * (redlineMove ? 1.05 : 1); const handling = weaponHandlingProfiles[p.currentWeapon]; const shotMoveScale = p.fireCooldown > 0 ? handling.postShotMoveScale : 1; const maxSpeed = 278 * state.build.player.moveSpeedMul * (glasswalker ? 1.18 : 1) * (redlineMove ? 1.08 : 1) * shotMoveScale; const actionMoveScale = p.ventT > 0 ? handling.ventMoveScale : p.reloadT > 0 ? handling.reloadMoveScale : 1; const mobilityScale = actionMoveScale * (p.disrupted > 0 ? 0.82 : 1); p.vx += p.move.x * accel * mobilityScale * state.build.player.moveSpeedMul * dt; p.vy += p.move.y * accel * mobilityScale * state.build.player.moveSpeedMul * dt; const speed = Math.hypot(p.vx, p.vy); if (speed > maxSpeed) { p.vx *= maxSpeed / speed; p.vy *= maxSpeed / speed; } const damping = Math.pow(Math.max(0.0009, lerp(0.48, 0.0009, sector.gravity) - (sector.gravity < 0.35 ? state.build.player.lowGControl * 0.16 : 0)), dt); p.vx *= damping; p.vy *= damping; } else if (p.dodgeTime <= 0) { p.vx *= Math.pow(0.06, dt); p.vy *= Math.pow(0.06, dt); }
  p.x += p.vx * dt; p.y += p.vy * dt; p.x = clamp(p.x, 105, world.w - 105); p.y = clamp(p.y, 185, world.h - 125); for (const object of state.objects) if (isSolidObject(object)) resolveCircleRect(p, playerRadius, object);
}

function pressureRetreatVector(state: SimState, enemy: Enemy) { const sector = currentSector(state, enemy.x, enemy.y); if (protocolIgnoresPressureRetreat(enemy)) return { x: 0, y: 0 }; if (sector.pressure > 0.38) return { x: 0, y: 0 }; const breach = nearestActiveBreach(state, sector.id); if (!breach) return { x: -1, y: 0 }; return norm({ x: enemy.x - breach.x, y: enemy.y - breach.y }); }
function findCoverPoint(state: SimState, enemy: Enemy) { const p = state.player; let best: Vec2 | null = null; let score = 99999; for (const object of state.objects) { if (!object.active || object.kind !== 'cover') continue; const cx = object.x + object.w / 2; const cy = object.y + object.h / 2; const dEnemy = Math.hypot(cx - enemy.x, cy - enemy.y); if (dEnemy > 430) continue; const fromPlayer = norm({ x: cx - p.x, y: cy - p.y }); const point = { x: cx + fromPlayer.x * (Math.max(object.w, object.h) * 0.65 + 40), y: cy + fromPlayer.y * (Math.max(object.w, object.h) * 0.65 + 40) }; const localScore = dEnemy - Math.hypot(point.x - p.x, point.y - p.y) * 0.12; if (localScore < score) { score = localScore; best = point; } } return best; }
function fireEnemyShot(state: SimState, enemy: Enemy, speed: number, damage: number, spread = 0) { const count = spread > 0.05 ? 3 : 1; for (let i = 0; i < count; i += 1) { const angle = count === 1 ? 0 : (i - 1) * spread; const c = Math.cos(angle); const s = Math.sin(angle); const dir = { x: enemy.telegraphAim.x * c - enemy.telegraphAim.y * s, y: enemy.telegraphAim.x * s + enemy.telegraphAim.y * c }; addProjectile(state, enemy.x + dir.x * 26, enemy.y + dir.y * 26, dir, speed, damage, 'enemy', { weapon: 'enemy', armorDamage: 0.5, healthMultiplier: 1, radius: enemy.role === 'boss' ? 7 : 6 }); } }
function plantHazard(state: SimState, x: number, y: number, kind: Hazard['kind'], life: number, owner?: Hazard['owner']) { const hazard = state.hazards.find(item => !item.active); if (!hazard) return; Object.assign(hazard, { active: true, x, y, radius: kind === 'gravityWell' ? 185 : kind === 'vectorWash' ? 210 : kind === 'boiloffJet' ? 170 : kind === 'vacuumWake' ? 165 : kind === 'coolantJet' ? 150 : 120, life, kind, owner: owner ?? (kind === 'vacuumWake' ? 'player' : kind === 'coolantJet' || kind === 'vectorWash' || kind === 'boiloffJet' ? 'environment' : 'enemy') }); }
function stepCommandTargetMutations(state: SimState, boss: Enemy, dt: number) {
  if (!state.bossActive || boss.dead || boss.commandTargetMutations.length === 0) return;
  const cadenceScale = commandTargetFireCadenceScale(boss);
  if (cadenceScale > 1) boss.fireCooldown = Math.max(0, boss.fireCooldown - dt * (cadenceScale - 1));

  const periodic = commandTargetPulseDefinitions(boss);
  if (periodic.length === 0) return;
  boss.commandMutationCooldown = Math.max(0, boss.commandMutationCooldown - dt);
  if (boss.commandMutationCooldown > 0) return;

  const p = state.player;
  periodic.slice(0, 2).forEach((definition, index) => {
    if (!definition.pulseKind) return;
    const side = index === 0 ? 1 : -1;
    const x = clamp(p.x + p.vx * (definition.pulseLead ?? 0.35) + side * index * 120, 150, world.w - 150);
    const y = clamp(p.y + p.vy * (definition.pulseLead ?? 0.35) - side * index * 72, 205, world.h - 145);
    plantHazard(state, x, y, definition.pulseKind, definition.pulseKind === 'shockGrid' ? 4.8 : 4.5);
  });
  boss.commandMutationCooldown = Math.max(5.2, Math.min(...periodic.map(definition => definition.pulseInterval ?? 8)));
  spawnEffect(state, boss.x, boss.y, 'pulse', 165, 0.46);
  const packageNames = boss.commandTargetMutations.map(id => commandTargetMutationDefinition(id).shortName).join(' + ');
  pushEvent(state, `COMMAND PACKAGE // ${packageNames} // WHOLE-FIGHT SYSTEM PULSE`, 2);
}

function stepBossPhaseMutations(state: SimState, boss: Enemy, dt: number, previousPhase: 1 | 2) {
  if (!state.bossActive || boss.dead || boss.bossPhaseMutations.length === 0) return;
  const transitioned = previousPhase === 1 && boss.bossPhase === 2;
  const p = state.player;

  if (transitioned) {
    for (const id of boss.bossPhaseMutations) {
      if (id === 'rupture-crown') {
        const sector = currentSector(state, boss.x, boss.y);
        sector.pressure = Math.max(0.24, sector.pressure - 0.2);
        sector.targetPressure = Math.min(sector.targetPressure, 0.58);
        sector.rapidTimer = Math.max(sector.rapidTimer, 2.8);
        plantHazard(state, clamp(p.x + p.vx * 0.48, 150, world.w - 150), clamp(p.y + p.vy * 0.48, 205, world.h - 145), 'vectorWash', 4.8, 'environment');
      } else if (id === 'redline-sequence') {
        boss.fireCooldown = Math.min(boss.fireCooldown, 0.42);
      } else if (id === 'countermass-halo') {
        plantHazard(state, clamp(p.x + p.vx * 0.42, 150, world.w - 150), clamp(p.y + p.vy * 0.42, 205, world.h - 145), 'gravityWell', 5);
      } else if (id === 'relay-tempest') {
        plantHazard(state, clamp(p.x + p.vx * 0.34, 150, world.w - 150), clamp(p.y + p.vy * 0.34, 205, world.h - 145), 'shockGrid', 5.2);
        plantHazard(state, clamp(p.x - 135, 150, world.w - 150), clamp(p.y + 80, 205, world.h - 145), 'shockGrid', 4.5);
      }
    }
    const periodic = bossPhasePulseDefinitions(boss);
    boss.bossMutationCooldown = periodic.length > 0 ? Math.min(...periodic.map(definition => definition.pulseInterval ?? 7)) * 0.62 : 999;
    spawnEffect(state, boss.x, boss.y, 'pulse', 230, 0.7);
    const inherited = state.eventT > 0 ? state.eventText : `${boss.label.toUpperCase()} // PHASE TWO`;
    pushEvent(state, `${inherited} // PHASE MUTATION ONLINE`, Math.max(3.2, state.eventT));
  }

  if (boss.bossPhase !== 2) return;
  const cadenceScale = bossPhaseFireCadenceScale(boss);
  if (cadenceScale > 1) boss.fireCooldown = Math.max(0, boss.fireCooldown - dt * (cadenceScale - 1));

  const periodic = bossPhasePulseDefinitions(boss);
  if (periodic.length === 0) return;
  boss.bossMutationCooldown = Math.max(0, boss.bossMutationCooldown - dt);
  if (boss.bossMutationCooldown > 0) return;

  periodic.slice(0, 2).forEach((definition, index) => {
    if (!definition.pulseKind) return;
    const side = index === 0 ? 1 : -1;
    const x = clamp(p.x + p.vx * (definition.pulseLead ?? 0.35) + side * index * 125, 150, world.w - 150);
    const y = clamp(p.y + p.vy * (definition.pulseLead ?? 0.35) - side * index * 70, 205, world.h - 145);
    plantHazard(state, x, y, definition.pulseKind, definition.pulseKind === 'shockGrid' ? 4.6 : 4.3);
  });
  boss.bossMutationCooldown = Math.max(4.8, Math.min(...periodic.map(definition => definition.pulseInterval ?? 7)));
  spawnEffect(state, boss.x, boss.y, 'pulse', 150, 0.45);
}
function isParallaxReferenceEnemy(enemy: Enemy) { return enemy.variant === 'parallaxSkirmisher' || enemy.variant === 'referenceTech' || enemy.variant === 'baselineMarksman' || enemy.variant === 'baselineKeeper'; }
function activateBarrier(state: SimState, prefix: string, x?: number, y?: number) { const barrier = state.objects.find(object => object.id.startsWith(prefix) && !object.active && object.hp > 0); if (!barrier) return false; barrier.active = true; if (typeof x === 'number') barrier.x = clamp(x, 830, 1370); if (typeof y === 'number') barrier.y = clamp(y, 225, 820); return true; }
function tetherForEnemy(state: SimState, enemy: Enemy) { return state.objects.find(object => object.id.startsWith('enemy-tether') && object.active && object.label.endsWith(`#${enemy.id}`)) ?? null; }
function deploySupportNode(state: SimState, prefix: string, enemy: Enemy, label: string) { const node = state.objects.find(object => object.id.startsWith(prefix) && !object.active && object.hp > 0); if (!node) return false; node.active = true; node.exposed = true; node.label = label; node.x = clamp(state.player.x + enemy.strafeSign * 120 - node.w / 2, 180, world.w - 180); node.y = clamp(state.player.y + 70 - node.h / 2, 210, world.h - 160); return true; }
function deployEnemyTether(state: SimState, enemy: Enemy) { const node = state.objects.find(object => object.id.startsWith('enemy-tether') && !object.active && object.hp > 0); if (!node) return false; const p = state.player; node.active = true; node.exposed = true; node.label = `Mag tether coupling #${enemy.id}`; node.hp = node.maxHp; node.x = clamp(p.x + (enemy.x - p.x) * 0.35 - node.w / 2, 120, world.w - 160); node.y = clamp(p.y + (enemy.y - p.y) * 0.35 - node.h / 2, 190, world.h - 150); return true; }
function deployCarrierDrone(state: SimState, enemy: Enemy) { const drone = state.enemies.find(item => (item.id === 9 || item.id === 10) && !item.active && !item.dead); if (!drone) return false; drone.active = true; drone.x = clamp(enemy.x + enemy.strafeSign * 65, 120, world.w - 120); drone.y = clamp(enemy.y + 55, 190, world.h - 130); drone.fireCooldown = 0.8; drone.hazardCooldown = 1.8; return true; }
function repairTacticalHardware(state: SimState, enemy: Enemy) { const target = state.objects.filter(object => !object.id.startsWith('enemy-tether') && (object.kind === 'conduit' || object.kind === 'anchorNode') && object.hp > 0 && (object.hp < object.maxHp || !object.active)).sort((a, b) => Math.hypot(a.x - enemy.x, a.y - enemy.y) - Math.hypot(b.x - enemy.x, b.y - enemy.y))[0]; if (!target || Math.hypot(target.x - enemy.x, target.y - enemy.y) > 520) return false; target.active = true; target.hp = Math.min(target.maxHp, target.hp + 34); if (target.kind === 'conduit' && target.hp > target.maxHp * 0.7) target.exposed = false; return true; }
function breachNearestCover(state: SimState, enemy: Enemy) { const target = state.objects.filter(object => object.active && object.kind === 'cover' && object.destructible && object.hp > 0).sort((a, b) => Math.hypot(a.x - state.player.x, a.y - state.player.y) - Math.hypot(b.x - state.player.x, b.y - state.player.y))[0]; if (!target || Math.hypot(target.x - enemy.x, target.y - enemy.y) > 720) return false; target.hp = 0; target.active = false; if (target.id === 'meridian-pressure-door') { const link = state.links.find(item => item.id === 'door-ab'); if (link) link.open = true; } return true; }

function stepEnemy(state: SimState, enemy: Enemy, dt: number) {
  if (!enemy.active) return; stepStatuses(enemy, dt);
  if (enemy.dead) { enemy.deathT = Math.max(0, enemy.deathT - dt); enemy.vx *= Math.pow(0.06, dt); enemy.vy *= Math.pow(0.06, dt); enemy.x += enemy.vx * dt; enemy.y += enemy.vy * dt; return; }
  if (enemy.role === 'boss') { const previousPhase = enemy.bossPhase; stepBoss(state, enemy, dt); stepCommandTargetMutations(state, enemy, dt); stepBossPhaseMutations(state, enemy, dt, previousPhase); return; }
  const p = state.player; if (p.dead) return; enemy.fireCooldown = Math.max(0, enemy.fireCooldown - dt * mutationFireCadenceScale(enemy)); enemy.hazardCooldown = Math.max(0, enemy.hazardCooldown - dt * mutationHazardCadenceScale(enemy)); const sector = currentSector(state, enemy.x, enemy.y); const anchorProtected = enemy.combatClass === 'elite' || protocolAnchorsEnemy(enemy) || (isAnchoredByElite(state, enemy) && enemy.statuses.disrupted <= 0); applyPressureForce(state, enemy, sector.id, dt, anchorProtected ? 0.12 : 0.92);
  if (sector.pressure < 0.16 && !anchorProtected && enemy.variant !== 'vacuumSaboteur' && !protocolVacuumImmune(enemy)) { enemy.statuses.vacuum = 1.2; enemy.hp -= 4.3 * dt; if (enemy.hp <= 0) finishEnemyDeath(state, enemy); }
  if (enemy.statuses.stagger > 0) { enemy.x += enemy.vx * dt; enemy.y += enemy.vy * dt; return; }
  const delta = { x: p.x - enemy.x, y: p.y - enemy.y }; const distance = len(delta); const toward = norm(delta); const sideways = { x: -toward.y * enemy.strafeSign, y: toward.x * enemy.strafeSign }; const retreat = pressureRetreatVector(state, enemy); const hasPressureThreat = len(retreat) > 0.1; const recoilMover = enemy.variant === 'vectorSkirmisher' || enemy.variant === 'tetherRigger' || enemy.variant === 'impulseRigger' || enemy.variant === 'recoilBroker' || enemy.variant === 'parallaxSkirmisher'; const droneMover = enemy.variant === 'maintenanceDrone' || enemy.variant === 'gravityDrone' || enemy.variant === 'repairDrone'; let desired = { x: 0, y: 0 }; let desiredDistance = enemy.role === 'assault' ? (state.squadSuppressing ? 145 : 205) : enemy.role === 'suppressor' ? 470 : enemy.role === 'technician' ? 410 : 330; if (recoilMover) desiredDistance = 305; else if (enemy.variant === 'anchorEngineer') desiredDistance = 390; else if (droneMover) desiredDistance = enemy.variant === 'gravityDrone' ? 430 : 340; else if ((enemy.variant === 'marksman' || enemy.variant === 'baselineMarksman')) desiredDistance = 690; else if (enemy.variant === 'meleeExosuit') desiredDistance = 72; else if (enemy.variant === 'shieldBoarder') desiredDistance = 175; else if (enemy.variant === 'salvageThief' || enemy.variant === 'custodyPorter') desiredDistance = enemy.carriedObjectId ? 900 : 260;
  if (hasPressureThreat && !anchorProtected) { desired = retreat; enemy.state = 'retreat'; }
  else if (enemy.role === 'suppressor' || enemy.role === 'technician') { const coverPoint = findCoverPoint(state, enemy); if (coverPoint && clearLine(state, enemy.x, enemy.y, p.x, p.y)) { const toCover = norm({ x: coverPoint.x - enemy.x, y: coverPoint.y - enemy.y }); desired = norm({ x: toCover.x * 0.65 + sideways.x * 0.35, y: toCover.y * 0.65 + sideways.y * 0.35 }); enemy.state = 'cover'; } }
  if (len(desired) < 0.1) { if (distance > desiredDistance + 70) { desired = norm({ x: toward.x * 0.82 + sideways.x * 0.38, y: toward.y * 0.82 + sideways.y * 0.38 }); enemy.state = 'advance'; } else if (distance < desiredDistance - 80) { desired = norm({ x: -toward.x * 0.82 + sideways.x * 0.48, y: -toward.y * 0.82 + sideways.y * 0.48 }); enemy.state = 'retreat'; } else { desired = sideways; enemy.state = 'hold'; } }
  if ((enemy.variant === 'salvageThief' || enemy.variant === 'custodyPorter' || protocolCarriesObjective(enemy)) && enemy.carriedObjectId) { desired = norm({ x: 120 - enemy.x, y: 520 - enemy.y }); enemy.state = 'retreat'; }
  const protocolMobility = protocolMobilityScale(enemy, sector.pressure); const mutationMobility = mutationMobilityScale(enemy); const accel = (recoilMover ? 740 : droneMover ? 700 : enemy.variant === 'meleeExosuit' ? 820 : enemy.variant === 'salvageThief' || enemy.variant === 'custodyPorter' ? 760 : enemy.role === 'assault' ? 660 : 500) * protocolMobility * mutationMobility; const speedLimit = (recoilMover ? 172 : droneMover ? 164 : enemy.variant === 'meleeExosuit' ? 188 : enemy.variant === 'salvageThief' ? 184 : enemy.role === 'assault' ? 150 : enemy.combatClass === 'elite' ? 118 : 108) * protocolMobility * mutationMobility; enemy.vx += desired.x * accel * dt; enemy.vy += desired.y * accel * dt; const speed = Math.hypot(enemy.vx, enemy.vy); if (speed > speedLimit) { enemy.vx *= speedLimit / speed; enemy.vy *= speedLimit / speed; } const dampingBase = lerp(0.4, 0.012, sector.gravity); enemy.vx *= Math.pow(dampingBase, dt); enemy.vy *= Math.pow(dampingBase, dt); enemy.x += enemy.vx * dt; enemy.y += enemy.vy * dt; enemy.x = clamp(enemy.x, 110, world.w - 110); enemy.y = clamp(enemy.y, 185, world.h - 125); for (const object of state.objects) if (isSolidObject(object)) resolveCircleRect(enemy, enemyRadius, object);
  if (enemy.variant === 'tetherOperator') { const tether = tetherForEnemy(state, enemy); if (tether) { const pull = norm({ x: enemy.x - p.x, y: enemy.y - p.y }); p.vx += pull.x * 250 * dt; p.vy += pull.y * 250 * dt; p.vx *= Math.pow(0.28, dt); p.vy *= Math.pow(0.28, dt); } if (!tether && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { if (deployEnemyTether(state, enemy)) pushEvent(state, 'MAG-TETHER OPERATOR // MOBILITY CABLE LOCKED // BREAK THE COUPLING', 2); enemy.hazardCooldown = 8.8; } }
  if (enemy.variant === 'droneCarrier' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { if (deployCarrierDrone(state, enemy)) pushEvent(state, 'DRONE CARRIER // REPAIR MICRODRONE DEPLOYED', 1.5); enemy.hazardCooldown = 8.6; }
  if (enemy.variant === 'coverBreacher' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { if (breachNearestCover(state, enemy)) pushEvent(state, 'COVER BREACHER // DEMOLITION CHARGE // FIRING LANE OPENED', 1.7); enemy.hazardCooldown = 7.4; }
  if (enemy.variant === 'repairDrone' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { if (repairTacticalHardware(state, enemy)) pushEvent(state, 'REPAIR DRONE // MACHINERY OR ANCHOR HARDWARE RESTORED', 1.5); enemy.hazardCooldown = 5.8; }
  if (enemy.variant === 'gravitySpecialist' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { plantHazard(state, p.x + p.vx * 0.5, p.y + p.vy * 0.5, 'gravityWell', 4.8); pushEvent(state, 'GRAVITY SPECIALIST // MASS WELL PROJECTED', 1.5); enemy.hazardCooldown = 6.5; }
  if (enemy.variant === 'vacuumSaboteur' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { const breach = state.breaches.find(item => item.id === 'service-breach'); const serviceSeal = state.objects.find(object => object.id === 'service-seal'); if (breach && serviceSeal && !breach.active) { activateBreach(state, 'service-breach'); pushEvent(state, 'VACUUM SABOTEUR // SERVICE PLATE DELIBERATELY RUPTURED', 2); } enemy.hazardCooldown = 11.5; }
  if (enemy.variant === 'impulseRigger' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { plantHazard(state, p.x + p.vx * 0.55, p.y + p.vy * 0.55, 'vectorWash', 4.4); pushEvent(state, 'IMPULSE RIGGER // COUNTERMASS WASH VENTED INTO TRANSFER LANE', 1.8); enemy.hazardCooldown = 7.6; }
  if (enemy.variant === 'boiloffTech' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { plantHazard(state, p.x + p.vx * 0.35, p.y + p.vy * 0.35, 'boiloffJet', 4.8); pushEvent(state, 'BOILOFF TECH // CRYOGENIC PURGE PLUME OPEN', 1.7); enemy.hazardCooldown = 7.9; }
  if (enemy.variant === 'partitionRigger' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { const raised = activateBarrier(state, 'transfer-partition', enemy.x + enemy.strafeSign * 110, enemy.y + 40); if (raised) pushEvent(state, 'PRESSURE PARTITION RIGGER // MOVABLE SHUTTER RAISED // BREAK OR FLANK', 2); enemy.hazardCooldown = 8.1; }
  if (enemy.variant === 'recoilBroker' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { plantHazard(state, p.x + p.vx * 0.55, p.y + p.vy * 0.55, 'vectorWash', 4.2); enemy.vx -= toward.x * 260; enemy.vy -= toward.y * 260; pushEvent(state, 'COUNTERFORCE BROKER // RECOIL VECTOR + COUNTERMASS WASH COMMITTED', 2); enemy.hazardCooldown = 7.2; }
  if (enemy.variant === 'siphonTech' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { if (deploySupportNode(state, 'siphon-node', enemy, 'Hostile capacitor siphon relay')) pushEvent(state, 'CAPACITOR SIPHON // RELAY NODE ONLINE // ARC OR BREAK THE HARDWARE', 2.1); enemy.hazardCooldown = 8.4; }
  if (enemy.variant === 'purgeOrchestrator' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { const local = currentSector(state, p.x, p.y); local.pressure = Math.max(0.2, local.pressure - 0.1); local.rapidTimer = Math.max(local.rapidTimer, 1.5); plantHazard(state, p.x + p.vx * 0.4, p.y + p.vy * 0.4, 'boiloffJet', 4.6); pushEvent(state, 'CONTROLLED DECOMPRESSION // PURGE ORCHESTRATOR // MOVE OR INTERRUPT', 2.2); enemy.hazardCooldown = 8.2; }
  if (enemy.variant === 'geometryTech' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { const raised = activateBarrier(state, 'custody-shutter', enemy.x + enemy.strafeSign * 105, enemy.y + 30); if (raised) pushEvent(state, 'CUSTODY GEOMETRY // FIRING SHUTTER MOVED // DESTROY OR FLANK', 2); enemy.hazardCooldown = 8.3; }
  if (enemy.variant === 'referenceTech' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { plantHazard(state, p.x + enemy.strafeSign * 145, p.y, 'gravityWell', 4.6); pushEvent(state, 'REFERENCE TECH // LOCAL MASS STANDARD PROJECTED // BREAK OR MOVE', 1.9); enemy.hazardCooldown = 7.1; }
  if (enemy.variant === 'parallaxSkirmisher' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { plantHazard(state, p.x + p.vx * 0.4, p.y + p.vy * 0.4, 'vectorWash', 3.8); enemy.vx -= toward.x * 210; enemy.vy -= toward.y * 210; pushEvent(state, 'SHEAR RUNNER // REFERENCE WASH + COUNTERSTEP', 1.7); enemy.hazardCooldown = 6.6; }
  if (enemy.variant === 'salvageThief' || enemy.variant === 'custodyPorter') { if (!enemy.carriedObjectId && enemy.hazardCooldown <= 0) { const tagged = state.objects.find(object => object.kind === 'salvageNode' && object.active && object.exposed); if (tagged) { tagged.exposed = false; tagged.active = false; enemy.carriedObjectId = tagged.id; pushEvent(state, `${enemy.variant === 'custodyPorter' ? 'CUSTODY PORTER' : 'SALVAGE THIEF'} // ${tagged.label.toUpperCase()} HARDWARE STOLEN // INTERCEPT CARRIER`, 2); } enemy.hazardCooldown = 4.2; } if (enemy.carriedObjectId && enemy.x < 175) { dropCarriedObjective(state, enemy, false); pushEvent(state, `${enemy.variant === 'custodyPorter' ? 'CUSTODY PORTER' : 'SALVAGE THIEF'} REACHED AIRLOCK // PACKAGE DROPPED // RE-TAG REQUIRED`, 2); } }
  if (protocolCarriesObjective(enemy) && enemy.carriedObjectId && enemy.x < 175) { dropCarriedObjective(state, enemy, false); pushEvent(state, 'SALVAGE INTERDICTOR REACHED AIRLOCK // PACKAGE DROPPED // RE-TAG REQUIRED', 2); }
  stepEnemyProtocols(state, enemy, dt, distance, toward, sector.pressure);
  if (enemy.variant === 'barricadeTrooper' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { if (activateBarrier(state, 'meridian-barricade', enemy.x + enemy.strafeSign * 92, enemy.y + 34)) pushEvent(state, 'MERIDIAN PALISADE // PORTABLE BARRICADE DEPLOYED', 1.5); enemy.hazardCooldown = 8.4; }
  if (enemy.variant === 'pressureLockTech' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { const door = state.objects.find(object => object.id === 'meridian-pressure-door'); const link = state.links.find(item => item.id === 'door-ab'); if (door && door.hp > 0 && !door.active) { door.active = true; if (link) link.open = false; pushEvent(state, 'LOCK TECH // PRESSURE LANE CLOSED // BREAK THE SHUTTER OR REPOSITION', 2.1); } enemy.hazardCooldown = 9.5; }
  if (enemy.variant === 'tetherRigger' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { if (enemy.role === 'elite') { plantHazard(state, p.x - p.vx * 0.2, p.y - p.vy * 0.2, 'coolantJet', 4.5); pushEvent(state, 'JURY-RIG FOREMAN // IMPROVISED THRUSTER LINE LIVE', 1.6); } else { plantHazard(state, p.x + p.vx * 0.45, p.y + p.vy * 0.45, 'gravityWell', 4.2); pushEvent(state, 'TETHER HAND // MAGNETIC TETHER FIELD CAST', 1.6); } enemy.hazardCooldown = 6.8; }
  if (enemy.variant === 'maintenanceDrone' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { plantHazard(state, p.x + p.vx * 0.25, p.y + p.vy * 0.25, 'shockGrid', 4.2); enemy.hazardCooldown = 6.4; pushEvent(state, 'MAINTENANCE DRONE // ARC-CUTTER GRID LIVE', 1.4); }
  if (enemy.variant === 'gravityDrone' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { plantHazard(state, p.x + p.vx * 0.4, p.y + p.vy * 0.4, 'gravityWell', 4.4); enemy.hazardCooldown = 7.1; pushEvent(state, 'MASS-TRIM DRONE // LOCAL GRAVITY WELL', 1.4); }
  const customTechnician = enemy.variant === 'pressureLockTech' || enemy.variant === 'tetherRigger' || enemy.variant === 'maintenanceDrone' || enemy.variant === 'gravityDrone' || enemy.variant === 'tetherOperator' || enemy.variant === 'droneCarrier' || enemy.variant === 'repairDrone' || enemy.variant === 'gravitySpecialist' || enemy.variant === 'boiloffTech' || enemy.variant === 'partitionRigger' || enemy.variant === 'siphonTech' || enemy.variant === 'purgeOrchestrator' || enemy.variant === 'geometryTech' || enemy.variant === 'referenceTech';
  if (enemy.role === 'technician' && !customTechnician && enemy.hazardCooldown <= 0 && distance < 560 && enemy.statuses.disrupted <= 0) { plantHazard(state, p.x + p.vx * 0.32, p.y + p.vy * 0.32, 'shockGrid', 5.5); enemy.hazardCooldown = 7.2; pushEvent(state, 'TECH UNIT // SHOCK GRID DEPLOYED', 1.2); }
  if (enemy.variant === 'anchorEngineer' && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) { const node = state.objects.find(object => object.kind === 'anchorNode' && object.id.startsWith('field-anchor') && !object.active && object.hp > 0); if (node) { node.active = true; node.exposed = true; node.x = clamp(enemy.x + enemy.strafeSign * 105, 860, 1450); node.y = clamp(enemy.y + 90, 220, 840); pushEvent(state, 'ANCHOR ENGINEER // STABILIZATION NODE DEPLOYED', 1.8); } enemy.hazardCooldown = 7.8; }
  if (enemy.telegraph > 0) { enemy.telegraph -= dt; if (enemy.telegraph <= 0) { if (enemy.variant === 'meleeExosuit') { if (distance < 145) { const shove = norm({ x: p.x - enemy.x, y: p.y - enemy.y }); applyPlayerDamage(state, 24, 0.08); p.vx += shove.x * 360; p.vy += shove.y * 360; } } else if ((enemy.variant === 'marksman' || enemy.variant === 'baselineMarksman')) fireEnemyShot(state, enemy, 980, 25); else if (enemy.role === 'assault') fireEnemyShot(state, enemy, 500, 10, 0.115); else if (enemy.role === 'elite') fireEnemyShot(state, enemy, 560, 22); else fireEnemyShot(state, enemy, 465, 17); if (recoilMover) { enemy.vx -= enemy.telegraphAim.x * 155; enemy.vy -= enemy.telegraphAim.y * 155; } enemy.fireCooldown = (enemy.variant === 'marksman' || enemy.variant === 'baselineMarksman') ? 2.4 : enemy.variant === 'meleeExosuit' ? 1.65 : enemy.role === 'assault' ? 1.35 : enemy.role === 'suppressor' ? 1.1 : enemy.role === 'elite' ? 1.25 : 1.7; if (enemy.role === 'suppressor' && enemy.variant !== 'marksman') enemy.burst = 2; } }
  else if (enemy.burst > 0 && enemy.fireCooldown <= 0.72 && clearLine(state, enemy.x, enemy.y, p.x, p.y)) { enemy.telegraphAim = norm({ x: p.x - enemy.x, y: p.y - enemy.y }); fireEnemyShot(state, enemy, 470, 11); enemy.burst -= 1; enemy.fireCooldown += 0.2; }
  else { const attackRange = (enemy.variant === 'marksman' || enemy.variant === 'baselineMarksman') ? 930 : enemy.variant === 'meleeExosuit' ? 155 : enemy.role === 'assault' ? 330 : 690; if (enemy.fireCooldown <= 0 && distance < attackRange && clearLine(state, enemy.x, enemy.y, p.x, p.y)) { enemy.telegraph = (enemy.variant === 'marksman' || enemy.variant === 'baselineMarksman') ? 1.45 : enemy.variant === 'meleeExosuit' ? 0.62 : enemy.role === 'assault' ? 0.45 : enemy.role === 'elite' ? 0.64 : 0.72; enemy.telegraphAim = toward; enemy.state = 'attack'; } }
}

function beginBossPhaseTwo(state: SimState, boss: Enemy) { boss.bossPhase = 2; boss.statuses.disrupted = 2.4; boss.anchored = false; const sector = state.sectors.find(item => item.id === 'C'); if (sector) sector.gravity = 0.04; activateBreach(state, 'boss-breach'); const link = state.links.find(item => item.id === 'door-bc'); if (link) link.open = false; }
function foundryAnchorNodes(state: SimState) {
  return state.objects.filter(object => object.kind === 'anchorNode' && object.id.startsWith('foundry-anchor'));
}

function beginFoundryPhaseTwo(state: SimState, boss: Enemy) {
  boss.bossPhase = 2;
  boss.statuses.disrupted = Math.max(boss.statuses.disrupted, 1.8);
  boss.anchored = false;
  const sector = state.sectors.find(item => item.id === 'C');
  if (sector) sector.gravity = 0.08;
  plantHazard(state, 1810, 300, 'coolantJet', 6.5);
  plantHazard(state, 2110, 720, 'coolantJet', 6.5);
  pushEvent(state, 'FOUNDRY MARSHAL // ANCHOR NETWORK LOST // LOW-G PROCESS PURGE', 3.6);
}

function activateFoundryAnchors(state: SimState) {
  let activated = 0;
  for (const node of foundryAnchorNodes(state)) { if (node.hp > 0) { node.active = true; node.exposed = true; activated += 1; } }
  return activated;
}

function stepFoundryBoss(state: SimState, boss: Enemy, dt: number) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  boss.hazardCooldown = Math.max(0, boss.hazardCooldown - dt);
  const sector = currentSector(state, boss.x, boss.y);
  const nodes = foundryAnchorNodes(state);
  const activeAnchors = nodes.filter(node => node.active && node.hp > 0).length;
  const brokenAnchors = nodes.filter(node => node.hp <= 0).length;
  boss.anchored = activeAnchors > 0 && boss.statuses.disrupted <= 0;
  applyPressureForce(state, boss, sector.id, dt, boss.anchored ? 0.06 : 0.68);
  if (boss.bossPhase === 1 && (brokenAnchors >= 2 || boss.hp <= boss.maxHp * 0.35)) beginFoundryPhaseTwo(state, boss);

  if (boss.statuses.stagger <= 0) {
    const delta = { x: p.x - boss.x, y: p.y - boss.y };
    const distance = len(delta);
    const toward = norm(delta);
    const sideways = { x: -toward.y * boss.strafeSign, y: toward.x * boss.strafeSign };
    const desired = distance > 470 ? norm({ x: toward.x * 0.58 + sideways.x * 0.52, y: toward.y * 0.58 + sideways.y * 0.52 }) : distance < 300 ? norm({ x: -toward.x * 0.7 + sideways.x * 0.45, y: -toward.y * 0.7 + sideways.y * 0.45 }) : sideways;
    boss.vx += desired.x * (boss.bossPhase === 2 ? 520 : 430) * dt;
    boss.vy += desired.y * (boss.bossPhase === 2 ? 520 : 430) * dt;
    const speed = Math.hypot(boss.vx, boss.vy);
    const maxSpeed = boss.bossPhase === 2 ? 148 : 112;
    if (speed > maxSpeed) { boss.vx *= maxSpeed / speed; boss.vy *= maxSpeed / speed; }
  }
  boss.vx *= Math.pow(lerp(0.58, 0.02, sector.gravity), dt); boss.vy *= Math.pow(lerp(0.58, 0.02, sector.gravity), dt); boss.x += boss.vx * dt; boss.y += boss.vy * dt; boss.x = clamp(boss.x, 1580, world.w - 115); boss.y = clamp(boss.y, 210, world.h - 145); for (const object of state.objects) if (isSolidObject(object)) resolveCircleRect(boss, 31, object);

  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph > 0) return;
    if (boss.bossPattern === 'forgeSweep') { const aim = norm({ x: p.x - boss.x, y: p.y - boss.y }); boss.telegraphAim = aim; for (const angle of [-0.18, -0.09, 0, 0.09, 0.18]) { const c = Math.cos(angle); const s = Math.sin(angle); const dir = { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c }; addProjectile(state, boss.x, boss.y, dir, 620, boss.bossPhase === 2 ? 21 : 18, 'enemy', { weapon: 'enemy', armorDamage: 0.72, healthMultiplier: 1, radius: 7 }); } }
    else if (boss.bossPattern === 'gravityFlip') { const arena = state.sectors.find(item => item.id === 'C'); if (arena) arena.gravity = arena.gravity < 0.3 ? 0.78 : 0.08; plantHazard(state, p.x + p.vx * 0.5, p.y + p.vy * 0.5, 'gravityWell', 4.2); pushEvent(state, `FOUNDRY GRAVITY BUS // ${arena && arena.gravity < 0.3 ? 'LOW-G' : 'HIGH-G'} SHIFT`, 2.5); }
    else if (boss.bossPattern === 'anchorCast') { const activated = activateFoundryAnchors(state); pushEvent(state, activated > 0 ? 'FOUNDRY ANCHORS ONLINE // BREAK OR DISRUPT THE NETWORK' : 'ANCHOR BUS FAILED // MARSHAL EXPOSED', 2.8); }
    boss.fireCooldown = boss.bossPhase === 2 ? 1.2 : 1.65;
    boss.bossPattern = 'none';
    return;
  }

  if (boss.fireCooldown > 0) return;
  const phaseOne: Enemy['bossPattern'][] = ['anchorCast', 'forgeSweep', 'gravityFlip'];
  const phaseTwo: Enemy['bossPattern'][] = ['forgeSweep', 'gravityFlip', 'forgeSweep'];
  const patterns = boss.bossPhase === 2 ? phaseTwo : phaseOne;
  boss.bossPattern = patterns[boss.patternIndex % patterns.length];
  boss.patternIndex += 1;
  boss.telegraph = boss.bossPattern === 'anchorCast' ? 1.18 : boss.bossPattern === 'gravityFlip' ? 1.0 : 0.9;
  boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}

function moveArenaBoss(state: SimState, boss: Enemy, dt: number, desiredDistance: number, accel: number, maxSpeed: number, pressureScale: number) {
  const p = state.player; const sector = currentSector(state, boss.x, boss.y); applyPressureForce(state, boss, sector.id, dt, pressureScale); if (boss.statuses.stagger <= 0) { const delta = { x: p.x - boss.x, y: p.y - boss.y }; const distance = len(delta); const toward = norm(delta); const sideways = { x: -toward.y * boss.strafeSign, y: toward.x * boss.strafeSign }; const desired = distance > desiredDistance + 70 ? norm({ x: toward.x * 0.62 + sideways.x * 0.45, y: toward.y * 0.62 + sideways.y * 0.45 }) : distance < desiredDistance - 75 ? norm({ x: -toward.x * 0.72 + sideways.x * 0.48, y: -toward.y * 0.72 + sideways.y * 0.48 }) : sideways; boss.vx += desired.x * accel * dt; boss.vy += desired.y * accel * dt; const speed = Math.hypot(boss.vx, boss.vy); if (speed > maxSpeed) { boss.vx *= maxSpeed / speed; boss.vy *= maxSpeed / speed; } } boss.vx *= Math.pow(lerp(0.56, 0.02, sector.gravity), dt); boss.vy *= Math.pow(lerp(0.56, 0.02, sector.gravity), dt); boss.x += boss.vx * dt; boss.y += boss.vy * dt; boss.x = clamp(boss.x, 1580, world.w - 115); boss.y = clamp(boss.y, 210, world.h - 145); for (const object of state.objects) if (isSolidObject(object)) resolveCircleRect(boss, 31, object);
}

function stepMeridianBoss(state: SimState, boss: Enemy, dt: number) {
  const p = state.player; if (!state.bossActive || p.dead) return; boss.fireCooldown = Math.max(0, boss.fireCooldown - dt); boss.hazardCooldown = Math.max(0, boss.hazardCooldown - dt); if (boss.bossPhase === 1 && (boss.armor <= 0 || boss.hp <= boss.maxHp * 0.4)) { boss.bossPhase = 2; boss.statuses.disrupted = Math.max(boss.statuses.disrupted, 1.4); pushEvent(state, 'COMMANDER VOSS // PALISADE ARMOR BREACHED // MOBILE RECOVERY DOCTRINE', 3.2); }
  moveArenaBoss(state, boss, dt, 390, boss.bossPhase === 2 ? 470 : 350, boss.bossPhase === 2 ? 126 : 96, 0.12);
  if (boss.telegraph > 0) { boss.telegraph -= dt; if (boss.telegraph > 0) return; if (boss.bossPattern === 'armorVolley') { const aim = norm({ x: p.x - boss.x, y: p.y - boss.y }); boss.telegraphAim = aim; for (const angle of [-0.18, -0.09, 0, 0.09, 0.18]) { const c = Math.cos(angle); const s = Math.sin(angle); addProjectile(state, boss.x, boss.y, { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c }, 650, boss.bossPhase === 2 ? 22 : 18, 'enemy', { weapon: 'enemy', armorDamage: 0.92, radius: 7 }); } } else if (boss.bossPattern === 'barricadeCommand') { const first = activateBarrier(state, 'commander-barricade'); const second = activateBarrier(state, 'commander-barricade'); pushEvent(state, first || second ? 'COMMAND PALISADE // TWO COVER LANES DEPLOYED' : 'COMMAND PALISADE // RESERVE BARRICADES EXHAUSTED', 2.4); } else if (boss.bossPattern === 'pressureLock') { const closed = activateBarrier(state, 'commander-pressure-door'); pushEvent(state, closed ? 'COMMAND PRESSURE SHUTTER // ARENA LANE CLOSED' : 'PRESSURE SHUTTER FRAME DESTROYED // LANE STAYS OPEN', 2.4); } boss.fireCooldown = boss.bossPhase === 2 ? 1.25 : 1.65; boss.bossPattern = 'none'; return; }
  if (boss.fireCooldown > 0) return; const phaseOne: Enemy['bossPattern'][] = ['barricadeCommand', 'armorVolley', 'pressureLock']; const phaseTwo: Enemy['bossPattern'][] = ['armorVolley', 'pressureLock', 'armorVolley']; const patterns = boss.bossPhase === 2 ? phaseTwo : phaseOne; boss.bossPattern = patterns[boss.patternIndex % patterns.length]; boss.patternIndex += 1; boss.telegraph = boss.bossPattern === 'armorVolley' ? 0.82 : 1.02; boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}

function stepSalvageBoss(state: SimState, boss: Enemy, dt: number) {
  const p = state.player; if (!state.bossActive || p.dead) return; boss.fireCooldown = Math.max(0, boss.fireCooldown - dt); if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.5) { boss.bossPhase = 2; const arena = state.sectors.find(item => item.id === 'C'); if (arena) arena.gravity = 0.05; pushEvent(state, 'CAPTAIN KADE // COUNTERMASS LIMITERS OFFLINE // FREE RECOIL AUTHORIZED', 3.2); }
  moveArenaBoss(state, boss, dt, 315, boss.bossPhase === 2 ? 650 : 520, boss.bossPhase === 2 ? 192 : 155, 0.7);
  if (boss.telegraph > 0) { boss.telegraph -= dt; if (boss.telegraph > 0) return; const aim = norm({ x: p.x - boss.x, y: p.y - boss.y }); boss.telegraphAim = aim; if (boss.bossPattern === 'tetherCast') { plantHazard(state, p.x + p.vx * 0.55, p.y + p.vy * 0.55, 'gravityWell', boss.bossPhase === 2 ? 5.2 : 4.4); pushEvent(state, 'MAG-TETHER CAST // BREAK VECTOR OR DODGE THE WELL', 2); } else if (boss.bossPattern === 'backblastRush') { fireEnemyShot(state, boss, 560, boss.bossPhase === 2 ? 19 : 16, 0.13); boss.vx -= aim.x * (boss.bossPhase === 2 ? 470 : 350); boss.vy -= aim.y * (boss.bossPhase === 2 ? 470 : 350); } else if (boss.bossPattern === 'scrapFan') { for (const angle of [-0.24, -0.12, 0, 0.12, 0.24]) { const c = Math.cos(angle); const s = Math.sin(angle); addProjectile(state, boss.x, boss.y, { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c }, 590, boss.bossPhase === 2 ? 20 : 17, 'enemy', { weapon: 'enemy', armorDamage: 0.62, radius: 7 }); } } boss.fireCooldown = boss.bossPhase === 2 ? 1.05 : 1.4; boss.bossPattern = 'none'; return; }
  if (boss.fireCooldown > 0) return; const patterns: Enemy['bossPattern'][] = boss.bossPhase === 2 ? ['backblastRush', 'tetherCast', 'scrapFan'] : ['tetherCast', 'backblastRush', 'scrapFan']; boss.bossPattern = patterns[boss.patternIndex % patterns.length]; boss.patternIndex += 1; boss.telegraph = boss.bossPattern === 'tetherCast' ? 1.0 : boss.bossPattern === 'backblastRush' ? 0.72 : 0.86; boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}

function stepYardmindBoss(state: SimState, boss: Enemy, dt: number) {
  const p = state.player; if (!state.bossActive || p.dead) return; boss.fireCooldown = Math.max(0, boss.fireCooldown - dt); boss.vx = 0; boss.vy = 0; boss.anchored = true; if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.55) { boss.bossPhase = 2; const arena = state.sectors.find(item => item.id === 'C'); if (arena) arena.gravity = 0.06; plantHazard(state, 1810, 315, 'shockGrid', 6); plantHazard(state, 2110, 720, 'shockGrid', 6); pushEvent(state, 'HELIOS-9 // PROCESS AUTHORITY ESCALATED // HUMAN-SAFE LIMITS REVOKED', 3.4); }
  if (boss.telegraph > 0) { boss.telegraph -= dt; if (boss.telegraph > 0) return; if (boss.bossPattern === 'droneCommand') { for (const offset of [-150, 0, 150]) { const originY = clamp(boss.y + offset, 230, 820); const aim = norm({ x: p.x - (boss.x - 80), y: p.y - originY }); addProjectile(state, boss.x - 80, originY, aim, 520, boss.bossPhase === 2 ? 18 : 15, 'enemy', { weapon: 'enemy', armorDamage: 0.58, radius: 6 }); } plantHazard(state, p.x + p.vx * 0.3, p.y + p.vy * 0.3, 'shockGrid', 4.2); pushEvent(state, 'YARDMIND // MAINTENANCE DRONES ROUTED TO ARC-CUTTER ATTACK', 2); } else if (boss.bossPattern === 'doorCycle') { const a = state.objects.find(object => object.id === 'yard-door-a'); const b = state.objects.find(object => object.id === 'yard-door-b'); const openA = boss.patternIndex % 2 === 0; if (a?.hp && a.hp > 0) a.active = openA; if (b?.hp && b.hp > 0) b.active = !openA; pushEvent(state, 'YARDMIND // FABRICATION SHUTTERS RECYCLED // FIRING LANES CHANGED', 2.3); } else if (boss.bossPattern === 'gravityOverride') { const arena = state.sectors.find(item => item.id === 'C'); if (arena) arena.gravity = arena.gravity < 0.3 ? 0.82 : 0.07; plantHazard(state, p.x + p.vx * 0.5, p.y + p.vy * 0.5, 'gravityWell', 4.5); pushEvent(state, `YARDMIND MASS CONTROL // ${arena && arena.gravity < 0.3 ? 'LOW-G' : 'HIGH-G'} OVERRIDE`, 2.4); } boss.fireCooldown = boss.bossPhase === 2 ? 1.15 : 1.55; boss.bossPattern = 'none'; return; }
  if (boss.fireCooldown > 0) return; const patterns: Enemy['bossPattern'][] = boss.bossPhase === 2 ? ['droneCommand', 'gravityOverride', 'doorCycle', 'droneCommand'] : ['doorCycle', 'droneCommand', 'gravityOverride']; boss.bossPattern = patterns[boss.patternIndex % patterns.length]; boss.patternIndex += 1; boss.telegraph = boss.bossPattern === 'droneCommand' ? 0.9 : 1.05; boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}

function stepPressureBrokerBoss(state: SimState, boss: Enemy, dt: number) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.52) { boss.bossPhase = 2; activateBreach(state, 'boss-breach'); pushEvent(state, 'NAIMA RUSK // FALSE PRESSURE MAP RELEASED // STORMLINE VENTS OPEN', 3.2); }
  moveArenaBoss(state, boss, dt, 345, boss.bossPhase === 2 ? 610 : 500, boss.bossPhase === 2 ? 178 : 142, 0.2);
  if (boss.telegraph > 0) {
    boss.telegraph -= dt; if (boss.telegraph > 0) return;
    if (boss.bossPattern === 'pressureCascade') { activateBreach(state, 'boss-breach'); plantHazard(state, p.x + p.vx * 0.45, p.y + p.vy * 0.45, 'gravityWell', 4.2); pushEvent(state, 'PRESSURE CASCADE // VENT VECTOR + MAGNETIC PULL', 2.2); }
    else if (boss.bossPattern === 'shutterDebt') { const a = activateBarrier(state, 'story-pressure-shutter'); const b = activateBarrier(state, 'story-pressure-shutter'); pushEvent(state, a || b ? 'BROKER SHUTTERS // RECOVERY LANES CLOSED' : 'BROKER SHUTTERS EXHAUSTED // NO COVER LEFT', 2.2); }
    else if (boss.bossPattern === 'latticePulse') { const delta = { x: boss.x - p.x, y: boss.y - p.y }; const distance = len(delta); if (distance < 390) { const dir = norm(delta); p.vx += dir.x * 430; p.vy += dir.y * 430; p.disrupted = Math.max(p.disrupted, 0.7); applyPlayerDamage(state, boss.bossPhase === 2 ? 19 : 15, 0.18); } spawnEffect(state, boss.x, boss.y, 'pulse', 360, 0.7); }
    boss.fireCooldown = boss.bossPhase === 2 ? 1.05 : 1.45; boss.bossPattern = 'none'; return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns: Enemy['bossPattern'][] = boss.bossPhase === 2 ? ['pressureCascade', 'latticePulse', 'shutterDebt', 'latticePulse'] : ['shutterDebt', 'pressureCascade', 'latticePulse'];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length]; boss.patternIndex += 1; boss.telegraph = boss.bossPattern === 'latticePulse' ? 0.85 : 1.05; boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}

function stepBondArbiterBoss(state: SimState, boss: Enemy, dt: number) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  if (boss.bossPhase === 1 && (boss.armor <= 0 || boss.hp <= boss.maxHp * 0.44)) { boss.bossPhase = 2; boss.statuses.disrupted = Math.max(boss.statuses.disrupted, 1.1); pushEvent(state, 'ARBITER SHAW // CERTIFIED ARMOR FAILED // EMERGENCY SEIZURE AUTHORITY', 3.1); }
  moveArenaBoss(state, boss, dt, 405, boss.bossPhase === 2 ? 490 : 360, boss.bossPhase === 2 ? 128 : 92, 0.08);
  if (boss.telegraph > 0) {
    boss.telegraph -= dt; if (boss.telegraph > 0) return;
    if (boss.bossPattern === 'certifiedVolley') { const aim = norm({ x: p.x - boss.x, y: p.y - boss.y }); for (const angle of [-0.24, -0.16, -0.08, 0, 0.08, 0.16, 0.24]) { const c = Math.cos(angle); const s = Math.sin(angle); addProjectile(state, boss.x, boss.y, { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c }, 660, boss.bossPhase === 2 ? 21 : 18, 'enemy', { weapon: 'enemy', armorDamage: 1.05, radius: 7 }); } }
    else if (boss.bossPattern === 'seizureWall') { const a = activateBarrier(state, 'commander-barricade'); const b = activateBarrier(state, 'commander-pressure-door'); pushEvent(state, a || b ? 'SEIZURE ORDER // CERTIFIED COVER DEPLOYED' : 'SEIZURE ORDER // RESERVE COVER EXHAUSTED', 2.2); }
    else if (boss.bossPattern === 'auditPulse') { const liveCover = state.objects.filter(object => object.active && (object.id.startsWith('commander-barricade') || object.id.startsWith('commander-pressure-door'))).length; if (liveCover > 0) { boss.armor = Math.min(boss.maxArmor, boss.armor + 38); plantHazard(state, p.x, p.y, 'shockGrid', 4); pushEvent(state, 'AUDIT PULSE // COVER NETWORK RESTORES ARBITER ARMOR', 2.2); } else { const delta = { x: p.x - boss.x, y: p.y - boss.y }; if (len(delta) < 350) { const dir = norm(delta); p.vx += dir.x * 460; p.vy += dir.y * 460; applyPlayerDamage(state, 17, 0.08); } } }
    boss.fireCooldown = boss.bossPhase === 2 ? 1.15 : 1.55; boss.bossPattern = 'none'; return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns: Enemy['bossPattern'][] = boss.bossPhase === 2 ? ['certifiedVolley', 'auditPulse', 'seizureWall', 'certifiedVolley'] : ['seizureWall', 'certifiedVolley', 'auditPulse'];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length]; boss.patternIndex += 1; boss.telegraph = boss.bossPattern === 'certifiedVolley' ? 0.88 : 1.08; boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}

function stepForgeChorusBoss(state: SimState, boss: Enemy, dt: number) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt); boss.vx = 0; boss.vy = 0; boss.anchored = true;
  if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.55) { boss.bossPhase = 2; const arena = state.sectors.find(item => item.id === 'C'); if (arena) arena.gravity = 0.05; plantHazard(state, 1810, 315, 'shockGrid', 6); plantHazard(state, 2120, 715, 'shockGrid', 6); pushEvent(state, 'PRISM-6 // PROCESS CHORUS SPLIT // SAFETY CONSENSUS LOST', 3.3); }
  if (boss.telegraph > 0) {
    boss.telegraph -= dt; if (boss.telegraph > 0) return;
    if (boss.bossPattern === 'machineChoir') { for (const offset of [-180, -90, 0, 90, 180]) { const originY = clamp(boss.y + offset, 220, 830); const aim = norm({ x: p.x - (boss.x - 95), y: p.y - originY }); addProjectile(state, boss.x - 95, originY, aim, 540, boss.bossPhase === 2 ? 18 : 15, 'enemy', { weapon: 'enemy', armorDamage: 0.62, radius: 6 }); } plantHazard(state, p.x + p.vx * 0.25, p.y + p.vy * 0.25, 'shockGrid', 4.2); pushEvent(state, 'MACHINE CHOIR // FIVE PROCESS TOOLS FIRING AS ONE', 2.1); }
    else if (boss.bossPattern === 'phaseFork') { const arena = state.sectors.find(item => item.id === 'C'); if (arena) arena.gravity = arena.gravity < 0.3 ? 0.86 : 0.06; plantHazard(state, p.x - 150, p.y, 'gravityWell', 4.2); plantHazard(state, p.x + 150, p.y, 'gravityWell', 4.2); pushEvent(state, 'PHASE FORK // DUAL MASS WELLS // GRAVITY REFERENCE SHIFT', 2.3); }
    else if (boss.bossPattern === 'thermalCascade') { p.weaponHeat[p.currentWeapon] = Math.min(1, p.weaponHeat[p.currentWeapon] + (boss.bossPhase === 2 ? 0.34 : 0.24)); plantHazard(state, p.x + p.vx * 0.35, p.y + p.vy * 0.35, 'shockGrid', 3.8); pushEvent(state, 'THERMAL CASCADE // ACTIVE WEAPON BUS SATURATING', 2.2); }
    boss.fireCooldown = boss.bossPhase === 2 ? 1.0 : 1.4; boss.bossPattern = 'none'; return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns: Enemy['bossPattern'][] = boss.bossPhase === 2 ? ['machineChoir', 'phaseFork', 'thermalCascade', 'machineChoir'] : ['thermalCascade', 'machineChoir', 'phaseFork'];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length]; boss.patternIndex += 1; boss.telegraph = boss.bossPattern === 'machineChoir' ? 0.9 : 1.05; boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}

function stepCascadeCustodianBoss(state: SimState, boss: Enemy, dt: number) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.52) {
    boss.bossPhase = 2;
    const arena = state.sectors.find(item => item.id === 'C');
    if (arena) arena.gravity = 0.05;
    activateBreach(state, 'boss-breach');
    plantHazard(state, 1810, 320, 'shockGrid', 7);
    plantHazard(state, 2110, 710, 'shockGrid', 7);
    pushEvent(state, 'ORO-7 // CUMULATIVE FAILURE STATE // PRESSURE + GRAVITY + GRID AUTHORITY', 3.5);
  }
  moveArenaBoss(state, boss, dt, 360, boss.bossPhase === 2 ? 590 : 455, boss.bossPhase === 2 ? 165 : 128, 0.35);
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph > 0) return;
    if (boss.bossPattern === 'pressureCascade') {
      activateBreach(state, 'boss-breach');
      const arena = state.sectors.find(item => item.id === 'C');
      if (arena) { arena.rapidTimer = Math.max(arena.rapidTimer, 4); arena.targetPressure = 0; }
      pushEvent(state, 'ORO-7 PRESSURE CASCADE // DEEP-ZONE VENT PATH OPEN', 2.3);
    } else if (boss.bossPattern === 'gravityOverride') {
      const arena = state.sectors.find(item => item.id === 'C');
      if (arena) arena.gravity = arena.gravity < 0.3 ? 0.82 : 0.05;
      plantHazard(state, p.x + p.vx * 0.45, p.y + p.vy * 0.45, 'gravityWell', 4.6);
      pushEvent(state, `ORO-7 MASS BUS // ${arena && arena.gravity < 0.3 ? 'LOW-G' : 'HIGH-G'} OVERRIDE`, 2.2);
    } else if (boss.bossPattern === 'machineChoir') {
      const aim = norm({ x: p.x - boss.x, y: p.y - boss.y });
      for (const angle of [-0.22, -0.11, 0, 0.11, 0.22]) { const c = Math.cos(angle); const s = Math.sin(angle); addProjectile(state, boss.x, boss.y, { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c }, 610, boss.bossPhase === 2 ? 22 : 18, 'enemy', { weapon: 'enemy', armorDamage: 0.78, radius: 7 }); }
      plantHazard(state, p.x + p.vx * 0.3, p.y + p.vy * 0.3, 'shockGrid', boss.bossPhase === 2 ? 5.2 : 4.2);
      pushEvent(state, 'ORO-7 GRID CASCADE // ARC FIELD + BUS VOLLEY', 2.2);
    }
    boss.fireCooldown = boss.bossPhase === 2 ? 0.98 : 1.35;
    boss.bossPattern = 'none';
    return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns: Enemy['bossPattern'][] = boss.bossPhase === 2 ? ['pressureCascade', 'machineChoir', 'gravityOverride', 'machineChoir'] : ['pressureCascade', 'gravityOverride', 'machineChoir'];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length];
  boss.patternIndex += 1;
  boss.telegraph = boss.bossPattern === 'machineChoir' ? 0.86 : 1.05;
  boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}


function stepPerseidStewardBoss(state: SimState, boss: Enemy, dt: number) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.52) {
    boss.bossPhase = 2;
    const arena = state.sectors.find(item => item.id === 'C');
    if (arena) arena.gravity = 0.06;
    activateBreach(state, 'boss-breach');
    plantHazard(state, 1810, 320, 'shockGrid', 6.5);
    plantHazard(state, 2110, 710, 'gravityWell', 5.5);
    pushEvent(state, 'PERSEID STEWARD // REACTOR CHOIR AUTHORITY SPLIT // SHIP SAFETY MODEL OVERRIDDEN', 3.5);
  }
  moveArenaBoss(state, boss, dt, 360, boss.bossPhase === 2 ? 575 : 445, boss.bossPhase === 2 ? 160 : 124, 0.34);
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph > 0) return;
    if (boss.bossPattern === 'pressureCascade') {
      activateBreach(state, 'boss-breach');
      const arena = state.sectors.find(item => item.id === 'C');
      if (arena) { arena.rapidTimer = Math.max(arena.rapidTimer, 4); arena.targetPressure = 0; }
      pushEvent(state, 'STEWARD VENT ORDER // REACTOR NAVE PRESSURE PATH OPEN', 2.3);
    } else if (boss.bossPattern === 'gravityOverride') {
      const arena = state.sectors.find(item => item.id === 'C');
      if (arena) arena.gravity = arena.gravity < 0.3 ? 0.78 : 0.06;
      plantHazard(state, p.x + p.vx * 0.42, p.y + p.vy * 0.42, 'gravityWell', 4.4);
      pushEvent(state, `STEWARD ROTATION AUTHORITY // ${arena && arena.gravity < 0.3 ? 'LOW-G' : 'HIGH-G'} DRUM REFERENCE`, 2.2);
    } else if (boss.bossPattern === 'machineChoir') {
      const aim = norm({ x: p.x - boss.x, y: p.y - boss.y });
      for (const angle of [-0.2, -0.1, 0, 0.1, 0.2]) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        addProjectile(state, boss.x, boss.y, { x: aim.x * cos - aim.y * sin, y: aim.x * sin + aim.y * cos }, 600, boss.bossPhase === 2 ? 21 : 17, 'enemy', { weapon: 'enemy', armorDamage: 0.76, radius: 7 });
      }
      plantHazard(state, p.x + p.vx * 0.28, p.y + p.vy * 0.28, 'shockGrid', boss.bossPhase === 2 ? 5 : 4);
      pushEvent(state, 'REACTOR CHOIR // FIVE HARMONIC BUSES FIRING IN PHASE', 2.2);
    }
    boss.fireCooldown = boss.bossPhase === 2 ? 1.0 : 1.36;
    boss.bossPattern = 'none';
    return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns: Enemy['bossPattern'][] = boss.bossPhase === 2
    ? ['machineChoir', 'pressureCascade', 'gravityOverride', 'machineChoir']
    : ['pressureCascade', 'machineChoir', 'gravityOverride'];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length];
  boss.patternIndex += 1;
  boss.telegraph = boss.bossPattern === 'machineChoir' ? 0.88 : 1.05;
  boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}

function stepOrphelineWardenBoss(state: SimState, boss: Enemy, dt: number) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.5) {
    boss.bossPhase = 2;
    const arena = state.sectors.find(item => item.id === 'C');
    if (arena) { arena.gravity = 0.08; arena.targetPressure = Math.min(arena.targetPressure, 0.42); }
    activateBreach(state, 'boss-breach');
    plantHazard(state, 1790, 330, 'shockGrid', 6);
    plantHazard(state, 2090, 700, 'gravityWell', 5.4);
    pushEvent(state, 'ORPHELINE WARDEN // FOUNDING CHARTER LOCKDOWN // SHELTER AUTHORITY ESCALATED', 3.5);
  }
  moveArenaBoss(state, boss, dt, 350, boss.bossPhase === 2 ? 600 : 470, boss.bossPhase === 2 ? 165 : 126, 0.28);
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph > 0) return;
    const aim = norm({ x: p.x - boss.x, y: p.y - boss.y });
    if (boss.bossPattern === 'pressureCascade') {
      activateBreach(state, 'boss-breach');
      const arena = state.sectors.find(item => item.id === 'C');
      if (arena) { arena.rapidTimer = Math.max(arena.rapidTimer, 4.5); arena.targetPressure = 0.1; }
      pushEvent(state, 'WARDEN SHELTER PURGE // CONTROL VAULT PRESSURE ROUTE OPEN', 2.3);
    } else if (boss.bossPattern === 'gravityOverride') {
      const arena = state.sectors.find(item => item.id === 'C');
      if (arena) arena.gravity = arena.gravity < 0.25 ? 0.66 : 0.08;
      plantHazard(state, p.x + p.vx * 0.38, p.y + p.vy * 0.38, 'gravityWell', 4.6);
      pushEvent(state, `WARDEN SPIN AUTHORITY // ${arena && arena.gravity < 0.25 ? 'SHELTER LOW-G' : 'LOCKDOWN HIGH-G'}`, 2.2);
    } else if (boss.bossPattern === 'shutterGeometry') {
      for (const angle of [-0.18, -0.09, 0, 0.09, 0.18]) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        addProjectile(state, boss.x, boss.y, { x: aim.x * cos - aim.y * sin, y: aim.x * sin + aim.y * cos }, 625, boss.bossPhase === 2 ? 22 : 18, 'enemy', { weapon: 'enemy', armorDamage: 0.8, radius: 7 });
      }
      plantHazard(state, p.x - aim.x * 120, p.y - aim.y * 120, 'shockGrid', boss.bossPhase === 2 ? 5.2 : 4.2);
      pushEvent(state, 'FOUNDING ARCHIVE GEOMETRY // PARTITION FIRE LANES SEALED', 2.2);
    }
    boss.fireCooldown = boss.bossPhase === 2 ? 0.98 : 1.34;
    boss.bossPattern = 'none';
    return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns: Enemy['bossPattern'][] = boss.bossPhase === 2
    ? ['shutterGeometry', 'pressureCascade', 'gravityOverride', 'shutterGeometry']
    : ['pressureCascade', 'shutterGeometry', 'gravityOverride'];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length];
  boss.patternIndex += 1;
  boss.telegraph = boss.bossPattern === 'shutterGeometry' ? 0.9 : 1.06;
  boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}

function stepHecateYardmasterBoss(state: SimState, boss: Enemy, dt: number) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.5) {
    boss.bossPhase = 2;
    const arena = state.sectors.find(item => item.id === 'C');
    if (arena) { arena.gravity = 0.11; arena.targetPressure = Math.min(arena.targetPressure, 0.36); }
    activateBreach(state, 'boss-breach');
    plantHazard(state, 1800, 325, 'shockGrid', 6.2);
    plantHazard(state, 2100, 700, 'vectorWash', 5.6);
    pushEvent(state, 'HECATE YARDMASTER // SALVAGE AUTHORITY NULL // CUTTER GRID ESCALATED', 3.5);
  }
  moveArenaBoss(state, boss, dt, 355, boss.bossPhase === 2 ? 610 : 480, boss.bossPhase === 2 ? 168 : 128, 0.3);
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph > 0) return;
    const aim = norm({ x: p.x - boss.x, y: p.y - boss.y });
    if (boss.bossPattern === 'craneLock') {
      plantHazard(state, p.x + p.vx * 0.4, p.y + p.vy * 0.4, 'vectorWash', boss.bossPhase === 2 ? 5.4 : 4.4);
      plantHazard(state, p.x - aim.x * 145, p.y - aim.y * 145, 'gravityWell', 4.2);
      pushEvent(state, 'YARDMASTER CLAMP LOCK // HULL CRADLES SWEEPING THE CONTROL CROWN', 2.3);
    } else if (boss.bossPattern === 'thermalCascade') {
      for (const angle of [-0.2, -0.1, 0, 0.1, 0.2]) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        addProjectile(state, boss.x, boss.y, { x: aim.x * cos - aim.y * sin, y: aim.x * sin + aim.y * cos }, 640, boss.bossPhase === 2 ? 23 : 19, 'enemy', { weapon: 'enemy', armorDamage: 0.84, radius: 7 });
      }
      plantHazard(state, p.x + p.vx * 0.25, p.y + p.vy * 0.25, 'boiloffJet', boss.bossPhase === 2 ? 5.2 : 4.2);
      pushEvent(state, 'HECATE CUTTER CASCADE // THERMAL LANCE BANK FIRING ACROSS THE GANTRY', 2.2);
    } else if (boss.bossPattern === 'pressureCascade') {
      activateBreach(state, 'boss-breach');
      const arena = state.sectors.find(item => item.id === 'C');
      if (arena) { arena.rapidTimer = Math.max(arena.rapidTimer, 4.6); arena.targetPressure = 0.08; }
      plantHazard(state, p.x + aim.x * 90, p.y + aim.y * 90, 'vectorWash', 4.8, 'environment');
      pushEvent(state, 'YARDMASTER WRECK PURGE // CONTROL CROWN OPENED TO THE BREAKING FIELD', 2.3);
    }
    boss.fireCooldown = boss.bossPhase === 2 ? 0.96 : 1.32;
    boss.bossPattern = 'none';
    return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns: Enemy['bossPattern'][] = boss.bossPhase === 2
    ? ['thermalCascade', 'craneLock', 'pressureCascade', 'thermalCascade']
    : ['craneLock', 'thermalCascade', 'pressureCascade'];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length];
  boss.patternIndex += 1;
  boss.telegraph = boss.bossPattern === 'thermalCascade' ? 0.88 : 1.04;
  boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}

function stepLatticeCustodianBoss(state: SimState, boss: Enemy, dt: number) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  const activeReferences = state.objects.filter(object => object.id.startsWith('lattice-reference') && object.active && object.hp > 0);
  if (boss.bossPhase === 1 && (activeReferences.length === 0 || boss.hp <= boss.maxHp * 0.48)) {
    boss.bossPhase = 2;
    boss.statuses.disrupted = Math.max(boss.statuses.disrupted, 1.1);
    pushEvent(state, 'VEYRA SENN // REFERENCE NETWORK LOST // ARCHIVE RECOVERY LIMITS RELEASED', 3.2);
  }
  moveArenaBoss(state, boss, dt, 365, boss.bossPhase === 2 ? 590 : 455, boss.bossPhase === 2 ? 158 : 120, 0.18);
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph > 0) return;
    const aim = norm({ x: p.x - boss.x, y: p.y - boss.y });
    if (boss.bossPattern === 'surveySweep') {
      for (const angle of [-0.16, -0.08, 0, 0.08, 0.16]) { const c = Math.cos(angle); const s = Math.sin(angle); addProjectile(state, boss.x, boss.y, { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c }, 760, boss.bossPhase === 2 ? 23 : 19, 'enemy', { weapon: 'enemy', armorDamage: 0.9, radius: 6 }); }
      for (const node of activeReferences.slice(0, 2)) { const cx = node.x + node.w / 2; const cy = node.y + node.h / 2; const nodeAim = norm({ x: p.x - cx, y: p.y - cy }); addProjectile(state, cx, cy, nodeAim, 690, boss.bossPhase === 2 ? 17 : 14, 'enemy', { weapon: 'enemy', armorDamage: 0.66, radius: 5 }); }
      pushEvent(state, 'KHEPRI SURVEY SWEEP // PRECISION FIRE FROM REFERENCE FRAME', 2.1);
    } else if (boss.bossPattern === 'referenceLock') {
      plantHazard(state, p.x - 130, p.y + p.vy * 0.3, 'gravityWell', 4.4);
      plantHazard(state, p.x + 130, p.y + p.vy * 0.3, 'gravityWell', 4.4);
      pushEvent(state, activeReferences.length > 0 ? 'REFERENCE LOCK // ACTIVE PYLONS CONSTRAINING MOVEMENT' : 'REFERENCE LOCK // LOCAL MASS COILS ONLY', 2.3);
    } else if (boss.bossPattern === 'archivePurge') {
      const first = activateBarrier(state, 'lattice-shutter');
      const second = activateBarrier(state, 'lattice-shutter');
      plantHazard(state, p.x + p.vx * 0.35, p.y + p.vy * 0.35, 'shockGrid', boss.bossPhase === 2 ? 5 : 4);
      pushEvent(state, first || second ? 'ARCHIVE PURGE // CALIBRATION SHUTTERS + ARC DENIAL ONLINE' : 'ARCHIVE PURGE // SHUTTERS DESTROYED // ARC DENIAL ONLY', 2.3);
    }
    boss.fireCooldown = boss.bossPhase === 2 ? 0.95 : 1.35;
    boss.bossPattern = 'none';
    return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns: Enemy['bossPattern'][] = boss.bossPhase === 2 ? ['surveySweep', 'referenceLock', 'archivePurge', 'surveySweep'] : ['referenceLock', 'surveySweep', 'archivePurge'];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length];
  boss.patternIndex += 1;
  boss.telegraph = boss.bossPattern === 'surveySweep' ? 1.05 : 1.18;
  boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}

function stepTransferAdjudicatorBoss(state: SimState, boss: Enemy, dt: number) { const p = state.player; if (!state.bossActive || p.dead) return; boss.fireCooldown = Math.max(0, boss.fireCooldown - dt); if (boss.bossPhase === 1 && (boss.armor <= 0 || boss.hp <= boss.maxHp * 0.5)) { boss.bossPhase = 2; const arena = state.sectors.find(item => item.id === 'C'); if (arena) arena.gravity = 0.03; for (const partition of state.objects.filter(object => object.id.startsWith('transfer-partition') && object.hp > 0)) partition.active = false; pushEvent(state, 'IONA VALE // COUNTERWEIGHT CLUTCH RELEASED // NEAR-ZERO-G VECTOR AUTHORITY', 3.3); } moveArenaBoss(state, boss, dt, 320, boss.bossPhase === 2 ? 680 : 520, boss.bossPhase === 2 ? 190 : 148, 0.55); if (boss.telegraph > 0 && boss.statuses.disrupted > 0 && (boss.bossPattern === 'brakeWave' || boss.bossPattern === 'partitionSweep')) { boss.telegraph = 0; boss.bossPattern = 'none'; boss.fireCooldown = 1.1; pushEvent(state, 'SENSOR DISRUPTION // ADJUDICATOR MASS-CONTROL PATTERN CANCELLED', 1.7); return; } if (boss.telegraph > 0) { boss.telegraph -= dt; if (boss.telegraph > 0) return; const aim = norm({ x: p.x - boss.x, y: p.y - boss.y }); if (boss.bossPattern === 'brakeWave') { plantHazard(state, p.x + p.vx * 0.65, p.y + p.vy * 0.65, 'vectorWash', boss.bossPhase === 2 ? 6 : 5); pushEvent(state, 'BRAKE WAVE // COUNTERMASS FRONT COMMITTED // DODGE ACROSS THE VECTOR', 2.2); } else if (boss.bossPattern === 'partitionSweep') { const a = activateBarrier(state, 'transfer-partition'); const b = activateBarrier(state, 'transfer-partition'); pushEvent(state, a || b ? 'PARTITION SWEEP // PRESSURE LANES RECONFIGURED' : 'PARTITION SWEEP // SHUTTER HARDWARE DESTROYED', 2.1); } else if (boss.bossPattern === 'recoilVector') { for (const angle of [-0.1, 0, 0.1]) { const c = Math.cos(angle); const s = Math.sin(angle); addProjectile(state, boss.x, boss.y, { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c }, 720, boss.bossPhase === 2 ? 22 : 18, 'enemy', { weapon: 'enemy', armorDamage: 0.82, radius: 7 }); } boss.vx -= aim.x * (boss.bossPhase === 2 ? 520 : 390); boss.vy -= aim.y * (boss.bossPhase === 2 ? 520 : 390); } boss.fireCooldown = boss.bossPhase === 2 ? 0.95 : 1.35; boss.bossPattern = 'none'; return; } if (boss.fireCooldown > 0) return; const patterns: Enemy['bossPattern'][] = boss.bossPhase === 2 ? ['recoilVector', 'brakeWave', 'partitionSweep', 'recoilVector'] : ['partitionSweep', 'brakeWave', 'recoilVector']; boss.bossPattern = patterns[boss.patternIndex % patterns.length]; boss.patternIndex += 1; boss.telegraph = boss.bossPattern === 'recoilVector' ? 0.82 : 1.05; boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y }); }
function stepUmbraMarshalBoss(state: SimState, boss: Enemy, dt: number) { const p = state.player; if (!state.bossActive || p.dead) return; boss.fireCooldown = Math.max(0, boss.fireCooldown - dt); if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.52) { boss.bossPhase = 2; const arena = state.sectors.find(item => item.id === 'C'); if (arena) { arena.gravity = 0.06; arena.pressure = Math.min(arena.pressure, 0.38); arena.targetPressure = Math.min(arena.targetPressure, 0.38); } pushEvent(state, 'OREN SAAL // RESERVE JACKET VENTED // COLD LOW-PRESSURE CONTROL MODE', 3.3); } moveArenaBoss(state, boss, dt, 360, boss.bossPhase === 2 ? 560 : 430, boss.bossPhase === 2 ? 160 : 124, 0.3); if (boss.telegraph > 0 && boss.statuses.disrupted > 0 && (boss.bossPattern === 'busSiphon' || boss.bossPattern === 'busReroute')) { boss.telegraph = 0; boss.bossPattern = 'none'; boss.fireCooldown = 1.1; pushEvent(state, 'SENSOR DISRUPTION // UMBRA BUS PATTERN CANCELLED', 1.7); return; } if (boss.telegraph > 0) { boss.telegraph -= dt; if (boss.telegraph > 0) return; if (boss.bossPattern === 'purgeLance') { const arena = currentSector(state, p.x, p.y); arena.pressure = Math.max(0.18, arena.pressure - 0.09); arena.rapidTimer = Math.max(arena.rapidTimer, 1.8); plantHazard(state, p.x + p.vx * 0.5, p.y + p.vy * 0.5, 'boiloffJet', boss.bossPhase === 2 ? 6 : 5); pushEvent(state, 'PURGE LANCE // CONTROLLED DECOMPRESSION + BOILOFF PLUME', 2.2); } else if (boss.bossPattern === 'busSiphon') { let raised = 0; for (const node of state.objects.filter(object => object.id.startsWith('boss-siphon') && !object.active && object.hp > 0).slice(0, 2)) { node.active = true; node.exposed = true; raised += 1; } pushEvent(state, raised > 0 ? 'BUS SIPHON // CAPACITOR RELAYS ONLINE // ARC OR BREAK THEM' : 'BUS SIPHON // RELAY HARDWARE EXHAUSTED', 2.2); } else if (boss.bossPattern === 'busReroute') { plantHazard(state, p.x - 130, p.y, 'shockGrid', 4.6); plantHazard(state, p.x + 130, p.y, 'shockGrid', 4.6); pushEvent(state, 'GRID REROUTE // PAIRED ARC FIELDS // BREAK THE LINE', 2.1); } boss.fireCooldown = boss.bossPhase === 2 ? 0.95 : 1.35; boss.bossPattern = 'none'; return; } if (boss.fireCooldown > 0) return; const patterns: Enemy['bossPattern'][] = boss.bossPhase === 2 ? ['purgeLance', 'busReroute', 'busSiphon', 'purgeLance'] : ['busSiphon', 'purgeLance', 'busReroute']; boss.bossPattern = patterns[boss.patternIndex % patterns.length]; boss.patternIndex += 1; boss.telegraph = boss.bossPattern === 'purgeLance' ? 0.9 : 1.08; boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y }); }
function stepCustodyDirectorBoss(state: SimState, boss: Enemy, dt: number) { const p = state.player; if (!state.bossActive || p.dead) return; boss.fireCooldown = Math.max(0, boss.fireCooldown - dt); const references = state.objects.filter(object => object.id.startsWith('custody-reference')); const activeReferences = references.filter(object => object.active && object.hp > 0); if (boss.bossPhase === 1 && (activeReferences.length === 0 || boss.hp <= boss.maxHp * 0.45)) { boss.bossPhase = 2; const arena = state.sectors.find(item => item.id === 'C'); if (arena) arena.gravity = 0.07; boss.statuses.disrupted = Math.max(boss.statuses.disrupted, 1); pushEvent(state, 'MARA TETH // CUSTODY RELAY SEVERED // DIRECT CONTROL ONLY', 3.2); } moveArenaBoss(state, boss, dt, 385, boss.bossPhase === 2 ? 610 : 445, boss.bossPhase === 2 ? 170 : 126, 0.22); if (boss.telegraph > 0 && boss.statuses.disrupted > 0 && (boss.bossPattern === 'relayRecall' || boss.bossPattern === 'shutterGeometry')) { boss.telegraph = 0; boss.bossPattern = 'none'; boss.fireCooldown = 1.1; pushEvent(state, 'SENSOR DISRUPTION // CUSTODY CONTROL PATTERN CANCELLED', 1.7); return; } if (boss.telegraph > 0) { boss.telegraph -= dt; if (boss.telegraph > 0) return; const aim = norm({ x: p.x - boss.x, y: p.y - boss.y }); if (boss.bossPattern === 'shutterGeometry') { const a = activateBarrier(state, 'custody-shutter'); const b = activateBarrier(state, 'custody-shutter'); pushEvent(state, a || b ? 'SHUTTER GEOMETRY // FIRING LANES REINDEXED' : 'SHUTTER GEOMETRY // HARDWARE DESTROYED', 2.1); } else if (boss.bossPattern === 'referenceVolley') { for (const angle of [-0.1, 0, 0.1]) { const c = Math.cos(angle); const s = Math.sin(angle); addProjectile(state, boss.x, boss.y, { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c }, 760, boss.bossPhase === 2 ? 23 : 19, 'enemy', { weapon: 'enemy', armorDamage: 0.88, radius: 6 }); } for (const node of activeReferences.slice(0, 2)) { const cx = node.x + node.w / 2; const cy = node.y + node.h / 2; addProjectile(state, cx, cy, norm({ x: p.x - cx, y: p.y - cy }), 690, 15, 'enemy', { weapon: 'enemy', armorDamage: 0.62, radius: 5 }); } pushEvent(state, 'REFERENCE VOLLEY // MULTI-ORIGIN FIRING SOLUTION', 2.1); } else if (boss.bossPattern === 'relayRecall') { if (boss.bossPhase === 1) { const broken = references.find(object => !object.active || object.hp <= 0); if (broken) { broken.hp = Math.max(42, broken.maxHp * 0.58); broken.active = true; broken.exposed = true; pushEvent(state, 'RELAY RECALL // CUSTODY REFERENCE REBUILT // BREAK THE NETWORK', 2.2); } else pushEvent(state, 'RELAY RECALL // NO BROKEN REFERENCE AVAILABLE', 1.8); } } boss.fireCooldown = boss.bossPhase === 2 ? 0.92 : 1.32; boss.bossPattern = 'none'; return; } if (boss.fireCooldown > 0) return; const patterns: Enemy['bossPattern'][] = boss.bossPhase === 2 ? ['referenceVolley', 'shutterGeometry', 'referenceVolley'] : ['shutterGeometry', 'referenceVolley', 'relayRecall']; boss.bossPattern = patterns[boss.patternIndex % patterns.length]; boss.patternIndex += 1; boss.telegraph = boss.bossPattern === 'referenceVolley' ? 0.95 : 1.1; boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y }); }

function stepBaselineKeeperBoss(state: SimState, boss: Enemy, dt: number) {
  const p = state.player; if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.5) {
    boss.bossPhase = 2;
    state.sectors[0].gravity = 0.08; state.sectors[1].gravity = 0.55; state.sectors[2].gravity = 0.04;
    boss.statuses.disrupted = Math.max(boss.statuses.disrupted, 0.8);
    pushEvent(state, 'SERA NOX // BASELINE AUTHORITY SPLIT // ARRAY SHEAR MODE', 3.2);
  }
  moveArenaBoss(state, boss, dt, 360, boss.bossPhase === 2 ? 620 : 460, boss.bossPhase === 2 ? 170 : 132, 0.3);
  if (boss.telegraph > 0 && boss.statuses.disrupted > 0 && boss.bossPattern !== 'baselineFork') { boss.telegraph = 0; boss.bossPattern = 'none'; boss.fireCooldown = 1.05; pushEvent(state, 'REFERENCE DISRUPTION // BASELINE CONTROL PATTERN CANCELLED', 1.7); return; }
  if (boss.telegraph > 0) {
    boss.telegraph -= dt; if (boss.telegraph > 0) return;
    const aim = norm({ x: p.x - boss.x, y: p.y - boss.y });
    if (boss.bossPattern === 'baselineFork') {
      for (const angle of [-0.14, 0, 0.14]) { const c = Math.cos(angle); const ss = Math.sin(angle); addProjectile(state, boss.x, boss.y, { x: aim.x * c - aim.y * ss, y: aim.x * ss + aim.y * c }, 790, boss.bossPhase === 2 ? 24 : 20, 'enemy', { weapon: 'enemy', armorDamage: 0.84, radius: 6 }); }
    } else if (boss.bossPattern === 'parallaxSweep') {
      plantHazard(state, p.x - 180, p.y, 'vectorWash', 5.6); plantHazard(state, p.x + 180, p.y, 'vectorWash', 5.6);
      pushEvent(state, 'PARALLAX SWEEP // TWIN REFERENCE FRONTS // CROSS THE VECTOR', 2.2);
    } else if (boss.bossPattern === 'shearCollapse') {
      plantHazard(state, p.x, p.y, 'gravityWell', 5.2);
      const sector = currentSector(state, p.x, p.y); sector.gravity = Math.max(0.03, Math.min(0.62, sector.gravity < 0.2 ? 0.58 : 0.05));
      pushEvent(state, 'SHEAR COLLAPSE // LOCAL MASS STANDARD INVERTED', 2.2);
    }
    boss.fireCooldown = boss.bossPhase === 2 ? 0.9 : 1.3; boss.bossPattern = 'none'; return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns: Enemy['bossPattern'][] = boss.bossPhase === 2 ? ['parallaxSweep', 'baselineFork', 'shearCollapse', 'baselineFork'] : ['baselineFork', 'shearCollapse', 'parallaxSweep'];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length]; boss.patternIndex += 1; boss.telegraph = boss.bossPattern === 'baselineFork' ? 0.88 : 1.05; boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}

function stepBoss(state: SimState, boss: Enemy, dt: number) {
  if (boss.variant === 'baselineKeeper') { stepBaselineKeeperBoss(state, boss, dt); return; }
  if (boss.variant === 'transferAdjudicator') { stepTransferAdjudicatorBoss(state, boss, dt); return; }
  if (boss.variant === 'umbraMarshal') { stepUmbraMarshalBoss(state, boss, dt); return; }
  if (boss.variant === 'custodyDirector') { stepCustodyDirectorBoss(state, boss, dt); return; }
  if (boss.variant === 'latticeCustodian') { stepLatticeCustodianBoss(state, boss, dt); return; }
  if (boss.variant === 'cascadeCustodian') { stepCascadeCustodianBoss(state, boss, dt); return; }
  if (boss.variant === 'perseidSteward') { stepPerseidStewardBoss(state, boss, dt); return; }
  if (boss.variant === 'orphelineWarden') { stepOrphelineWardenBoss(state, boss, dt); return; }
  if (boss.variant === 'hecateYardmaster') { stepHecateYardmasterBoss(state, boss, dt); return; }
  if (boss.variant === 'pressureBroker') { stepPressureBrokerBoss(state, boss, dt); return; }
  if (boss.variant === 'bondArbiter') { stepBondArbiterBoss(state, boss, dt); return; }
  if (boss.variant === 'forgeChorus') { stepForgeChorusBoss(state, boss, dt); return; }
  if (boss.variant === 'meridianCommander') { stepMeridianBoss(state, boss, dt); return; }
  if (boss.variant === 'salvageCaptain') { stepSalvageBoss(state, boss, dt); return; }
  if (boss.variant === 'yardmind') { stepYardmindBoss(state, boss, dt); return; }
  if (boss.variant === 'foundryMarshal') { stepFoundryBoss(state, boss, dt); return; }
  const p = state.player; if (!state.bossActive || p.dead) return; boss.fireCooldown = Math.max(0, boss.fireCooldown - dt); boss.hazardCooldown = Math.max(0, boss.hazardCooldown - dt); const sector = currentSector(state, boss.x, boss.y); const anchored = boss.anchored && boss.statuses.disrupted <= 0; applyPressureForce(state, boss, sector.id, dt, anchored ? 0.08 : 0.72);
  const breach = nearestActiveBreach(state, sector.id); if (breach && Math.hypot(boss.x - breach.x, boss.y - breach.y) < 125 && !anchored) { boss.statuses.stagger = Math.max(boss.statuses.stagger, 0.3); dealEnemyDamage(state, boss, 20 * dt, 2.2, 1.35); }
  if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.55) beginBossPhaseTwo(state, boss);
  if (boss.statuses.stagger <= 0) { const delta = { x: p.x - boss.x, y: p.y - boss.y }; const distance = len(delta); const toward = norm(delta); const sideways = { x: -toward.y * boss.strafeSign, y: toward.x * boss.strafeSign }; const desired = distance > 430 ? norm({ x: toward.x * 0.65 + sideways.x * 0.4, y: toward.y * 0.65 + sideways.y * 0.4 }) : distance < 280 ? norm({ x: -toward.x * 0.65 + sideways.x * 0.5, y: -toward.y * 0.65 + sideways.y * 0.5 }) : sideways; boss.vx += desired.x * 420 * dt; boss.vy += desired.y * 420 * dt; const speed = Math.hypot(boss.vx, boss.vy); const max = boss.bossPhase === 2 ? 130 : 105; if (speed > max) { boss.vx *= max / speed; boss.vy *= max / speed; } }
  boss.vx *= Math.pow(lerp(0.54, 0.018, sector.gravity), dt); boss.vy *= Math.pow(lerp(0.54, 0.018, sector.gravity), dt); boss.x += boss.vx * dt; boss.y += boss.vy * dt; boss.x = clamp(boss.x, 1580, world.w - 115); boss.y = clamp(boss.y, 210, world.h - 145); for (const object of state.objects) if (isSolidObject(object)) resolveCircleRect(boss, 30, object);
  if (boss.telegraph > 0) { boss.telegraph -= dt; if (boss.telegraph <= 0) { if (boss.bossPattern === 'coilFan') { const aim = norm({ x: p.x - boss.x, y: p.y - boss.y }); boss.telegraphAim = aim; for (const angle of [-0.12, 0, 0.12]) { const c = Math.cos(angle); const s = Math.sin(angle); const dir = { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c }; addProjectile(state, boss.x, boss.y, dir, 700, boss.bossPhase === 2 ? 26 : 22, 'enemy', { weapon: 'enemy', armorDamage: 0.8, healthMultiplier: 1, radius: 7 }); } } else if (boss.bossPattern === 'massPulse') { const delta = { x: p.x - boss.x, y: p.y - boss.y }; const distance = len(delta); if (distance < 330) { const dir = norm(delta); p.vx += dir.x * 520; p.vy += dir.y * 520; applyPlayerDamage(state, 18, 0.1); } spawnEffect(state, boss.x, boss.y, 'pulse', 330, 0.7); } else if (boss.bossPattern === 'craneLock') plantHazard(state, p.x + p.vx * 0.45, p.y + p.vy * 0.45, 'gravityWell', 4.6); boss.fireCooldown = boss.bossPhase === 2 ? 1.35 : 1.8; boss.bossPattern = 'none'; boss.anchored = boss.bossPhase === 1 || boss.patternIndex % 2 === 0; } }
  else if (boss.fireCooldown <= 0) { const patterns: Enemy['bossPattern'][] = ['coilFan', 'massPulse', 'craneLock']; boss.bossPattern = patterns[boss.patternIndex % patterns.length]; boss.patternIndex += 1; boss.telegraph = boss.bossPattern === 'coilFan' ? 0.95 : boss.bossPattern === 'massPulse' ? 0.82 : 1.05; boss.anchored = boss.bossPattern !== 'craneLock'; boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y }); }
}

function stepHazards(state: SimState, dt: number) {
  const p = state.player;
  for (const hazard of state.hazards) {
    if (!hazard.active) continue;
    hazard.life -= dt;
    if (hazard.life <= 0) { hazard.active = false; continue; }
    if (hazard.kind === 'vacuumWake') { for (const enemy of state.enemies) { if (!enemy.active || enemy.dead) continue; const d = Math.hypot(enemy.x - hazard.x, enemy.y - hazard.y); if (d <= 0 || d >= hazard.radius) continue; const dir = norm({ x: hazard.x - enemy.x, y: hazard.y - enemy.y }); const pull = 300 * (1 - d / hazard.radius); enemy.vx += dir.x * pull * dt; enemy.vy += dir.y * pull * dt; enemy.statuses.vacuum = Math.max(enemy.statuses.vacuum, 0.8); if (state.build.specialization === 'pressure-diver' && isParallaxReferenceEnemy(enemy)) { enemy.statuses.disrupted = Math.max(enemy.statuses.disrupted, 1.8); enemy.statuses.stagger = Math.max(enemy.statuses.stagger, staggerDuration(enemy, 0.3)); } dealEnemyDamage(state, enemy, 5 * dt, 0.18, 0.75); } continue; }
    const playerDistance = Math.hypot(p.x - hazard.x, p.y - hazard.y);
    if (!p.dead && hazard.owner !== 'player' && playerDistance < hazard.radius) {
      if (hazard.kind === 'shockGrid') { p.disrupted = Math.max(p.disrupted, 0.45); if (Math.floor(state.time * 4) !== Math.floor((state.time - dt) * 4)) { if (hasTrait(state, 'stormskin')) { applyPlayerDamage(state, 2.2, 0.12); p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 3); } else applyPlayerDamage(state, 4.2 * (hazard.owner === 'enemy' ? state.monsterDamageScale : 1), 0.45); } }
      else if (hazard.kind === 'gravityWell') { const dir = norm({ x: hazard.x - p.x, y: hazard.y - p.y }); const pull = 410 * (1 - playerDistance / hazard.radius); p.vx += dir.x * pull * dt; p.vy += dir.y * pull * dt; }
      else { const dir = norm({ x: p.x - hazard.x, y: p.y - hazard.y }); const push = hazard.kind === 'vectorWash' ? 680 : hazard.kind === 'boiloffJet' ? 440 : 480; p.vx += dir.x * push * dt; p.vy += dir.y * push * dt; const thermalTick = Math.floor(state.time * 4) !== Math.floor((state.time - dt) * 4); if (hazard.kind === 'boiloffJet' && thermalTick) { if (hasTrait(state, 'boiloffSink')) { p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 4); for (const id of ['carbine', 'breacher', 'rail'] as WeaponId[]) p.weaponHeat[id] = Math.max(0, p.weaponHeat[id] - 0.045); } else { p.capacitor = Math.max(0, p.capacitor - 3); p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - 0.05); } } if (hazard.kind === 'coolantJet' && thermalTick && hasTrait(state, 'boiloffSink')) { p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 2); for (const id of ['carbine', 'breacher', 'rail'] as WeaponId[]) p.weaponHeat[id] = Math.max(0, p.weaponHeat[id] - 0.03); } }
    }
    if (hazard.kind === 'coolantJet' || hazard.kind === 'vectorWash' || hazard.kind === 'boiloffJet') for (const enemy of state.enemies) { if (!enemy.active || enemy.dead) continue; const d = Math.hypot(enemy.x - hazard.x, enemy.y - hazard.y); if (d < hazard.radius) { const dir = norm({ x: enemy.x - hazard.x, y: enemy.y - hazard.y }); const push = hazard.kind === 'vectorWash' ? 650 : hazard.kind === 'boiloffJet' ? 470 : 520; enemy.vx += dir.x * push * dt; enemy.vy += dir.y * push * dt; enemy.statuses.stagger = Math.max(enemy.statuses.stagger, staggerDuration(enemy, hazard.kind === 'vectorWash' ? 0.22 : 0.15)); } }
  }
}
function stepDebris(state: SimState, dt: number) { for (const debris of state.debris) { if (!debris.active) continue; const sector = state.sectors.find(item => item.id === debris.sectorId); if (!sector) continue; applyPressureForce(state, debris, sector.id, dt, 1.35); debris.vx *= Math.pow(0.74, dt); debris.vy *= Math.pow(0.74, dt); debris.x += debris.vx * dt; debris.y += debris.vy * dt; for (const enemy of state.enemies) { if (!enemy.active || enemy.dead) continue; const speed = Math.hypot(debris.vx, debris.vy); if (speed < 125 || Math.hypot(debris.x - enemy.x, debris.y - enemy.y) >= enemyRadius + debris.radius) continue; dealEnemyDamage(state, enemy, speed * 0.045, 0.75, 1.15, 0.1, { x: debris.vx, y: debris.vy }, 'debris'); debris.vx *= -0.2; debris.vy *= -0.2; } } }
function projectileObjectCollision(state: SimState, projectile: Projectile) { let collided: CombatObject | null = null; for (const object of state.objects) { if (!isSolidObject(object)) continue; if (object.id === projectile.lastObjectId && projectile.lastObjectT > 0) continue; if (pointInRect(projectile.x, projectile.y, object)) { collided = object; break; } } if (!collided) { if (projectile.lastObjectT <= 0) projectile.lastObjectId = null; return false; } projectile.lastObjectId = collided.id; projectile.lastObjectT = 0.16; if (projectile.owner === 'player') { recordImpact(state, { target: 'object', material: collided.material, objectKind: collided.kind, heavy: projectile.weapon === 'rail' || projectile.damage >= 34 }); damageObject(state, collided, projectile); } if (projectile.owner === 'player' && projectile.weapon === 'rail' && hasTrait(state, 'shutterLine') && collided.destructible && collided.material !== 'bulkhead') { projectile.penetration += 20; projectile.vx *= 1.08; projectile.vy *= 1.08; spawnEffect(state, projectile.x, projectile.y, 'impact', 30, 0.24); return false; } const resistance = materialResistance(collided.material); if (projectile.penetration > resistance && collided.material !== 'bulkhead') { projectile.penetration -= resistance; projectile.damage *= 0.62; projectile.vx *= 0.94; projectile.vy *= 0.94; spawnEffect(state, projectile.x, projectile.y, 'impact', 26, 0.25); return false; } projectile.active = false; spawnEffect(state, projectile.x, projectile.y, 'impact', 22, 0.2); return true; }
function stepProjectiles(state: SimState, dt: number) {
  for (const projectile of state.projectiles) { if (!projectile.active) continue; projectile.life -= dt; projectile.lastObjectT = Math.max(0, projectile.lastObjectT - dt); if (projectile.life <= 0) { projectile.active = false; continue; } const sector = currentSector(state, projectile.x, projectile.y); applyPressureForce(state, projectile, sector.id, dt, 0.08); projectile.x += projectile.vx * dt; projectile.y += projectile.vy * dt; if (projectile.x < 70 || projectile.x > world.w - 70 || projectile.y < 140 || projectile.y > world.h - 70) { projectile.active = false; continue; } if (projectileObjectCollision(state, projectile)) continue;
    if (projectile.owner === 'player') { for (const enemy of state.enemies) { if (enemy.dead || !enemy.active) continue; if (Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y) <= (enemy.role === 'boss' ? 31 : enemyRadius) + projectile.radius) { const wasTelegraphing = enemy.telegraph > 0; const wasMarked = enemy.statuses.marked > 0; const beforeArmor = enemy.armor; const closeBreacher = projectile.weapon === 'breacher' && Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) <= 300; let armorDamage = projectile.armorDamage; let healthMultiplier = projectile.healthMultiplier; if (closeBreacher) { const closeScale = Math.max(state.build.specialization === 'breach-vanguard' ? 1.25 : 1, hasTrait(state, 'closeBreach') ? 1.3 : 1); armorDamage *= closeScale; if (hasTrait(state, 'closeBreach')) healthMultiplier *= 0.88; } dealEnemyDamage(state, enemy, projectile.damage, armorDamage, healthMultiplier, projectile.knockback, { x: projectile.vx, y: projectile.vy }, 'ballistic'); const armorBroken = beforeArmor > 0 && enemy.armor <= 0; if (!enemy.dead && closeBreacher && state.build.operatorClass === 'vanguard') { state.classState.vanguardGuard = Math.max(state.classState.vanguardGuard, armorBroken ? (state.build.classResonanceTier >= 2 ? 4.5 : state.build.classResonanceTier >= 1 ? 4 : 3.2) : (state.build.classResonanceTier >= 2 ? 3 : state.build.classResonanceTier >= 1 ? 2.5 : 2)); if (armorBroken) pushEvent(state, 'VANGUARD BREACH GUARD // ARMOR BREAK EXTENDS BRACE', 1.2); } if (!enemy.dead && closeBreacher && armorBroken) { enemy.statuses.stagger = Math.max(enemy.statuses.stagger, staggerDuration(enemy, 0.5)); if (state.build.specialization === 'breach-vanguard' && isParallaxReferenceEnemy(enemy)) { enemy.statuses.disrupted = Math.max(enemy.statuses.disrupted, 2.8); enemy.hazardCooldown = Math.max(enemy.hazardCooldown, 3.8); } if (state.build.specialization === 'breach-vanguard' && state.build.specializationOverclock) state.player.armor = Math.min(state.player.maxArmor, state.player.armor + 5); } if (!enemy.dead && projectile.weapon === 'breacher' && hasTrait(state, 'redlineBulwark') && state.player.weaponHeat.breacher >= 0.75) state.player.armor = Math.min(state.player.maxArmor, state.player.armor + 0.6); const familyExecution = !enemy.dead && wasMarked && state.build.mechanics.markExecutionTrace && projectile.weapon === state.build.classSkillFamily.family; const precisionRail = !enemy.dead && projectile.weapon === 'rail' && wasMarked && (state.build.specialization === 'survey-deadeye' || hasTrait(state, 'coldWitness')); if (precisionRail || familyExecution) { enemy.statuses.marked = 0; const parallaxDeadeye = state.build.specialization === 'survey-deadeye' && isParallaxReferenceEnemy(enemy); enemy.statuses.armorBreach = Math.max(enemy.statuses.armorBreach, parallaxDeadeye ? 5.5 : hasTrait(state, 'coldWitness') ? 5 : 4); if ((state.build.specialization === 'survey-deadeye' || familyExecution) && wasTelegraphing) { enemy.telegraph = 0; enemy.bossPattern = 'none'; } if (state.build.specialization === 'survey-deadeye') { state.classState.vectorWindow = Math.max(state.classState.vectorWindow, state.build.specializationOverclock ? 1.35 : 0.85); if (state.build.specializationOverclock) state.player.abilityCooldowns[1] = Math.min(state.player.abilityCooldowns[1], 1.6); } if (parallaxDeadeye) state.player.abilityCooldowns[1] = Math.min(state.player.abilityCooldowns[1], state.build.specializationOverclock ? 1.6 : 2); if (familyExecution) state.player.abilityCooldowns[1] = Math.min(state.player.abilityCooldowns[1], 2.4); if (hasTrait(state, 'coldWitness')) state.player.weaponHeat.rail = Math.max(0, state.player.weaponHeat.rail - 0.1); pushEvent(state, state.build.specialization === 'survey-deadeye' ? `SURVEY FOLLOWTHROUGH // ${enemy.label.toUpperCase()} MARK CONSUMED // SLIPSTREAM REPRIMED` : familyExecution ? `FAMILY TRACE // ${state.build.classSkillFamily.family?.toUpperCase()} // ${enemy.label.toUpperCase()} MARK CONSUMED` : `PRECISION TRACE // ${enemy.label.toUpperCase()} MARK CONSUMED`, 1.2); } if (projectile.weapon === 'carbine' && hasTrait(state, 'arcspindle') && (enemy.statuses.disrupted > 0 || enemy.statuses.conductive > 0)) state.player.capacitor = Math.min(state.player.maxCapacitor, state.player.capacitor + 3); if (projectile.weapon === 'rail' && hasTrait(state, 'nullpoint') && wasTelegraphing && !enemy.dead) { enemy.telegraph = 0; enemy.bossPattern = 'none'; state.player.capacitor = Math.min(state.player.maxCapacitor, state.player.capacitor + 8); pushEvent(state, `NULLPOINT INTERRUPT // ${enemy.label.toUpperCase()} FIRING SOLUTION BROKEN`, 1.3); } spawnEffect(state, enemy.x, enemy.y, 'impact', 30, 0.24); if (state.build.mechanics.railFragment && projectile.weapon === 'rail' && projectile.penetration > 38) { const forward = norm({ x: projectile.vx, y: projectile.vy }); for (const angle of [-0.3, 0.3]) { const c = Math.cos(angle); const s = Math.sin(angle); const dir = { x: forward.x * c - forward.y * s, y: forward.x * s + forward.y * c }; addProjectile(state, enemy.x + dir.x * 28, enemy.y + dir.y * 28, dir, 720, projectile.damage * 0.35 * (state.build.mechanics.railFragmentScale || 1), 'player', { weapon: 'carbine', penetration: 8 * (state.build.mechanics.railFragmentScale || 1), armorDamage: 0.45, healthMultiplier: 0.9, knockback: 0.025, radius: 3 }); } } if (projectile.penetration > 38 && enemy.role !== 'boss') { projectile.penetration -= 38; projectile.damage *= 0.58; const speed = Math.hypot(projectile.vx, projectile.vy) || 1; projectile.x += projectile.vx / speed * 54; projectile.y += projectile.vy / speed * 54; } else projectile.active = false; break; } } } else if (!state.player.dead && Math.hypot(projectile.x - state.player.x, projectile.y - state.player.y) <= playerRadius + projectile.radius) { applyPlayerDamage(state, projectile.damage * state.monsterDamageScale, 0); projectile.active = false; }
  }
}
function stepGroundLoot(state: SimState, dt: number) {
  const p = state.player;
  for (const drop of state.groundLoot) {
    if (!drop.active || drop.collected) continue;
    drop.age += dt;
    if (drop.age < 0.28) continue;
    const dx = p.x - drop.x; const dy = p.y - drop.y; const distance = Math.hypot(dx, dy);
    const magnetRadius = drop.source === 'boss' ? 620 : drop.rarity === 'Prototype' ? 210 : 165;
    if (distance > 1 && distance < magnetRadius) { const pull = Math.min(distance, (drop.source === 'boss' ? 620 : 360) * dt); drop.x += dx / distance * pull; drop.y += dy / distance * pull; }
    if (distance <= 58) {
      drop.collected = true; drop.active = false;
      state.collectedLoot.push({ id: drop.id, enemyId: drop.enemyId, enemyLabel: drop.enemyLabel, rarity: drop.rarity, source: drop.source, recoveryQualityFloor: drop.recoveryQualityFloor, recoveryLevel: drop.recoveryLevel, monsterLevel: drop.monsterLevel });
      pushEvent(state, `${lootFeedLabel(drop.rarity)} // ${drop.enemyLabel.toUpperCase()} // EXTRACT TO KEEP`, drop.rarity === 'Singular' ? 2.4 : 1.6);
    }
  }
  if (state.bossDefeated && !state.complete && !state.groundLoot.some(drop => drop.source === 'boss' && drop.active && !drop.collected)) { state.complete = true; pushEvent(state, 'COMMAND RECOVERY SECURED // DEEP EXTRACTION READY', 3.2); }
}
function stepEffects(state: SimState, dt: number) { for (const effect of state.effects) if (effect.active) { effect.life -= dt; if (effect.life <= 0) effect.active = false; } }
function stepDamageNumbers(state: SimState, dt: number) { for (const popup of state.damageNumbers) if (popup.active) { popup.life -= dt; if (popup.life <= 0) popup.active = false; } }
function updateSquad(state: SimState) { state.squadSuppressing = state.enemies.some(enemy => enemy.role === 'suppressor' && enemy.active && !enemy.dead && enemy.telegraph > 0 && clearLine(state, enemy.x, enemy.y, state.player.x, state.player.y)); }
function stepBuildMechanics(state: SimState) { if (!state.build.mechanics.arcDrone || state.time < state.droneTick) return; const target = state.enemies.filter(enemy => enemy.active && !enemy.dead && (enemy.statuses.disrupted > 0 || enemy.statuses.conductive > 0)).sort((a, b) => Math.hypot(a.x - state.player.x, a.y - state.player.y) - Math.hypot(b.x - state.player.x, b.y - state.player.y))[0]; state.droneTick = state.time + 1.55; if (!target || Math.hypot(target.x - state.player.x, target.y - state.player.y) > 760) return; dealEnemyDamage(state, target, 8 * (state.build.mechanics.arcDroneScale || 1), 0.55, 1); spawnEffect(state, target.x, target.y, 'arc', 48, 0.35); }
function unlockBoss(state: SimState) { if (state.bossGateHold || state.bossActive || activeSquadCount(state) > 0) return; const boss = findBoss(state); if (!boss) return; boss.active = true; state.bossActive = true; state.telemetry.bossStart = state.time; const link = state.links.find(item => item.id === 'door-bc'); if (link) link.open = true; const gate = state.objects.find(item => item.id === 'boss-gate'); if (gate) gate.active = false; pushEvent(state, `${boss.label.toUpperCase()} ONLINE // DEEP ZONE OPEN`, 4); }
export function releaseBossGate(state: SimState) { state.bossGateHold = false; unlockBoss(state); }
export function getSquadRemaining(state: SimState) { return activeSquadCount(state); }

export function stepSimulation(state: SimState, dt: number) { state.time += dt; state.pulse = Math.max(0, state.pulse - dt); state.weaponFlash = Math.max(0, state.weaponFlash - dt); state.eventT = Math.max(0, state.eventT - dt); stepPressure(state, dt); updateSquad(state); stepPlayer(state, dt); for (const enemy of state.enemies) stepEnemy(state, enemy, dt); stepHazards(state, dt); stepDebris(state, dt); stepProjectiles(state, dt); stepGroundLoot(state, dt); stepBuildMechanics(state); stepEffects(state, dt); stepDamageNumbers(state, dt); unlockBoss(state); if (!state.complete) state.telemetry.duration = state.time; if (state.time >= state.telemetry.nextTraceAt && state.telemetry.trace.length < 720) { const p = state.player; state.telemetry.trace.push({ t: Math.round(state.time * 10) / 10, x: Math.round(p.x), y: Math.round(p.y), hp: Math.round(p.hp), armor: Math.round(p.armor), weapon: p.currentWeapon }); state.telemetry.nextTraceAt = state.time + 1; } }
export function getWorldSize() { return world; }
export function getPlayerSector(state: SimState) { return currentSector(state, state.player.x, state.player.y); }
export function getBoss(state: SimState) { return findBoss(state); }
export function getClassMechanicStatus(state: SimState) {
  if (state.build.operatorClass === 'vanguard') {
    const active = state.classState.vanguardGuard > 0;
    return { id: 'vanguard' as const, label: 'BREACH GUARD', active, detail: active ? `${state.classState.vanguardGuard.toFixed(1)}s // armor impact reduced` : 'Breach Rush, Bulwark Pulse, or close Breacher contact raises Guard' };
  }
  if (state.build.operatorClass === 'vector') {
    const active = state.classState.vectorWindow > 0;
    return { id: 'vector' as const, label: 'SLIPSTREAM', active, detail: active ? `${state.classState.vectorWindow.toFixed(1)}s // next shot stabilized` : 'Vector Shift, Deadeye Lock, or dodge primes the next shot' };
  }
  if (state.build.operatorClass === 'systems') {
    const active = state.classState.systemsLinks > 0;
    return { id: 'systems' as const, label: 'CLOSED LOOP', active, detail: active ? `${state.classState.systemsLinks}/2 links // use a different class skill` : 'Rotate WELL / HACK / CHAIN to recycle the network' };
  }
  return { id: 'none' as const, label: 'NO CLASS DOCTRINE', active: false, detail: 'Neutral combat build' };
}
export function getStatusLabels(enemy: Enemy) { const labels: string[] = []; if (enemy.statuses.armorBreach > 0) labels.push('ARMOR BREACH'); if (enemy.statuses.disrupted > 0) labels.push('DISRUPTED'); if (enemy.statuses.marked > 0) labels.push('MARKED'); if (enemy.statuses.stagger > 0) labels.push('STAGGER'); if (enemy.statuses.conductive > 0) labels.push('CONDUCTIVE'); if (enemy.statuses.vacuum > 0) labels.push('VACUUM'); return labels; }
