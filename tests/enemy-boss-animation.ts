import assert from 'node:assert/strict';
import { enemyAnimationProfiles, resolveEnemyBossAnimation } from '../src/game/enemyBossAnimation';
import type { Enemy } from '../src/game/sim';

const roles: Enemy['role'][] = ['assault', 'suppressor', 'technician', 'elite', 'boss'];
assert.equal(new Set(roles.map(role => enemyAnimationProfiles[role].id)).size, roles.length, 'Every enemy role needs a distinct motion identity');
assert.equal(new Set(roles.map(role => {
  const profile = enemyAnimationProfiles[role];
  return [profile.gaitRate, profile.gaitAmplitude, profile.leftArm, profile.rightArm, profile.torsoLean].join(':');
})).size, roles.length, 'Enemy roles need distinct locomotion and stance signatures');

function sample(role: Enemy['role'], overrides: Partial<Parameters<typeof resolveEnemyBossAnimation>[0]> = {}) {
  return resolveEnemyBossAnimation({
    role,
    id: 7,
    time: 2.4,
    vx: 130,
    vy: 35,
    telegraph: 0,
    sinceAttack: -1,
    sincePhaseChange: -1,
    combatClass: role === 'boss' ? 'command' : role === 'elite' ? 'elite' : 'standard',
    protocolPulse: 0,
    modifierCount: 0,
    anchored: role === 'boss' || role === 'elite',
    statuses: { armorBreach: 0, disrupted: 0, marked: 0, stagger: 0, conductive: 0, vacuum: 0 },
    bossPhase: 1,
    dead: false,
    ...overrides,
  });
}

for (const role of roles) {
  const profile = enemyAnimationProfiles[role];
  assert.ok(profile.gaitRate >= 5 && profile.gaitRate <= 10, `${role} gait cadence is outside the readable range`);
  assert.ok(profile.telegraphWindow >= 0.5 && profile.telegraphWindow <= 1.2, `${role} tell window is outside the authored budget`);
  assert.ok(profile.commitDuration >= 0.1 && profile.commitDuration <= 0.22, `${role} commit should stay sharp`);
  assert.ok(profile.recoveryDuration >= 0.2 && profile.recoveryDuration <= 0.4, `${role} recovery should stay responsive`);
}

const assaultTell = sample('assault', { telegraph: 0.24, vx: 0, vy: 0, anchored: false });
assert.equal(assaultTell.phase, 'tell');
assert.ok(assaultTell.tell > 0.6, 'Attack anticipation must become more pronounced as the deterministic telegraph expires');

const assaultCommit = sample('assault', { sinceAttack: 0.065, vx: 0, vy: 0, anchored: false });
assert.equal(assaultCommit.phase, 'commit');
assert.ok(assaultCommit.commit > 0.9, 'Attack execution needs a crisp authored impulse');

const assaultRecovery = sample('assault', { sinceAttack: 0.20, vx: 0, vy: 0, anchored: false });
assert.equal(assaultRecovery.phase, 'recovery');
assert.ok(assaultRecovery.recovery > 0.6, 'Attack recovery must remain visible after the execution impulse');

const bossTransition = sample('boss', { bossPhase: 2, sincePhaseChange: enemyAnimationProfiles.boss.phaseDuration * 0.5, vx: 0, vy: 0 });
assert.equal(bossTransition.phase, 'phase-transition');
assert.ok(bossTransition.phaseTransition > 0.99, 'Boss phase two needs a strong body transition independent of the HUD');

const standard = sample('assault', { combatClass: 'standard', modifierCount: 0, protocolPulse: 0, anchored: false });
const enhanced = sample('assault', { combatClass: 'enhanced', modifierCount: 2, protocolPulse: 0.65, anchored: false });
assert.equal(standard.modifier, 0);
assert.ok(enhanced.modifier >= 0.65, 'Enhanced/protocol enemies need an additive motion layer');

const status = sample('technician', {
  statuses: { armorBreach: 2.4, disrupted: 1.2, marked: 3.2, stagger: 0, conductive: 5, vacuum: 1.5 },
  anchored: false,
});
assert.equal(status.status.armorBreach, 1);
assert.equal(status.status.marked, 1);
assert.equal(status.status.conductive, 1);
assert.ok(status.status.disrupted > 0.49 && status.status.vacuum > 0.49, 'Status motion weights must preserve deterministic timer strength');

const moving = sample('elite', { anchored: false, vx: 180, vy: 0 });
const anchored = sample('elite', { anchored: true, vx: 180, vy: 0 });
assert.ok(anchored.speed < moving.speed * 0.3, 'Anchored elites and bosses should not fake full locomotion');

const dead = sample('boss', { dead: true, telegraph: 0.2, sinceAttack: 0.05, bossPhase: 2, sincePhaseChange: 0.4 });
assert.equal(dead.phase, 'death');
assert.equal(dead.tell, 0);
assert.equal(dead.commit, 0);
assert.equal(dead.phaseTransition, 0);
assert.equal(dead.modifier, 0);

console.log('ENEMY_BOSS_ANIMATION_PASS roles=5 tell=deterministic commit=recovery phase2=authored modifiers=status-additive');
