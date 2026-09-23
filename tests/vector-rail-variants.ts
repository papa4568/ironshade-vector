import assert from 'node:assert/strict';
import { railVariantDefinition, railVariantDefinitions, railVariantPresentation, resolveRailVariant } from '../src/game/classArsenal';
import { createDefaultProfile, deriveCombatBuild, setOperatorClass, type Item } from '../src/game/meta';
import { createSimulation, triggerFire, type CombatBuild } from '../src/game/sim';

function vectorProfileWithRail(itemPatch: Partial<Item>) {
  const vector = setOperatorClass(createDefaultProfile(), 'vector').profile;
  const equippedId = vector.equipped.rail;
  assert.ok(equippedId, 'Vector profiles must equip a Rail before variant resolution.');
  return {
    ...vector,
    inventory: vector.inventory.map(item => item.id === equippedId ? { ...item, ...itemPatch } : item),
  };
}

const chargeBuild = deriveCombatBuild(vectorProfileWithRail({
  baseId: 'r2-hypervelocity-bed',
  name: 'R-2 Hypervelocity Rail Bed',
  frameIdentity: 'rail-hypervelocity',
}));
const repeaterBuild = deriveCombatBuild(vectorProfileWithRail({
  baseId: 'r2-thermal-reference',
  name: 'R-2 Thermal Reference Rails',
  frameIdentity: 'rail-thermal',
}));

assert.equal(railVariantDefinitions.length, 2, 'P14-C should author exactly the Charge + Repeater Rail pair.');
assert.deepEqual(railVariantDefinitions.map(definition => definition.id).sort(), ['rail-charge', 'rail-repeater']);
assert.equal(chargeBuild.classSkillFamily.family, 'rail', 'Charge must remain inside the Vector-owned Rail family.');
assert.equal(repeaterBuild.classSkillFamily.family, 'rail', 'Repeater must remain inside the Vector-owned Rail family.');
assert.equal(chargeBuild.classSkillFamily.weaponVariant, 'rail-charge');
assert.equal(repeaterBuild.classSkillFamily.weaponVariant, 'rail-repeater');
assert.equal(resolveRailVariant({ baseId: 'r2-countermass-bed', name: 'R-2 Countermass Rail Bed', frameIdentity: 'rail-countermass' }), 'rail-charge');
assert.equal(resolveRailVariant({ baseId: 'r2-thermal-reference', name: 'R-2 Thermal Reference Rails', frameIdentity: 'rail-thermal' }), 'rail-repeater');

const chargeDefinition = railVariantDefinition('rail-charge');
const repeaterDefinition = railVariantDefinition('rail-repeater');
const chargeDps = chargeDefinition.stats.damage * chargeDefinition.stats.rate;
const repeaterDps = repeaterDefinition.stats.damage * repeaterDefinition.stats.rate;
assert.ok(Math.abs(chargeDps - repeaterDps) / repeaterDps < 0.02, 'Rail pair should trade discharge shape rather than hide a dominant raw-DPS option.');
assert.ok(chargeDefinition.stats.damage > repeaterDefinition.stats.damage * 2.5, 'Charge must own the single-hit transfer lane.');
assert.ok(chargeDefinition.stats.penetration > repeaterDefinition.stats.penetration * 2, 'Charge must own the deepest armor lane.');
assert.ok(chargeDefinition.stats.projectileSpeed > repeaterDefinition.stats.projectileSpeed * 1.3, 'Charge must preserve extreme-velocity identity.');
assert.ok((chargeDefinition.stats.capacitorCost ?? 0) > (repeaterDefinition.stats.capacitorCost ?? 0) * 3, 'Charge must spend substantially more capacitor per shot.');
assert.ok(chargeDefinition.stats.heatPerShot > repeaterDefinition.stats.heatPerShot * 2, 'Charge must spend substantially more thermal headroom.');
assert.ok(repeaterDefinition.stats.rate > chargeDefinition.stats.rate * 2.5, 'Repeater must own follow-up cadence.');
assert.ok(repeaterDefinition.stats.magazine >= chargeDefinition.stats.magazine * 2, 'Repeater must own magazine depth.');
assert.ok(repeaterDefinition.stats.heatDissipation > chargeDefinition.stats.heatDissipation, 'Repeater must recover rail heat faster.');
assert.ok(repeaterDefinition.stats.recoil < chargeDefinition.stats.recoil * 0.6, 'Repeater must trade charge authority for controllable follow-up recoil.');

const chargePresentation = railVariantPresentation('rail-charge')!;
const repeaterPresentation = railVariantPresentation('rail-repeater')!;
assert.ok(chargePresentation.silhouetteScaleX > 1 && repeaterPresentation.silhouetteScaleX < 1, 'Variant silhouettes must separate long Charge from compact Repeater.');
assert.ok(chargePresentation.muzzleLengthMul > repeaterPresentation.muzzleLengthMul, 'Charge muzzle presentation must read longer than Repeater.');
assert.ok(repeaterPresentation.muzzleWidthMul > chargePresentation.muzzleWidthMul, 'Repeater muzzle presentation must read broader than Charge.');
assert.ok(chargePresentation.recoilVisualMul > repeaterPresentation.recoilVisualMul, 'Charge handling must visibly carry more recoil authority.');

function fireSnapshot(build: CombatBuild) {
  const state = createSimulation(build);
  assert.equal(state.player.currentWeapon, 'rail', 'Vector combat should boot into its owned Rail family.');
  state.player.aim = { x: 1, y: 0 };
  const beforeMag = state.player.mags.rail;
  const beforeCap = state.player.capacitor;
  const beforeHeat = state.player.weaponHeat.rail;
  const beforeVelocityX = state.player.vx;
  assert.equal(triggerFire(state), true, 'Authored Rail variant should fire.');
  const projectiles = state.projectiles
    .filter(projectile => projectile.active && projectile.owner === 'player')
    .map(projectile => ({
      damage: projectile.damage,
      penetration: projectile.penetration,
      vx: projectile.vx,
      vy: projectile.vy,
      knockback: projectile.knockback,
    }));
  return {
    variantId: state.weapons.rail.variantId,
    weaponName: state.weapons.rail.name,
    rate: state.weapons.rail.rate,
    projectileSpeed: state.weapons.rail.projectileSpeed,
    penetration: state.weapons.rail.penetration,
    capacitorCost: state.weapons.rail.capacitorCost,
    heatPerShot: state.weapons.rail.heatPerShot,
    magSpent: beforeMag - state.player.mags.rail,
    capSpent: beforeCap - state.player.capacitor,
    heatAdded: state.player.weaponHeat.rail - beforeHeat,
    recoilVelocityX: state.player.vx - beforeVelocityX,
    fireCooldown: state.player.fireCooldown,
    projectileCount: projectiles.length,
    projectiles,
  };
}

const charge = fireSnapshot(chargeBuild);
assert.equal(charge.variantId, 'rail-charge');
assert.match(charge.weaponName, /Charge Rail/);
assert.equal(charge.magSpent, 1, 'Charge must consume one indexed rail.');
assert.equal(charge.capSpent, charge.capacitorCost, 'Charge capacitor draw must match its authored discharge.');
assert.equal(charge.projectileCount, 1, 'Charge must emit one precision projectile.');
assert.ok(Math.abs(charge.heatAdded - charge.heatPerShot) < 1e-9, 'Charge heat must match its resolved rail configuration.');
assert.ok(charge.recoilVelocityX < 0, 'Charge discharge must drive backward recoil.');
assert.ok(Math.abs(charge.fireCooldown - 1 / charge.rate) < 1e-9, 'Charge cadence must resolve from its authored rate.');

const repeaterA = fireSnapshot(repeaterBuild);
const repeaterB = fireSnapshot(repeaterBuild);
assert.deepEqual(repeaterA, repeaterB, 'Repeater discharge must remain deterministic across identical simulations.');
assert.equal(repeaterA.variantId, 'rail-repeater');
assert.match(repeaterA.weaponName, /Repeater Rail/);
assert.equal(repeaterA.magSpent, 1, 'Repeater must consume one indexed rail per fire cycle.');
assert.equal(repeaterA.capSpent, repeaterA.capacitorCost, 'Repeater capacitor draw must match its authored discharge.');
assert.equal(repeaterA.projectileCount, 1, 'Repeater must emit one precision projectile per fast cycle.');
assert.ok(Math.abs(repeaterA.heatAdded - repeaterA.heatPerShot) < 1e-9, 'Repeater heat must match its resolved rail configuration.');
assert.ok(Math.abs(repeaterA.recoilVelocityX) < Math.abs(charge.recoilVelocityX), 'Repeater must produce less recoil impulse than Charge.');
assert.ok(repeaterA.fireCooldown < charge.fireCooldown * 0.45, 'Repeater must recover its firing window much faster than Charge.');
assert.ok(charge.projectiles[0]!.penetration > repeaterA.projectiles[0]!.penetration * 2, 'Charge projectile must preserve its penetration advantage.');
assert.ok(charge.projectiles[0]!.damage > repeaterA.projectiles[0]!.damage * 2.5, 'Charge projectile must preserve its per-projectile damage advantage.');
assert.ok(charge.projectileSpeed > repeaterA.projectileSpeed, 'Charge must preserve the faster precision lane.');
assert.ok(charge.capSpent > repeaterA.capSpent * 3, 'Charge must visibly spend more capacitor than Repeater.');

console.log(`P14_C_VECTOR_RAIL_PASS chargeDps=${chargeDps.toFixed(2)} repeaterDps=${repeaterDps.toFixed(2)} chargeCap=${charge.capSpent.toFixed(1)} repeaterCap=${repeaterA.capSpent.toFixed(1)}`);
