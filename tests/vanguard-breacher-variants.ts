import assert from 'node:assert/strict';
import { breacherVariantDefinition, breacherVariantDefinitions, breacherVariantPresentation, resolveBreacherVariant } from '../src/game/classArsenal';
import { createDefaultProfile, deriveCombatBuild, setOperatorClass, type Item } from '../src/game/meta';
import { createSimulation, triggerFire, type CombatBuild } from '../src/game/sim';

function vanguardProfileWithBreacher(itemPatch: Partial<Item>) {
  const vanguard = setOperatorClass(createDefaultProfile(), 'vanguard').profile;
  const equippedId = vanguard.equipped.breacher;
  assert.ok(equippedId, 'Vanguard profiles must equip a Breacher before variant resolution.');
  return {
    ...vanguard,
    inventory: vanguard.inventory.map(item => item.id === equippedId ? { ...item, ...itemPatch } : item),
  };
}

const slugBuild = deriveCombatBuild(vanguardProfileWithBreacher({
  baseId: 'b4-dense-choke-cage',
  name: 'B-4 Dense-Choke Cage',
  frameIdentity: 'breacher-dense',
}));
const rapidBuild = deriveCombatBuild(vanguardProfileWithBreacher({
  baseId: 'b4-backblast-thruster',
  name: 'B-4 Backblast Thruster Cage',
  frameIdentity: 'breacher-thrust',
}));

assert.equal(breacherVariantDefinitions.length, 2, 'P14-B should author exactly the Slug + Rapid Breacher pair.');
assert.deepEqual(breacherVariantDefinitions.map(definition => definition.id).sort(), ['breacher-rapid', 'breacher-slug']);
assert.equal(slugBuild.classSkillFamily.family, 'breacher', 'Slug must remain inside the Vanguard-owned Breacher family.');
assert.equal(rapidBuild.classSkillFamily.family, 'breacher', 'Rapid must remain inside the Vanguard-owned Breacher family.');
assert.equal(slugBuild.classSkillFamily.weaponVariant, 'breacher-slug');
assert.equal(rapidBuild.classSkillFamily.weaponVariant, 'breacher-rapid');
assert.equal(resolveBreacherVariant({ baseId: 'b4-cryo-cycle-action', name: 'B-4 Cryo-Cycle Action', frameIdentity: 'breacher-cryo' }), 'breacher-rapid');

const slugDefinition = breacherVariantDefinition('breacher-slug');
const rapidDefinition = breacherVariantDefinition('breacher-rapid');
const slugDps = slugDefinition.stats.damage * slugDefinition.stats.pellets * slugDefinition.stats.rate;
const rapidDps = rapidDefinition.stats.damage * rapidDefinition.stats.pellets * rapidDefinition.stats.rate;
assert.ok(Math.abs(slugDps - rapidDps) / rapidDps < 0.02, 'Breacher pair should trade delivery pattern rather than hide a dominant raw-DPS option.');
assert.equal(slugDefinition.stats.pellets, 1, 'Slug Breacher must emit one dense projectile.');
assert.ok(rapidDefinition.stats.pellets >= 5, 'Rapid Breacher must preserve a compact scatter pattern.');
assert.ok(slugDefinition.stats.penetration > rapidDefinition.stats.penetration * 8, 'Slug must own the penetration lane.');
assert.ok(slugDefinition.stats.spread < rapidDefinition.stats.spread * 0.2, 'Slug must own the tight single-bore lane.');
assert.ok(rapidDefinition.stats.rate > slugDefinition.stats.rate * 2, 'Rapid must own repeated breach cadence.');
assert.ok(rapidDefinition.stats.magazine >= slugDefinition.stats.magazine * 2, 'Rapid must own the deeper close-pressure magazine.');
assert.ok(rapidDefinition.stats.heatDissipation > slugDefinition.stats.heatDissipation, 'Rapid must recover thermal load faster.');
assert.ok(rapidDefinition.stats.recoil < slugDefinition.stats.recoil * 0.6, 'Rapid must trade single-shot shove for controllable follow-up pressure.');

const slugPresentation = breacherVariantPresentation('breacher-slug')!;
const rapidPresentation = breacherVariantPresentation('breacher-rapid')!;
assert.ok(slugPresentation.silhouetteScaleX > 1 && rapidPresentation.silhouetteScaleX < 1, 'Variant silhouettes must separate long Slug from compact Rapid.');
assert.ok(slugPresentation.muzzleLengthMul > rapidPresentation.muzzleLengthMul, 'Slug muzzle presentation must read longer than Rapid.');
assert.ok(rapidPresentation.muzzleWidthMul > slugPresentation.muzzleWidthMul, 'Rapid muzzle presentation must read broader than Slug.');
assert.ok(slugPresentation.recoilVisualMul > rapidPresentation.recoilVisualMul, 'Slug handling must visibly carry more recoil authority.');

function fireSnapshot(build: CombatBuild) {
  const state = createSimulation(build);
  assert.equal(state.player.currentWeapon, 'breacher', 'Vanguard combat should boot into its owned Breacher family.');
  state.player.aim = { x: 1, y: 0 };
  const beforeMag = state.player.mags.breacher;
  const beforeHeat = state.player.weaponHeat.breacher;
  const beforeVelocityX = state.player.vx;
  assert.equal(triggerFire(state), true, 'Authored Breacher variant should fire.');
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
    variantId: state.weapons.breacher.variantId,
    weaponName: state.weapons.breacher.name,
    pellets: state.weapons.breacher.pellets,
    magSpent: beforeMag - state.player.mags.breacher,
    heatAdded: state.player.weaponHeat.breacher - beforeHeat,
    recoilVelocityX: state.player.vx - beforeVelocityX,
    projectileCount: projectiles.length,
    projectiles,
  };
}

const slug = fireSnapshot(slugBuild);
assert.equal(slug.variantId, 'breacher-slug');
assert.match(slug.weaponName, /Slug Breacher/);
assert.equal(slug.pellets, 1);
assert.equal(slug.magSpent, 1, 'Slug must consume one chambered round.');
assert.equal(slug.projectileCount, 1, 'Slug must emit one projectile per fire cycle.');
assert.ok(Math.abs(slug.heatAdded - slugDefinition.stats.heatPerShot) < 1e-9, 'Slug heat must match its authored discharge.');
assert.ok(slug.recoilVelocityX < 0, 'Slug discharge must drive backward recoil.');

const rapidA = fireSnapshot(rapidBuild);
const rapidB = fireSnapshot(rapidBuild);
assert.deepEqual(rapidA, rapidB, 'Rapid scatter emission must remain deterministic across identical simulations.');
assert.equal(rapidA.variantId, 'breacher-rapid');
assert.match(rapidA.weaponName, /Rapid Breacher/);
assert.equal(rapidA.pellets, rapidDefinition.stats.pellets);
assert.equal(rapidA.magSpent, 1, 'Rapid must consume one shell per fast fire cycle.');
assert.equal(rapidA.projectileCount, rapidDefinition.stats.pellets, 'Rapid must emit its authored compact pellet packet.');
assert.ok(Math.abs(rapidA.heatAdded - rapidDefinition.stats.heatPerShot) < 1e-9, 'Rapid heat must match its authored discharge.');
assert.ok(Math.abs(rapidA.recoilVelocityX) < Math.abs(slug.recoilVelocityX), 'Rapid must produce less recoil impulse than Slug.');
assert.ok(new Set(rapidA.projectiles.map(projectile => projectile.vy.toFixed(6))).size > 1, 'Rapid pellet packet must preserve visible spread.');
assert.ok(slug.projectiles[0]!.penetration > rapidA.projectiles[0]!.penetration * 8, 'Slug projectile must preserve its penetration advantage.');
assert.ok(slug.projectiles[0]!.damage > rapidA.projectiles[0]!.damage * 10, 'Slug projectile must preserve its per-projectile damage advantage.');

console.log(`P14_B_VANGUARD_BREACHER_PASS slugDps=${slugDps.toFixed(2)} rapidDps=${rapidDps.toFixed(2)} slugProjectiles=${slug.projectileCount} rapidProjectiles=${rapidA.projectileCount}`);
