import assert from 'node:assert/strict';
import { carbineVariantDefinition, carbineVariantPresentation, carbineVariantDefinitions } from '../src/game/classArsenal';
import { createDefaultProfile, deriveCombatBuild, setOperatorClass, type Item } from '../src/game/meta';
import { createSimulation, triggerFire, type CombatBuild } from '../src/game/sim';

function systemsProfileWithCarbine(itemPatch: Partial<Item>) {
  const systems = setOperatorClass(createDefaultProfile(), 'systems').profile;
  const equippedId = systems.equipped.carbine;
  assert.ok(equippedId, 'Systems profiles must equip a Carbine before variant resolution.');
  return {
    ...systems,
    inventory: systems.inventory.map(item => item.id === equippedId ? { ...item, ...itemPatch } : item),
  };
}

const burstBuild = deriveCombatBuild(systemsProfileWithCarbine({
  baseId: 'm7-frame',
  name: 'M-7 Service Frame',
  frameIdentity: 'carbine-feedline',
}));
const precisionBuild = deriveCombatBuild(systemsProfileWithCarbine({
  baseId: 'm7-dense-flight-receiver',
  name: 'M-7 Dense-Flight Receiver',
  frameIdentity: 'carbine-hypervelocity',
}));

assert.equal(carbineVariantDefinitions.length, 2, 'P14-A should author exactly the Burst + Precision Carbine pair.');
assert.deepEqual(carbineVariantDefinitions.map(definition => definition.id).sort(), ['carbine-burst', 'carbine-precision']);
assert.equal(burstBuild.classSkillFamily.family, 'carbine', 'Burst must remain inside the Systems-owned Carbine family.');
assert.equal(precisionBuild.classSkillFamily.family, 'carbine', 'Precision must remain inside the Systems-owned Carbine family.');
assert.equal(burstBuild.classSkillFamily.weaponVariant, 'carbine-burst');
assert.equal(precisionBuild.classSkillFamily.weaponVariant, 'carbine-precision');

const burstDefinition = carbineVariantDefinition('carbine-burst');
const precisionDefinition = carbineVariantDefinition('carbine-precision');
const burstDps = burstDefinition.stats.damage * burstDefinition.stats.roundsPerTrigger * burstDefinition.stats.rate;
const precisionDps = precisionDefinition.stats.damage * precisionDefinition.stats.roundsPerTrigger * precisionDefinition.stats.rate;
assert.ok(Math.abs(burstDps - precisionDps) / precisionDps < 0.02, 'Carbine pair should trade handling rather than hide a dominant raw-DPS option.');
assert.equal(burstDefinition.stats.roundsPerTrigger, 3, 'Burst Carbine must commit a three-round packet.');
assert.equal(precisionDefinition.stats.roundsPerTrigger, 1, 'Precision Carbine must remain deliberate single-shot fire.');
assert.ok(precisionDefinition.stats.penetration > burstDefinition.stats.penetration * 2, 'Precision must own the penetration lane.');
assert.ok(precisionDefinition.stats.spread < burstDefinition.stats.spread * 0.4, 'Precision must own the tight grouping lane.');
assert.ok(burstDefinition.stats.magazine > precisionDefinition.stats.magazine * 2, 'Burst must own the larger sustained-feed magazine.');
assert.ok(burstDefinition.stats.heatDissipation > precisionDefinition.stats.heatDissipation, 'Burst should recover thermal load faster between packets.');

const burstPresentation = carbineVariantPresentation('carbine-burst')!;
const precisionPresentation = carbineVariantPresentation('carbine-precision')!;
assert.ok(burstPresentation.silhouetteScaleX < 1 && precisionPresentation.silhouetteScaleX > 1, 'Variant silhouettes must visibly separate compact Burst from long Precision.');
assert.ok(burstPresentation.muzzleWidthMul > precisionPresentation.muzzleWidthMul, 'Burst muzzle presentation must read broader than Precision.');
assert.notEqual(burstPresentation.recoilVisualMul, precisionPresentation.recoilVisualMul, 'Variant handling must not collapse to one recoil presentation.');

function fireSnapshot(build: CombatBuild) {
  const state = createSimulation(build);
  assert.equal(state.player.currentWeapon, 'carbine', 'Systems combat should boot into its owned Carbine family.');
  state.player.aim = { x: 1, y: 0 };
  const beforeMag = state.player.mags.carbine;
  const beforeHeat = state.player.weaponHeat.carbine;
  assert.equal(triggerFire(state), true, 'Authored Carbine variant should fire.');
  const projectiles = state.projectiles
    .filter(projectile => projectile.active && projectile.owner === 'player')
    .map(projectile => ({
      damage: projectile.damage,
      penetration: projectile.penetration,
      vx: projectile.vx,
      vy: projectile.vy,
    }));
  return {
    variantId: state.weapons.carbine.variantId,
    weaponName: state.weapons.carbine.name,
    roundsPerTrigger: state.weapons.carbine.roundsPerTrigger,
    magSpent: beforeMag - state.player.mags.carbine,
    heatAdded: state.player.weaponHeat.carbine - beforeHeat,
    projectileCount: projectiles.length,
    projectiles,
  };
}

const burstA = fireSnapshot(burstBuild);
const burstB = fireSnapshot(burstBuild);
assert.deepEqual(burstA, burstB, 'Burst packet emission must remain deterministic across identical simulations.');
assert.equal(burstA.variantId, 'carbine-burst');
assert.match(burstA.weaponName, /Burst Carbine/);
assert.equal(burstA.roundsPerTrigger, 3);
assert.equal(burstA.magSpent, 3, 'Burst must consume all three committed rounds.');
assert.equal(burstA.projectileCount, 3, 'Burst must emit three ballistic rounds per fire cycle.');
assert.ok(Math.abs(burstA.heatAdded - burstDefinition.stats.heatPerShot * 3) < 1e-9, 'Burst heat must account for every committed round.');
assert.ok(new Set(burstA.projectiles.map(projectile => projectile.vx.toFixed(6))).size > 1, 'Burst packet should visibly separate tracer velocities.');

const precision = fireSnapshot(precisionBuild);
assert.equal(precision.variantId, 'carbine-precision');
assert.match(precision.weaponName, /Precision Carbine/);
assert.equal(precision.roundsPerTrigger, 1);
assert.equal(precision.magSpent, 1, 'Precision must consume one round per fire cycle.');
assert.equal(precision.projectileCount, 1, 'Precision must emit one ballistic round.');
assert.ok(precision.projectiles[0]!.penetration > burstA.projectiles[0]!.penetration * 2, 'Precision projectile should preserve its authored penetration advantage.');
assert.ok(precision.projectiles[0]!.damage > burstA.projectiles[0]!.damage * 2, 'Precision projectile should preserve its authored per-round damage advantage.');

console.log(`P14_A_SYSTEMS_CARBINE_PASS burstDps=${burstDps.toFixed(2)} precisionDps=${precisionDps.toFixed(2)} burstRounds=${burstA.projectileCount} precisionRounds=${precision.projectileCount}`);
