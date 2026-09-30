import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import {
  BabylonAbilityVfx,
  babylonAbilityEffectsMode,
  babylonClassSkillVfxProfile,
  babylonMobilityVfxProfile,
} from '../src/game/babylonAbilityVfx';
import { BabylonRefineryWorldPresentation } from '../src/game/babylonWorldPresentation';
import { operatorWeaponFamilyForClass, type OperatorClassId } from '../src/game/classSkills';
import { classSkillAnimationProfiles } from '../src/game/skillDamageAnimation';
import {
  abilityUsesTargetAcquisition,
  createSimulation,
  neutralCombatBuild,
  triggerAbility,
  triggerDodge,
  type CombatBuild,
  type SimState,
} from '../src/game/sim';

const classes = ['vanguard', 'vector', 'systems'] as const satisfies readonly OperatorClassId[];

function classBuild(operatorClass: OperatorClassId): CombatBuild {
  const build = structuredClone(neutralCombatBuild);
  build.operatorClass = operatorClass;
  build.classSkillFamily.family = operatorWeaponFamilyForClass(operatorClass);
  return build;
}

function isolatedSkillState(operatorClass: OperatorClassId) {
  const state = createSimulation(classBuild(operatorClass));
  const target = state.enemies.find(enemy => enemy.active && !enemy.dead && enemy.role !== 'boss');
  assert.ok(target, 'P27-B7 Babylon ability VFX probe needs a live non-boss target.');
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

function rendererOwnedSnapshot(state: SimState) {
  return structuredClone({
    player: state.player,
    lastAbilityIndex: state.lastAbilityIndex,
    lastAbilityAt: state.lastAbilityAt,
    pulse: state.pulse,
    classState: state.classState,
    effects: state.effects,
    hazards: state.hazards,
    projectiles: state.projectiles,
    telemetry: state.telemetry,
    enemies: state.enemies.map(enemy => ({
      id: enemy.id,
      x: enemy.x,
      y: enemy.y,
      vx: enemy.vx,
      vy: enemy.vy,
      hp: enemy.hp,
      armor: enemy.armor,
      statuses: enemy.statuses,
    })),
  });
}

const skillIds = new Set<string>();
const skillLanguages = new Set<string>();
for (const operatorClass of classes) {
  for (let index = 0; index < 3; index += 1) {
    const profile = babylonClassSkillVfxProfile(operatorClass, index);
    assert.ok(profile, operatorClass + ' slot ' + index + ' needs a Babylon skill VFX profile.');
    assert.equal(
      profile.id,
      classSkillAnimationProfiles[operatorClass][index].id,
      operatorClass + ' slot ' + index + ' Babylon VFX must stay aligned with the shared skill-animation identity.',
    );
    skillIds.add(profile.id);
    skillLanguages.add(profile.language);

    const { state, target } = isolatedSkillState(operatorClass);
    const intent = abilityUsesTargetAcquisition(state, index) ? 'acquire' : 'manual';
    assert.equal(triggerAbility(state, index, intent, target.id), true, operatorClass + ' slot ' + index + ' must activate for the Babylon VFX probe.');
    state.time += classSkillAnimationProfiles[operatorClass][index].anticipation * 0.5;
    const beforeRender = rendererOwnedSnapshot(state);

    const engine = new NullEngine();
    const scene = new Scene(engine);
    const canvas = { dataset: {} } as HTMLCanvasElement;
    const vfx = new BabylonAbilityVfx(scene, canvas, false);
    try {
      vfx.sync(state, 1);
      assert.equal(
        canvas.dataset.babylonAbilitySkill,
        profile.id + ':anticipation',
        operatorClass + ' slot ' + index + ' must expose its live shared skill phase in Babylon.',
      );
      assert.equal(canvas.dataset.babylonAbilitySkillCue, profile.language);
      assert.equal(scene.getMeshByName('p27-b7-skill-ring')?.isEnabled(), true, operatorClass + ' slot ' + index + ' must enable a Babylon skill cue mesh.');
      if (index === 0) {
        assert.equal(scene.getMeshByName('p27-b7-pulse-ring')?.isEnabled(), true, operatorClass + ' first skill must reproduce the shared state.pulse cue.');
      }
      if (index === 1) {
        assert.match(canvas.dataset.babylonAbilityEffectKinds ?? '', /mark/, operatorClass + ' targeting skill must render the simulation mark effect.');
        assert.ok(Number(canvas.dataset.babylonAbilityEffectCount ?? 0) >= 1, operatorClass + ' targeting skill must expose a non-primary-fire effect mesh.');
      }
      assert.deepEqual(rendererOwnedSnapshot(state), beforeRender, 'Babylon ability rendering must not mutate simulation or combat-control geometry.');
    } finally {
      vfx.dispose();
      scene.dispose();
      engine.dispose();
    }
  }
}

assert.equal(skillIds.size, 9, 'P27-B7 must keep all nine class-owned skill VFX identities distinct.');
assert.equal(skillLanguages.size, 9, 'P27-B7 must keep all nine class-owned skill visual languages distinct.');

const mobilityLanguages = new Set<string>();
for (const operatorClass of classes) {
  const profile = babylonMobilityVfxProfile(operatorClass);
  assert.ok(profile, operatorClass + ' needs a Babylon mobility VFX profile.');
  mobilityLanguages.add(profile.language);
  const state = createSimulation(classBuild(operatorClass));
  state.player.move = { x: 1, y: 0 };
  state.player.aim = { x: 1, y: 0 };
  state.player.dodgeCooldown = 0;
  assert.equal(triggerDodge(state), true, operatorClass + ' dodge must activate for the Babylon mobility probe.');
  const beforeRender = rendererOwnedSnapshot(state);

  const engine = new NullEngine();
  const scene = new Scene(engine);
  const canvas = { dataset: {} } as HTMLCanvasElement;
  const vfx = new BabylonAbilityVfx(scene, canvas, false);
  try {
    vfx.sync(state, 1);
    assert.equal(canvas.dataset.babylonMobilityFx, operatorClass + '-dodge-trail');
    assert.equal(canvas.dataset.babylonMobilityLanguage, profile.language);
    assert.equal(scene.getMeshByName('p27-b7-mobility-streak-0')?.isEnabled(), true, operatorClass + ' dodge must enable a Babylon mobility trail.');
    assert.deepEqual(rendererOwnedSnapshot(state), beforeRender, 'Babylon dodge VFX must not mutate velocity, invulnerability, cooldowns, or collision state.');

    state.player.dodgeTime = 0;
    state.player.vx = 180;
    state.player.vy = 0;
    vfx.sync(state, 1);
    assert.equal(canvas.dataset.babylonMobilityFx, operatorClass + '-motion-trail', operatorClass + ' locomotion must retain a non-dodge movement cue.');
  } finally {
    vfx.dispose();
    scene.dispose();
    engine.dispose();
  }
}
assert.equal(mobilityLanguages.size, 3, 'Each class needs a distinct Babylon mobility language.');

assert.equal(babylonAbilityEffectsMode(1, false), 'full');
assert.equal(babylonAbilityEffectsMode(0.55, false), 'reduced');
assert.equal(babylonAbilityEffectsMode(1, true), 'reduced');

{
  const state = createSimulation(classBuild('systems'));
  Object.assign(state.hazards[0], {
    active: true,
    x: state.player.x + 80,
    y: state.player.y,
    radius: 120,
    life: 2,
    kind: 'gravityWell',
    owner: 'player',
  });
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const canvas = { dataset: {} } as HTMLCanvasElement;
  const vfx = new BabylonAbilityVfx(scene, canvas, false);
  const world = new BabylonRefineryWorldPresentation(scene, canvas, false);
  try {
    vfx.sync(state, 1);
    assert.equal(canvas.dataset.babylonAbilityFieldCount, '1');
    assert.equal(canvas.dataset.babylonAbilityFieldKinds, 'gravityWell');
    assert.equal(canvas.dataset.babylonAbilityFieldRenderer, 'babylon-world-presentation');
    (world as unknown as { syncHazards: (liveState: SimState, detailScale: number) => void }).syncHazards(state, 1);
    assert.equal(canvas.dataset.hazardActive, '1', 'Player-owned field hazards must stay visible through the existing Babylon world presentation.');
    assert.equal(scene.getMeshByName('p27-b5-hazard-ring-0')?.isEnabled(), true, 'Player-owned field hazards must produce a live Babylon floor cue.');
  } finally {
    world.dispose();
    vfx.dispose();
    scene.dispose();
    engine.dispose();
  }
}

const rendererSource = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
assert.match(rendererSource, /resolvePlayerSkillAnimation/, 'Babylon operator rig must consume the shared class-skill animation resolver.');
assert.match(rendererSource, /this\.abilityVfx\.sync\(state, quality\)/, 'Babylon combat renderer must synchronize the B7 VFX layer every refinery frame.');
assert.match(rendererSource, /operatorSkillAnimation/, 'Babylon combat renderer must expose shared skill-pose telemetry.');
assert.match(rendererSource, /pose\.socketReach/, 'Babylon authored operator must reproduce the production skill socket pose contract.');

console.log('P27_B7_BABYLON_ABILITY_VFX_PASS skills=9 mobility=vanguard+vector+systems effects=shared-state fields=world-presentation reduced=secondary-only simulation=unchanged');
