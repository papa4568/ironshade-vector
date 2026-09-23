import type { Enemy } from './sim';

export type EnemyHudReadabilityInput = Pick<Enemy, 'role' | 'combatClass' | 'hp' | 'maxHp' | 'armor' | 'maxArmor' | 'dead'>;

export type EnemyHudReadability = {
  renderTier: 'desktop' | 'mobile-lod2';
  showHealthBar: boolean;
  showStatusText: boolean;
  showRoleTag: boolean;
  showClassTag: boolean;
  showModifierTag: boolean;
  showBossPattern: boolean;
};

export const MOBILE_ENEMY_TELL_CHANNELS = ['telegraph', 'protocol', 'mutation', 'status', 'lifecycle'] as const;

export function resolveEnemyHudReadability(
  enemy: EnemyHudReadabilityInput,
  coarse: boolean,
  focused: boolean,
): EnemyHudReadability {
  if (!coarse) {
    return {
      renderTier: 'desktop',
      showHealthBar: !enemy.dead,
      showStatusText: true,
      showRoleTag: true,
      showClassTag: true,
      showModifierTag: true,
      showBossPattern: true,
    };
  }

  const hpRatio = enemy.hp / Math.max(1, enemy.maxHp);
  const armorBroken = enemy.maxArmor > 0 && enemy.armor <= 0;
  const priorityDurability = hpRatio <= 0.5 || armorBroken;
  const priorityEnemy = enemy.role === 'boss' || enemy.role === 'elite';

  return {
    renderTier: 'mobile-lod2',
    showHealthBar: !enemy.dead && (priorityEnemy || focused || priorityDurability),
    showStatusText: focused,
    showRoleTag: false,
    showClassTag: focused && (enemy.combatClass === 'enhanced' || enemy.combatClass === 'elite'),
    showModifierTag: focused,
    showBossPattern: false,
  };
}

export function enemyHudReadabilityTelemetry(coarse: boolean, reducedEffects: boolean) {
  return [
    coarse ? 'mobile-lod2' : 'desktop',
    coarse ? 'priority-bars+focused-tags' : 'full-bars+full-tags',
    'tells:telegraph+protocol+mutation+status+lifecycle',
    reducedEffects ? 'reduced-effects:identity-preserved' : 'effects:full',
  ].join('|');
}
