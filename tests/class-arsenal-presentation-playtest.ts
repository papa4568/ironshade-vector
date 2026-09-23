import assert from 'node:assert/strict';
import {
  breacherVariantDefinitions,
  carbineVariantDefinitions,
  railVariantDefinitions,
  weaponVariantDefinition,
  weaponVariantPresentation,
  weaponVariantThermalCue,
  type WeaponVariantId,
} from '../src/game/classArsenal';
import { weaponVariantAudioTuning } from '../src/game/feedback';
import { createDefaultProfile, deriveCombatBuild, setOperatorClass, type Item, type OperatorClassId } from '../src/game/meta';
import { resolvePlayerHandlingAnimation } from '../src/game/playerHandlingAnimation';
import { createSimulation, stepSimulation, triggerFire, triggerVent, type CombatBuild, type WeaponId } from '../src/game/sim';

type VariantCase = {
  id: WeaponVariantId;
  operatorClass: OperatorClassId;
  family: WeaponId;
  baseId: string;
  name: string;
  frameIdentity: NonNullable<Item['frameIdentity']>;
};

const cases: VariantCase[] = [
  { id: 'carbine-burst', operatorClass: 'systems', family: 'carbine', baseId: 'm7-sustained-feed-spine', name: 'M-7 Sustained-Feed Spine', frameIdentity: 'carbine-feedline' },
  { id: 'carbine-precision', operatorClass: 'systems', family: 'carbine', baseId: 'm7-dense-flight-receiver', name: 'M-7 Dense-Flight Receiver', frameIdentity: 'carbine-hypervelocity' },
  { id: 'breacher-slug', operatorClass: 'vanguard', family: 'breacher', baseId: 'b4-dense-choke-cage', name: 'B-4 Dense-Choke Cage', frameIdentity: 'breacher-dense' },
  { id: 'breacher-rapid', operatorClass: 'vanguard', family: 'breacher', baseId: 'b4-cryo-cycle-action', name: 'B-4 Cryo-Cycle Action', frameIdentity: 'breacher-cryo' },
  { id: 'rail-charge', operatorClass: 'vector', family: 'rail', baseId: 'r2-hypervelocity-bed', name: 'R-2 Hypervelocity Rail Bed', frameIdentity: 'rail-hypervelocity' },
  { id: 'rail-repeater', operatorClass: 'vector', family: 'rail', baseId: 'r2-thermal-reference', name: 'R-2 Thermal Reference Rails', frameIdentity: 'rail-thermal' },
];

const definitions = [
  ...carbineVariantDefinitions,
  ...breacherVariantDefinitions,
  ...railVariantDefinitions,
];
assert.equal(definitions.length, 6, 'P14-E must polish the complete six-variant arsenal.');

function buildFor(entry: VariantCase): CombatBuild {
  const profile = setOperatorClass(createDefaultProfile(), entry.operatorClass).profile;
  const equippedId = profile.equipped[entry.family];
  assert.ok(equippedId, `${entry.operatorClass} must equip ${entry.family}.`);
  const patched = {
    ...profile,
    inventory: profile.inventory.map(item => item.id === equippedId ? {
      ...item,
      baseId: entry.baseId,
      name: entry.name,
      frameIdentity: entry.frameIdentity,
    } : item),
  };
  const build = deriveCombatBuild(patched);
  assert.equal(build.classSkillFamily.weaponVariant, entry.id);
  return build;
}

function handlingSignature(entry: VariantCase) {
  const presentation = weaponVariantPresentation(entry.id)!;
  const weapon = weaponVariantDefinition(entry.id);
  const sample = resolvePlayerHandlingAnimation({
    operatorClass: entry.operatorClass,
    weapon: entry.family,
    weaponVariantId: entry.id,
    time: 2.35,
    vx: 180,
    vy: 40,
    aimX: 1,
    aimY: 0,
    moveX: 0.8,
    moveY: 0.2,
    weaponFlash: 0.05,
    fireCooldown: entry.family === 'rail' ? 0.2 : 0.05,
    weaponRate: weapon.stats.rate,
    firingIntent: true,
    reloadT: 0,
    reloadDuration: weapon.stats.reloadSeconds,
    ventT: 0.42,
    ventDuration: 1,
    heat: Math.min(0.99, presentation.thermalWarningAt + 0.08),
    dodgeTime: 0,
    hit: 0,
  });
  const chargeSample = resolvePlayerHandlingAnimation({
    operatorClass: entry.operatorClass,
    weapon: entry.family,
    weaponVariantId: entry.id,
    time: 2.35,
    vx: 180,
    vy: 40,
    aimX: 1,
    aimY: 0,
    moveX: 0.8,
    moveY: 0.2,
    weaponFlash: 0.05,
    fireCooldown: entry.family === 'rail' ? 0.2 : 0.05,
    weaponRate: weapon.stats.rate,
    firingIntent: true,
    reloadT: 0,
    reloadDuration: weapon.stats.reloadSeconds,
    ventT: 0,
    ventDuration: 1,
    heat: Math.min(0.99, presentation.thermalWarningAt + 0.08),
    dodgeTime: 0,
    hit: 0,
  });
  return {
    recoil: Number(sample.recoil.toFixed(4)),
    charge: Number(chargeSample.charge.toFixed(4)),
    vent: Number(sample.vent.toFixed(4)),
    overheat: Number(sample.overheat.toFixed(4)),
  };
}

type SustainedResult = {
  shots: number;
  vents: number;
  maxHeat: number;
  warningFrames: number;
  criticalFrames: number;
  finalHeat: number;
};

function sustainedFire(entry: VariantCase): SustainedResult {
  const state = createSimulation(buildFor(entry));
  assert.equal(state.player.currentWeapon, entry.family);
  assert.equal(state.weapons[entry.family].variantId, entry.id);
  state.bossGateHold = true;
  state.player.aim = { x: 1, y: 0 };
  state.player.move = { x: 0, y: 0 };
  state.player.maxHp = 100000;
  state.player.hp = 100000;
  state.player.maxArmor = 100000;
  state.player.armor = 100000;
  for (const enemy of state.enemies) {
    enemy.active = false;
    enemy.dead = true;
  }

  const dt = 0.025;
  let shots = 0;
  let vents = 0;
  let maxHeat = 0;
  let warningFrames = 0;
  let criticalFrames = 0;

  for (let elapsed = 0; elapsed < 14; elapsed += dt) {
    const heatBefore = state.player.weaponHeat[entry.family];
    const cueBefore = weaponVariantThermalCue(entry.id, heatBefore);
    if (cueBefore === 'warning') warningFrames += 1;
    if (cueBefore === 'critical') {
      criticalFrames += 1;
      if (state.player.ventT <= 0 && triggerVent(state)) vents += 1;
    }
    if (triggerFire(state)) shots += 1;
    stepSimulation(state, dt);
    const heatAfter = state.player.weaponHeat[entry.family];
    assert.ok(Number.isFinite(heatAfter), `${entry.id} thermal state must remain finite.`);
    assert.ok(heatAfter >= 0 && heatAfter <= 1, `${entry.id} thermal state escaped [0,1].`);
    maxHeat = Math.max(maxHeat, heatAfter);
  }

  assert.equal(state.player.dead, false, `${entry.id} isolated sustained-fire QA must not kill the operator.`);
  assert.ok(shots >= 4, `${entry.id} must sustain multiple live fire cycles during QA.`);
  return {
    shots,
    vents,
    maxHeat,
    warningFrames,
    criticalFrames,
    finalHeat: state.player.weaponHeat[entry.family],
  };
}

const presentationSignatures = new Set<string>();
const audioSignatures = new Set<string>();
const handlingSignatures = new Set<string>();
const sustainedById = new Map<WeaponVariantId, SustainedResult>();

for (const entry of cases) {
  const presentation = weaponVariantPresentation(entry.id)!;
  assert.ok(presentation.thermalWarningAt > 0.5 && presentation.thermalWarningAt < presentation.thermalCriticalAt, `${entry.id} needs useful warning headroom.`);
  assert.ok(presentation.thermalCriticalAt <= 0.98, `${entry.id} critical tell must arrive before the simulation hard overheat gate.`);
  assert.equal(weaponVariantThermalCue(entry.id, Math.max(0, presentation.thermalWarningAt - 0.01)), 'nominal');
  assert.equal(weaponVariantThermalCue(entry.id, presentation.thermalWarningAt), 'warning');
  assert.equal(weaponVariantThermalCue(entry.id, presentation.thermalCriticalAt), 'critical');

  const audio = weaponVariantAudioTuning(entry.id);
  assert.ok(audio.gainMultiplier > 0.75 && audio.gainMultiplier < 1.25, `${entry.id} audio gain must stay mix-safe.`);
  assert.ok(audio.mechanicalGainMultiplier > 0.75 && audio.mechanicalGainMultiplier < 1.25, `${entry.id} mechanical layer must stay mix-safe.`);
  assert.ok(audio.tailGainMultiplier > 0.7 && audio.tailGainMultiplier < 1.3, `${entry.id} tail layer must stay mix-safe.`);

  const handling = handlingSignature(entry);
  presentationSignatures.add([
    presentation.silhouetteScaleX,
    presentation.muzzleLengthMul,
    presentation.muzzleWidthMul,
    presentation.recoilVisualMul,
    presentation.thermalWarningAt,
    presentation.thermalCriticalAt,
  ].join(':'));
  audioSignatures.add([audio.pitchCents, audio.gainMultiplier, audio.mechanicalGainMultiplier, audio.tailGainMultiplier].join(':'));
  handlingSignatures.add([handling.recoil, handling.charge, handling.vent, handling.overheat].join(':'));

  sustainedById.set(entry.id, sustainedFire(entry));
}

assert.equal(presentationSignatures.size, 6, 'Every P14-E variant needs a distinct visual/thermal signature.');
assert.equal(audioSignatures.size, 6, 'Every P14-E variant needs a distinct layered-audio signature.');
assert.equal(handlingSignatures.size, 6, 'Every P14-E variant needs a distinct handling response signature.');

for (const [leftId, rightId] of [
  ['carbine-burst', 'carbine-precision'],
  ['breacher-slug', 'breacher-rapid'],
  ['rail-charge', 'rail-repeater'],
] as const) {
  const left = weaponVariantPresentation(leftId)!;
  const right = weaponVariantPresentation(rightId)!;
  assert.notEqual(left.silhouetteScaleX, right.silhouetteScaleX, `${leftId}/${rightId} silhouettes must remain visibly distinct.`);
  assert.notEqual(left.handlingRecoilMul, right.handlingRecoilMul, `${leftId}/${rightId} recoil handling must differ.`);
  assert.notEqual(left.audioPitchCents, right.audioPitchCents, `${leftId}/${rightId} audio pitch identity must differ.`);
  assert.notEqual(left.thermalWarningAt, right.thermalWarningAt, `${leftId}/${rightId} thermal warning timing must differ.`);

  const leftRun = sustainedById.get(leftId)!;
  const rightRun = sustainedById.get(rightId)!;
  const leftSignature = [leftRun.shots, leftRun.vents, leftRun.maxHeat.toFixed(3)].join(':');
  const rightSignature = [rightRun.shots, rightRun.vents, rightRun.maxHeat.toFixed(3)].join(':');
  assert.notEqual(leftSignature, rightSignature, `${leftId}/${rightId} sustained-fire playtest must preserve same-family variety.`);
}

const chargeHandling = handlingSignature(cases.find(entry => entry.id === 'rail-charge')!);
const repeaterHandling = handlingSignature(cases.find(entry => entry.id === 'rail-repeater')!);
assert.ok(chargeHandling.charge > repeaterHandling.charge, 'Charge Rail must visibly brace/spool harder than Repeater Rail.');

const thermalSummary = cases
  .map(entry => {
    const run = sustainedById.get(entry.id)!;
    return `${entry.id}=${run.shots}s/${run.vents}v/${run.maxHeat.toFixed(2)}h`;
  })
  .join(',');

console.log(`P14_E_PRESENTATION_PLAYTEST_PASS variants=${cases.length} signatures=visual+handling+audio thermal=${thermalSummary}`);
