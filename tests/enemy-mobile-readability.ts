import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MOBILE_ENEMY_TELL_CHANNELS,
  enemyHudReadabilityTelemetry,
  resolveEnemyHudReadability,
  type EnemyHudReadabilityInput,
} from '../src/game/enemyMobileReadability';

const common: EnemyHudReadabilityInput = {
  role: 'assault',
  combatClass: 'standard',
  hp: 100,
  maxHp: 100,
  armor: 30,
  maxArmor: 30,
  dead: false,
};

const desktop = resolveEnemyHudReadability(common, false, false);
assert.equal(desktop.renderTier, 'desktop');
assert.equal(desktop.showHealthBar, true);
assert.equal(desktop.showStatusText, true);
assert.equal(desktop.showRoleTag, true);
assert.equal(desktop.showModifierTag, true);
assert.equal(desktop.showBossPattern, true);

const mobileCommon = resolveEnemyHudReadability(common, true, false);
assert.equal(mobileCommon.renderTier, 'mobile-lod2');
assert.equal(mobileCommon.showHealthBar, false, 'pristine common enemies should not keep redundant mobile health bars');
assert.equal(mobileCommon.showStatusText, false, 'world status language should replace untargeted status text on mobile');
assert.equal(mobileCommon.showRoleTag, false, 'silhouette should replace role text on mobile');
assert.equal(mobileCommon.showModifierTag, false, 'world modifier language should replace untargeted modifier text on mobile');

const focused = resolveEnemyHudReadability({ ...common, combatClass: 'enhanced' }, true, true);
assert.equal(focused.showHealthBar, true);
assert.equal(focused.showStatusText, true);
assert.equal(focused.showClassTag, true);
assert.equal(focused.showModifierTag, true);
assert.equal(focused.showRoleTag, false);

const damaged = resolveEnemyHudReadability({ ...common, hp: 49 }, true, false);
assert.equal(damaged.showHealthBar, true, 'critical common-enemy durability should remain readable without target lock');

const armorBroken = resolveEnemyHudReadability({ ...common, armor: 0 }, true, false);
assert.equal(armorBroken.showHealthBar, true, 'armor-break urgency should preserve the mobile durability bar');

const elite = resolveEnemyHudReadability({ ...common, role: 'elite', combatClass: 'elite' }, true, false);
assert.equal(elite.showHealthBar, true);
assert.equal(elite.showModifierTag, false);

const boss = resolveEnemyHudReadability({ ...common, role: 'boss', combatClass: 'elite' }, true, false);
assert.equal(boss.showHealthBar, true);
assert.equal(boss.showBossPattern, false, 'boss pattern text is redundant with the boss HUD and world telegraph on mobile');

assert.deepEqual(MOBILE_ENEMY_TELL_CHANNELS, ['telegraph', 'protocol', 'mutation', 'status', 'lifecycle']);
assert.match(enemyHudReadabilityTelemetry(true, true), /mobile-lod2\|priority-bars\+focused-tags\|tells:telegraph\+protocol\+mutation\+status\+lifecycle\|reduced-effects:identity-preserved/);

const renderer = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');
const canvas = readFileSync(resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
assert(renderer.includes('resolveEnemyHudReadability(enemy, this.coarse, enemy.id === mobileTargetId)'), 'Three.js enemy bars must consume the shared P13-G mobile policy.');
for (const tell of ['syncEnemyLifecyclePresentation', 'syncEnemyProtocolPresentation', 'syncEnemyMutationPresentation', 'syncEnemyStatusPresentation']) {
  assert(renderer.includes(tell), `Three.js must preserve ${tell} at mobile LOD2.`);
}
assert(renderer.includes("selectGraphicsAssetSpec(family, this.coarse ? 0.55 : 1)"), 'coarse hostile assets must keep the established authored mobile LOD selection.');
assert(canvas.includes('resolveEnemyHudReadability(enemy, coarse, enemy.id === mobileTargetId)'), 'Canvas fallback must consume the shared P13-G mobile policy.');
assert(/drawEnemyStatusPresentation\(ctx,[\s\S]{0,220}drawEnemyLifecyclePresentation\(ctx,[\s\S]{0,220}drawEnemyTelegraph\(ctx/.test(canvas), 'Canvas attack telegraph must stay authoritative over modifier/status/lifecycle presentation.');
assert(canvas.includes('enemyHudReadabilityTelemetry(coarse'), 'runtime QA telemetry must identify the active P13-G information budget.');
assert(canvas.includes("enemyLifecycleReducedEffects = profileSettingsRef.current.effectIntensity === 'reduced' ? 'preserved' : 'full'"), 'Reduced Effects must continue to publish preserved lifecycle identity telemetry.');

console.log('P13-G enemy mobile readability policy passed.');
