import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classAbilityKits,
  operatorWeaponFamilyForClass,
  type OperatorClassId,
} from '../src/game/classSkills';
import {
  abilityUsesTargetAcquisition,
  createSimulation,
  getAbilityConfig,
  triggerAbility,
  type CombatBuild,
  type SimState,
} from '../src/game/sim';
import {
  abilityMods,
  createDefaultProfile,
  deriveCombatBuild,
  materializeModifier,
  operatorClassDefinitions,
  setAbilityMod,
  setOperatorClass,
  specializationDefinitions,
  systemsCapstoneInteractions,
  vanguardCapstoneInteractions,
  vectorCapstoneInteractions,
  type PlayerProfile,
} from '../src/game/meta';
import { gearAffixDefinitions } from '../src/game/gearAffixes';
import { affixStatProfile, gearStatDefinition } from '../src/game/gearStats';
import { singularChaseDefinitions } from '../src/game/gearSingulars';

const classes = ['vanguard', 'vector', 'systems'] as const satisfies readonly OperatorClassId[];
const expectedTargetAcquisition: Record<OperatorClassId, readonly [boolean, boolean, boolean]> = {
  vanguard: [false, true, false],
  vector: [false, true, false],
  systems: [false, true, true],
};

function near(actual: number, expected: number, message: string) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
}

function classProfile(operatorClass: OperatorClassId, level = 16): PlayerProfile {
  const selected = setOperatorClass(createDefaultProfile(), operatorClass).profile;
  return { ...selected, level };
}

function isolatedSkillState(build: CombatBuild) {
  const state = createSimulation(build);
  const target = state.enemies.find(enemy => enemy.active && !enemy.dead && enemy.role !== 'boss');
  assert.ok(target, 'Class-skill audit needs a live non-boss target.');
  for (const enemy of state.enemies) enemy.active = enemy.id === target.id;
  for (const object of state.objects) object.active = false;
  Object.assign(target, {
    active: true,
    dead: false,
    role: 'technician',
    variant: 'standard',
    combatClass: 'standard',
    protocols: [],
    x: state.player.x + 120,
    y: state.player.y,
    vx: 0,
    vy: 0,
    hp: 100,
    maxHp: 100,
    armor: 100,
    maxArmor: 100,
    anchored: false,
  });
  target.statuses.marked = 0;
  target.statuses.disrupted = 0;
  target.statuses.conductive = 0;
  target.statuses.armorBreach = 0;
  target.statuses.stagger = 0;
  state.player.aim = { x: 1, y: 0 };
  state.player.capacitor = state.player.maxCapacitor;
  state.player.abilityCooldowns = [0, 0, 0];
  return { state, target };
}

function assertCoreSkillEffect(operatorClass: OperatorClassId, index: number, state: SimState, target: SimState['enemies'][number], armorBefore: number) {
  if (operatorClass === 'vanguard' && index === 0) {
    assert.ok(state.player.vx > 0, 'Breach Rush must drive Vanguard down the aim lane.');
    assert.ok(state.classState.vanguardGuard > 0, 'Breach Rush must raise Breach Guard.');
  } else if (operatorClass === 'vanguard' && index === 1) {
    assert.ok(target.statuses.marked > 0, 'Fracture Tag must mark its acquired target.');
    assert.ok(target.statuses.armorBreach > 0, 'Fracture Tag must open an Armor Breach window.');
    assert.ok(target.armor < armorBefore, 'Fracture Tag must strip armor.');
  } else if (operatorClass === 'vanguard' && index === 2) {
    assert.ok(state.classState.vanguardGuard > 0, 'Bulwark Pulse must reinforce Breach Guard.');
    assert.ok(target.statuses.stagger > 0, 'Bulwark Pulse must stagger nearby hostiles.');
  } else if (operatorClass === 'vector' && index === 0) {
    assert.ok(state.player.vx > 0, 'Vector Shift must move along the aim vector.');
    assert.ok(state.classState.vectorWindow > 0, 'Vector Shift must prime Slipstream.');
  } else if (operatorClass === 'vector' && index === 1) {
    assert.ok(target.statuses.marked > 0, 'Deadeye Lock must mark the firing solution.');
    assert.ok(state.classState.vectorWindow > 0, 'Deadeye Lock must prime the precision window.');
  } else if (operatorClass === 'vector' && index === 2) {
    assert.ok(state.projectiles.filter(projectile => projectile.active && projectile.owner === 'player' && projectile.weapon === 'rail').length >= 3, 'Splitshot must launch its three-lane Rail fan.');
  } else if (operatorClass === 'systems' && index === 0) {
    assert.ok(target.statuses.disrupted > 0, 'Polarity Well must disrupt hostiles in the projected field.');
    assert.notEqual(target.vx, 0, 'Polarity Well must alter hostile movement toward its projected mass point.');
  } else if (operatorClass === 'systems' && index === 1) {
    assert.ok(target.statuses.marked > 0, 'Relay Hack must mark its acquired target.');
    assert.ok(target.statuses.disrupted > 0, 'Relay Hack must disrupt a hostile systems target.');
  } else if (operatorClass === 'systems' && index === 2) {
    assert.ok(target.statuses.disrupted > 0, 'Cascade Arc must disrupt its acquired target.');
    assert.ok(target.statuses.conductive > 0, 'Cascade Arc must leave the target conductive for the network loop.');
  } else {
    assert.fail(`Missing P20-C core-effect assertion for ${operatorClass} slot ${index + 1}.`);
  }
}

for (const operatorClass of classes) {
  const profile = classProfile(operatorClass);
  const build = deriveCombatBuild(profile);
  const kit = classAbilityKits[operatorClass];
  const ownedFamily = operatorWeaponFamilyForClass(operatorClass);
  assert.equal(build.operatorClass, operatorClass);
  assert.equal(build.classSkillFamily.family, ownedFamily, `${operatorClass} class skills must bind only to the class-owned armament family.`);

  for (let index = 0; index < 3; index += 1) {
    const base = kit[index];
    assert.equal(base.weaponFamily, ownedFamily, `${operatorClass} ${base.name} must inherit the owned class family.`);
    const { state, target } = isolatedSkillState(structuredClone(build));
    const config = getAbilityConfig(state, index);
    assert.equal(config.familyBound, true, `${operatorClass} ${base.name} must consume the class-skill family layer.`);
    assert.equal(abilityUsesTargetAcquisition(state, index), expectedTargetAcquisition[operatorClass][index], `${operatorClass} ${base.name} targeting contract drifted.`);
    assert.equal(config.cost, Math.round(base.cost * build.abilities[index].costMul * build.classSkillFamily.costMul));
    near(config.cooldown, base.cooldown * build.abilities[index].cooldownMul / build.classSkillFamily.recoveryMul, `${operatorClass} ${base.name} cooldown composition`);
    near(config.power, build.abilities[index].powerMul * build.classSkillFamily.powerMul, `${operatorClass} ${base.name} power composition`);
    near(config.range, build.classSkillFamily.rangeMul, `${operatorClass} ${base.name} range composition`);
    near(config.control, build.classSkillFamily.controlMul, `${operatorClass} ${base.name} control composition`);
    near(config.armor, build.classSkillFamily.armorMul, `${operatorClass} ${base.name} armor composition`);
    assert.equal(config.chainBonus, build.classSkillFamily.chainBonus);

    const capacitorBefore = state.player.capacitor;
    const armorBefore = target.armor;
    const used = triggerAbility(state, index, expectedTargetAcquisition[operatorClass][index] ? 'acquire' : 'manual', target.id);
    assert.equal(used, true, `${operatorClass} ${base.name} must activate with a valid resource/target state.`);
    assert.equal(state.player.capacitor, capacitorBefore - config.cost, `${operatorClass} ${base.name} must spend its advertised capacitor cost.`);
    near(state.player.abilityCooldowns[index], config.cooldown, `${operatorClass} ${base.name} must enter its advertised recovery window`);
    assert.ok(state.eventText.includes(base.name.toUpperCase()), `${operatorClass} ${base.name} combat feedback must use the active class-skill name, got: ${state.eventText}`);
    assertCoreSkillEffect(operatorClass, index, state, target, armorBefore);
  }

  const composedBuild = structuredClone(build);
  Object.assign(composedBuild.classSkillFamily, {
    powerMul: 1.21,
    rangeMul: 1.13,
    controlMul: 1.17,
    armorMul: 1.19,
    recoveryMul: 1.16,
    costMul: 0.91,
    chainBonus: 2,
  });
  Object.assign(composedBuild.abilities[0], { costMul: 1.08, cooldownMul: 1.12, powerMul: 1.09 });
  const composedConfig = getAbilityConfig(createSimulation(composedBuild), 0);
  const composedBase = kit[0];
  assert.equal(composedConfig.cost, Math.round(composedBase.cost * 1.08 * 0.91));
  near(composedConfig.cooldown, composedBase.cooldown * 1.12 / 1.16, `${operatorClass} composed recovery`);
  near(composedConfig.power, 1.09 * 1.21, `${operatorClass} composed power`);
  near(composedConfig.range, 1.13, `${operatorClass} composed range`);
  near(composedConfig.control, 1.17, `${operatorClass} composed control`);
  near(composedConfig.armor, 1.19, `${operatorClass} composed armor`);
  assert.equal(composedConfig.chainBonus, 2);

  const malformedOffFamily = structuredClone(composedBuild);
  malformedOffFamily.classSkillFamily.family = ownedFamily === 'carbine' ? 'rail' : 'carbine';
  const isolatedConfig = getAbilityConfig(createSimulation(malformedOffFamily), 0);
  assert.equal(isolatedConfig.familyBound, false, `${operatorClass} must ignore a malformed/off-class family binding.`);
  assert.equal(isolatedConfig.cost, Math.round(composedBase.cost * 1.08));
  near(isolatedConfig.cooldown, composedBase.cooldown * 1.12, `${operatorClass} off-family recovery isolation`);
  near(isolatedConfig.power, 1.09, `${operatorClass} off-family power isolation`);
  assert.equal(isolatedConfig.range, 1);
  assert.equal(isolatedConfig.control, 1);
  assert.equal(isolatedConfig.armor, 1);
  assert.equal(isolatedConfig.chainBonus, 0);
}

{
  const build = deriveCombatBuild(classProfile('systems'));
  const { state, target } = isolatedSkillState(build);
  assert.equal(triggerAbility(state, 0, 'manual', target.id), true);
  assert.equal(triggerAbility(state, 1, 'acquire', target.id), true);
  assert.equal(state.classState.systemsLinks, 1, 'Systems Closed Loop must bank a link when rotating class skills.');
  assert.equal(triggerAbility(state, 2, 'acquire', target.id), true);
  assert.equal(state.classState.systemsLinks, 0, 'Systems Closed Loop must recycle the three-link cycle after the third distinct skill.');
  assert.match(state.eventText, /SYSTEMS CLOSED LOOP/, 'Systems signature feedback must identify the class-specific Closed Loop mechanic.');
}

const classEvolutions = abilityMods.filter(mod => mod.evolution);
const sharedLenses = abilityMods.filter(mod => !mod.evolution);
assert.equal(classEvolutions.length, 9, 'P20-C must audit all nine class Evolutions.');
assert.equal(sharedLenses.length, 9, 'P20-C must audit all nine shared Lenses.');
for (const operatorClass of classes) {
  assert.equal(classEvolutions.filter(mod => mod.operatorClass === operatorClass).length, 3, `${operatorClass} must own one Evolution per class skill.`);
  const baseProfile = classProfile(operatorClass);
  const baseline = deriveCombatBuild(baseProfile);
  for (const lens of sharedLenses) {
    const selected = setAbilityMod(baseProfile, lens.ability, lens.id);
    assert.equal(selected.abilityMods[lens.ability], lens.id, `${lens.name} must be selectable by ${operatorClass} without creating item-owned skills.`);
    const modified = deriveCombatBuild(selected);
    assert.notDeepEqual(
      { abilities: modified.abilities, mechanics: modified.mechanics },
      { abilities: baseline.abilities, mechanics: baseline.mechanics },
      `${lens.name} must materially modify the active ${operatorClass} kit.`,
    );
  }
}
for (const evolution of classEvolutions) {
  assert.ok(evolution.operatorClass, `${evolution.name} must remain class-owned.`);
  const profile = classProfile(evolution.operatorClass!);
  const baseline = deriveCombatBuild(profile);
  const selected = setAbilityMod(profile, evolution.ability, evolution.id);
  assert.equal(selected.abilityMods[evolution.ability], evolution.id, `${evolution.name} must be selectable by its owning class at LV16.`);
  const modified = deriveCombatBuild(selected);
  assert.notDeepEqual(
    { abilities: modified.abilities, mechanics: modified.mechanics },
    { abilities: baseline.abilities, mechanics: baseline.mechanics },
    `${evolution.name} must materially alter its class skill.`,
  );
  const offClass = classes.find(candidate => candidate !== evolution.operatorClass)!;
  const rejected = setAbilityMod(classProfile(offClass), evolution.ability, evolution.id);
  assert.notEqual(rejected.abilityMods[evolution.ability], evolution.id, `${evolution.name} must not leak into ${offClass}.`);
}

const capstones = [...vanguardCapstoneInteractions, ...vectorCapstoneInteractions, ...systemsCapstoneInteractions];
assert.equal(capstones.length, 9, 'P20-C capstone audit must cover one specialization/Evolution interaction for each specialization.');
for (const capstone of capstones) {
  const evolution = classEvolutions.find(mod => mod.id === capstone.abilityMod);
  const specialization = specializationDefinitions.find(definition => definition.id === capstone.specialization);
  assert.ok(evolution && specialization, `Capstone ${capstone.name} must resolve existing specialization and Evolution metadata.`);
  assert.equal(evolution!.operatorClass, specialization!.operatorClass, `Capstone ${capstone.name} must stay inside one operator class.`);
}

const skillAffixes = gearAffixDefinitions.filter(definition => {
  const semantics = affixStatProfile(definition.id);
  return [...semantics.stats, ...semantics.tradeoffs].some(statId => {
    const stat = gearStatDefinition(statId);
    return stat.scope === 'skill-family' || stat.id.startsWith('global.ability-');
  });
});
assert.deepEqual(skillAffixes.map(definition => definition.id).sort(), ['arcDrone', 'capacitorRecycler', 'magRedirect', 'markShear'], 'Every registry-declared ordinary skill-affecting affix must stay in the P20-C audit.');

for (const definition of skillAffixes) {
  const affinity = affixStatProfile(definition.id).classAffinities[0] as OperatorClassId;
  const profile = classProfile(affinity);
  const slot = definition.allowedSlots.find(candidate => !!profile.equipped[candidate]);
  assert.ok(slot, `${definition.id} needs an equipped legal slot in its class fixture.`);
  const itemId = profile.equipped[slot!]!;
  const patched: PlayerProfile = {
    ...profile,
    inventory: profile.inventory.map(item => item.id === itemId ? { ...item, modifiers: [materializeModifier(definition.id, 3)] } : item),
  };
  const baseline = deriveCombatBuild(profile);
  const build = deriveCombatBuild(patched);
  if (definition.id === 'capacitorRecycler') {
    assert.ok(build.abilities.every((ability, index) => ability.costMul < baseline.abilities[index].costMul), 'Capacitor recycler must reduce all class-skill costs.');
  } else if (definition.id === 'magRedirect') {
    assert.equal(build.mechanics.magRedirect, true, 'Revector field affix must enable first-skill projectile redirect behavior.');
  } else if (definition.id === 'markShear') {
    assert.equal(build.mechanics.markWeakArmor, true, 'Shear-map optics must enable marked-target weak-armor behavior.');
  } else if (definition.id === 'arcDrone') {
    assert.equal(build.mechanics.arcDrone, true, 'Relay microdrone must enable the disruption-drone loop.');
  }
  const materialized = materializeModifier(definition.id, 3);
  assert.ok(materialized.description.length >= 20, `${definition.id} needs an advertised mechanical description.`);
  assert.doesNotMatch(materialized.description, /Magnetic Impulse|Sensor Spike|Arc Tap/, `${definition.id} description must not advertise a retired neutral class skill.`);
}

function profileWithSingularTrait(operatorClass: OperatorClassId, slot: 'rig' | 'implant', trait: (typeof singularChaseDefinitions)[number]['singularTrait']) {
  const profile = classProfile(operatorClass);
  const existingId = profile.equipped[slot];
  const existing = existingId ? profile.inventory.find(item => item.id === existingId) : undefined;
  const fallback = profile.inventory.find(item => item.slot === slot);
  const item = existing ?? fallback;
  assert.ok(item, `P20-C Singular fixture needs a ${slot} item.`);
  return {
    ...profile,
    equipped: { ...profile.equipped, [slot]: item!.id },
    inventory: profile.inventory.map(candidate => candidate.id === item!.id ? { ...candidate, singularTrait: trait } : candidate),
  };
}

const skillSingulars = singularChaseDefinitions.filter(definition =>
  definition.category === 'skill-transformer'
  || /class skill|class-skill|ability cooldown|ability recovery|Relay Hack|Cascade Arc|first class skill|second class skill|third class skill/i.test(`${definition.rule} ${definition.opportunityCost}`),
);
assert.ok(skillSingulars.length >= 12, 'P20-C must retain broad Singular skill-behavior coverage.');
const simSource = readFileSync('src/game/sim.ts', 'utf8');
for (const definition of skillSingulars) {
  assert.ok(definition.rule.trim().length >= 24, `${definition.name} needs a concrete advertised rule.`);
  assert.ok(definition.opportunityCost.trim().length >= 24, `${definition.name} needs a concrete advertised opportunity cost/tradeoff.`);
  assert.doesNotMatch(`${definition.rule} ${definition.opportunityCost}`, /Magnetic Impulse|Sensor Spike|Arc Tap|MAG|MARK/, `${definition.name} must describe the active class kit rather than retired neutral skill names.`);
  const escaped = definition.singularTrait.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  assert.match(simSource, new RegExp(`hasTrait\\([^\\n]*['"]${escaped}['"]\\)`), `${definition.name} must have a live combat hook.`);
}

{
  const baselineProfile = classProfile('systems');
  const baseline = deriveCombatBuild(baselineProfile);
  const bloom = deriveCombatBuild(profileWithSingularTrait('systems', 'rig', 'magBloom'));
  near(bloom.abilities[0].costMul, baseline.abilities[0].costMul * 1.25, 'Bloom Vector first-skill cost tradeoff');
  near(bloom.abilities[0].cooldownMul, baseline.abilities[0].cooldownMul * 1.08, 'Bloom Vector first-skill recovery tradeoff');
  const { state, target } = isolatedSkillState(bloom);
  assert.equal(triggerAbility(state, 0, 'manual', target.id), true);
  assert.ok(state.projectiles.filter(projectile => projectile.active && projectile.owner === 'player').length >= 8, 'Bloom Vector must add eight first-skill kinetic spokes.');

  const cascade = deriveCombatBuild(profileWithSingularTrait('systems', 'implant', 'markCascade'));
  near(cascade.abilities[1].cooldownMul, baseline.abilities[1].cooldownMul * 1.12, 'Cascade Sight second-skill recovery tradeoff');
  const cascadeState = isolatedSkillState(cascade);
  assert.equal(triggerAbility(cascadeState.state, 1, 'acquire', cascadeState.target.id), true);
  near(cascadeState.target.statuses.marked, 7.5 * 0.78 * getAbilityConfig(cascadeState.state, 1).power, 'Cascade Sight initial mark-duration tradeoff');
}

const playerFacingSources = [
  'src/components/PlayerStatsPanel.tsx',
  'src/game/guideContent.ts',
  'src/game/gearStats.ts',
  'src/game/gearSingulars.ts',
  'src/game/meta.ts',
].map(path => [path, readFileSync(path, 'utf8')] as const);
for (const [path, source] of playerFacingSources) {
  assert.doesNotMatch(source, /Magnetic Impulse|Sensor Spike|Arc Tap/, `${path} must not present retired neutral skill names while class-specific kits are active.`);
}
assert.doesNotMatch(
  operatorClassDefinitions.map(definition => `${definition.signatureDescription} ${definition.combatLoop}`).join(' '),
  /\bMAG\b|\bMARK\b|\bARC\b/,
  'Class doctrine copy must name the active class skills instead of legacy neutral button labels.',
);
assert.match(simSource, /RELAY CROWN \/\/ \$\{meta\.name\.toUpperCase\(\)\} JUMPED THROUGH/, 'Relay Crown combat feedback must resolve the active second-skill name.');
assert.doesNotMatch(simSource, /RELAY CROWN \/\/ SENSOR SPIKE/, 'Relay Crown must not emit stale Sensor Spike feedback for class-specific kits.');

console.log(`P20_C_CLASS_SKILL_AUDIT_PASS kits=3 skills=9 lenses=${sharedLenses.length} evolutions=${classEvolutions.length} capstones=${capstones.length} affixes=${skillAffixes.length} singularSkillHooks=${skillSingulars.length}`);
