from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if text.count(old) != 1:
        raise SystemExit(f'{path}: expected one match, found {text.count(old)} for {old[:90]!r}')
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str, flags: int = 0) -> None:
    text = read(path)
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{path}: regex expected one match, found {count}: {pattern[:100]!r}')
    write(path, next_text)


# Contract scaling fields.
replace_once(
    'src/game/campaign.ts',
    "combatEffectiveness?: number; operationRewardMultiplier?: number;",
    "combatEffectiveness?: number; monsterLevel?: number; monsterDamageScale?: number; operationRewardMultiplier?: number;",
)

# Carry operation difficulty into simulation runtime.
replace_once(
    'src/game/director.ts',
    "  applyThreatBudget(state.enemies, contract);\n  if (boss && (contract.operationTier ?? 1) >= 9)",
    "  applyThreatBudget(state.enemies, contract);\n  state.operationTier = contract.operationTier ?? 1;\n  state.monsterLevel = contract.monsterLevel ?? Math.max(1, Math.round(1 + ((contract.operationTier ?? 1) - 1) * 19 / 11));\n  state.maxRecoveryLevel = contract.maxRecoveryLevel ?? 12;\n  state.monsterDamageScale = contract.monsterDamageScale ?? 1;\n  if (boss && (contract.operationTier ?? 1) >= 9)",
)

# Simulation imports and types.
replace_once(
    'src/game/sim.ts',
    "import type { ConsumableId } from './consumables';",
    "import type { ConsumableId } from './consumables';\nimport { lootLabel, rollGroundLoot, type GroundLootDrop, type GroundLootReceipt } from './fieldLoot';",
)
replace_once(
    'src/game/sim.ts',
    "'boiloffDash' | 'splitReference';",
    "'boiloffDash' | 'splitReference' | 'forkedSpool' | 'breachEcho' | 'railDoublet' | 'magBloom' | 'markCascade';",
)
replace_once(
    'src/game/sim.ts',
    "dodgeCooldown: number; dodgeTime: number; invulnerable: number; consumableCooldown: number;",
    "dodgeCooldown: number; dodgeTime: number; lastDodgeAt: number; invulnerable: number; consumableCooldown: number;",
)
replace_once(
    'src/game/sim.ts',
    "bossGateHold: boolean; player: Player; enemies: Enemy[];",
    "bossGateHold: boolean; operationTier: number; monsterLevel: number; maxRecoveryLevel: number; monsterDamageScale: number; groundLoot: GroundLootDrop[]; collectedLoot: GroundLootReceipt[]; player: Player; enemies: Enemy[];",
)
replace_once(
    'src/game/sim.ts',
    "dodgeCooldown: 0, dodgeTime: 0, invulnerable: 0, consumableCooldown: 0,",
    "dodgeCooldown: 0, dodgeTime: 0, lastDodgeAt: -99, invulnerable: 0, consumableCooldown: 0,",
)
replace_once(
    'src/game/sim.ts',
    "    bossGateHold: false,\n    player:",
    "    bossGateHold: false,\n    operationTier: 1,\n    monsterLevel: 1,\n    maxRecoveryLevel: 12,\n    monsterDamageScale: 1,\n    groundLoot: [],\n    collectedLoot: [],\n    player:",
)

# Spawn deterministic, quality-weighted loot at the kill site.
replace_once(
    'src/game/sim.ts',
    "function finishEnemyDeath(state: SimState, enemy: Enemy) {",
    """function spawnGroundLoot(state: SimState, enemy: Enemy) {
  const drop = rollGroundLoot({ enemyId: enemy.id, enemyLabel: enemy.label, role: enemy.role, combatClass: enemy.combatClass, x: enemy.x, y: enemy.y, operationTier: state.operationTier, maxRecoveryLevel: state.maxRecoveryLevel, monsterLevel: state.monsterLevel, sequence: state.groundLoot.length + state.collectedLoot.length }, rand);
  if (!drop) return;
  state.groundLoot.push(drop);
  spawnEffect(state, drop.x, drop.y, drop.rarity === 'Singular' ? 'arc' : 'pulse', drop.rarity === 'Singular' ? 86 : 54, 0.6);
}

function finishEnemyDeath(state: SimState, enemy: Enemy) {""",
)
replace_once(
    'src/game/sim.ts',
    "  enemy.deathT = 0.8;\n  if (enemy.carriedObjectId)",
    "  enemy.deathT = 0.8;\n  spawnGroundLoot(state, enemy);\n  if (enemy.carriedObjectId)",
)
replace_once(
    'src/game/sim.ts',
    "  if (markedKill && hasTrait(state, 'deadreckon')) state.player.abilityCooldowns[1] = Math.min(state.player.abilityCooldowns[1], 1.2);\n  if (enemy.role === 'boss') {\n    state.bossDefeated = true;\n    state.complete = true;\n    pushEvent(state, `${enemy.label.toUpperCase()} OFFLINE // DEEP ZONE SECURED`, 4);\n    return;\n  }",
    """  if (markedKill && hasTrait(state, 'deadreckon')) state.player.abilityCooldowns[1] = Math.min(state.player.abilityCooldowns[1], 1.2);
  if (markedKill && hasTrait(state, 'markCascade')) {
    const relay = state.enemies.filter(candidate => candidate.active && !candidate.dead && candidate.id !== enemy.id && Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y) <= 430).sort((a, b) => Math.hypot(a.x - enemy.x, a.y - enemy.y) - Math.hypot(b.x - enemy.x, b.y - enemy.y))[0];
    if (relay) { relay.statuses.marked = Math.max(relay.statuses.marked, 4.2); spawnEffect(state, relay.x, relay.y, 'mark', 46, 0.5); pushEvent(state, `CASCADE SIGHT // MARK RELAYED TO ${relay.label.toUpperCase()}`, 1.4); }
  }
  if (enemy.role === 'boss') {
    state.bossDefeated = true;
    pushEvent(state, `${enemy.label.toUpperCase()} OFFLINE // COMMAND RECOVERY EJECTED`, 4);
    return;
  }""",
)

# Attack-transforming Singular mechanics.
replace_once(
    'src/game/sim.ts',
    "  const projectileSpeed = weapon.projectileSpeed *",
    """  const shotOrdinal = state.telemetry.weaponShots[p.currentWeapon] + 1;
  const forkedSpool = weapon.id === 'carbine' && hasTrait(state, 'forkedSpool') && shotOrdinal % 6 === 0;
  const breachEcho = weapon.id === 'breacher' && hasTrait(state, 'breachEcho') && state.time - p.lastDodgeAt <= 0.65;
  const railDoublet = weapon.id === 'rail' && hasTrait(state, 'railDoublet') && p.weaponHeat.rail < 0.22 && p.capacitor >= weapon.capacitorCost + 8;
  const projectileSpeed = weapon.projectileSpeed *""",
)
replace_once(
    'src/game/sim.ts',
    "  if (weapon.id === 'rail' && hasTrait(state, 'sunwardFracture')",
    """  if (forkedSpool) for (const angle of [-0.13, 0.13]) { const c = Math.cos(angle); const s = Math.sin(angle); const dir = { x: p.aim.x * c - p.aim.y * s, y: p.aim.x * s + p.aim.y * c }; addProjectile(state, p.x + dir.x * 28, p.y + dir.y * 28, dir, projectileSpeed * 0.96, shotDamage * 0.55, 'player', { weapon: 'carbine', penetration: shotPenetration * 0.58, armorDamage: weapon.armorDamage * 0.72, healthMultiplier: weapon.healthMultiplier * 0.8, knockback: shotKnockback * 0.6, radius: 3 }); }
  if (breachEcho) for (const angle of [-0.19, 0, 0.19]) { const c = Math.cos(angle); const s = Math.sin(angle); const dir = { x: p.aim.x * c - p.aim.y * s, y: p.aim.x * s + p.aim.y * c }; addProjectile(state, p.x + dir.x * 30, p.y + dir.y * 30, dir, projectileSpeed * 0.9, shotDamage * 0.55, 'player', { weapon: 'breacher', penetration: Math.max(5, shotPenetration * 0.55), armorDamage: weapon.armorDamage * 0.7, healthMultiplier: weapon.healthMultiplier * 0.75, knockback: shotKnockback * 0.8, radius: 3 }); }
  if (railDoublet) { const angle = 0.012; const c = Math.cos(angle); const s = Math.sin(angle); const dir = { x: p.aim.x * c - p.aim.y * s, y: p.aim.x * s + p.aim.y * c }; addProjectile(state, p.x + dir.x * 30, p.y + dir.y * 30, dir, projectileSpeed * 0.92, shotDamage * 0.58, 'player', { weapon: 'rail', penetration: shotPenetration * 0.72, armorDamage: weapon.armorDamage * 0.82, healthMultiplier: weapon.healthMultiplier * 0.82, knockback: shotKnockback * 0.65, radius: 4 }); p.capacitor = Math.max(0, p.capacitor - 8); }
  if (weapon.id === 'rail' && hasTrait(state, 'sunwardFracture')""",
)
replace_once(
    'src/game/sim.ts',
    " + (weapon.id === 'breacher' && hasTrait(state, 'redlineBulwark') && p.weaponHeat.breacher >= 0.72 ? 0.04 : 0));",
    " + (weapon.id === 'breacher' && hasTrait(state, 'redlineBulwark') && p.weaponHeat.breacher >= 0.72 ? 0.04 : 0) + (forkedSpool ? 0.05 : 0) + (breachEcho ? 0.07 : 0) + (railDoublet ? 0.08 : 0));",
)
replace_once(
    'src/game/sim.ts',
    "  p.vx = dir.x * speed; p.vy = dir.y * speed; p.dodgeTime = 0.18; p.invulnerable = 0.24;",
    "  p.vx = dir.x * speed; p.vy = dir.y * speed; p.dodgeTime = 0.18; p.lastDodgeAt = state.time; p.invulnerable = 0.24;",
)

# MAG Bloom and MARK Cascade ability transformations.
replace_once(
    'src/game/sim.ts',
    "    const counterKick = state.build.mechanics.magOverdriveKick ? 104 : 62;",
    """    if (hasTrait(state, 'magBloom')) {
      for (let spoke = 0; spoke < 8; spoke += 1) { const angle = Math.PI * 2 * spoke / 8; const dir = { x: Math.cos(angle), y: Math.sin(angle) }; addProjectile(state, p.x + dir.x * 34, p.y + dir.y * 34, dir, 590, 10 * meta.power, 'player', { weapon: 'carbine', penetration: 9, armorDamage: 0.52, healthMultiplier: 0.8, knockback: 0.035, radius: 3 }); }
      spawnEffect(state, p.x, p.y, 'pulse', 190, 0.5);
    }
    const counterKick = state.build.mechanics.magOverdriveKick ? 104 : 62;""",
)
replace_once(
    'src/game/sim.ts',
    "target.statuses.marked = 7.5 * meta.power;",
    "target.statuses.marked = 7.5 * meta.power * (hasTrait(state, 'markCascade') ? 0.78 : 1);",
)

# Scale hostile damage without multiplying environmental hazards.
replace_once(
    'src/game/sim.ts',
    "else applyPlayerDamage(state, 4.2, 0.45);",
    "else applyPlayerDamage(state, 4.2 * (hazard.owner === 'enemy' ? state.monsterDamageScale : 1), 0.45);",
)
replace_once(
    'src/game/sim.ts',
    "applyPlayerDamage(state, projectile.damage, 0); projectile.active = false;",
    "applyPlayerDamage(state, projectile.damage * state.monsterDamageScale, 0); projectile.active = false;",
)

# Pickups magnet to the operator, stay on the floor long enough to read, and boss completion waits for the command drop.
replace_once(
    'src/game/sim.ts',
    "function stepEffects(state: SimState, dt: number)",
    """function stepGroundLoot(state: SimState, dt: number) {
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
      pushEvent(state, `${lootLabel(drop.rarity)} // ${drop.enemyLabel.toUpperCase()} // EXTRACT TO KEEP`, drop.rarity === 'Singular' ? 2.4 : 1.6);
    }
  }
  if (state.bossDefeated && !state.complete && !state.groundLoot.some(drop => drop.source === 'boss' && drop.active && !drop.collected)) { state.complete = true; pushEvent(state, 'COMMAND RECOVERY SECURED // DEEP EXTRACTION READY', 3.2); }
}
function stepEffects(state: SimState, dt: number)""",
)
replace_once(
    'src/game/sim.ts',
    "stepDebris(state, dt); stepProjectiles(state, dt); stepBuildMechanics(state);",
    "stepDebris(state, dt); stepProjectiles(state, dt); stepGroundLoot(state, dt); stepBuildMechanics(state);",
)

# Level 20 progression and item requirements based on recovery/item level rather than current player level.
replace_once(
    'src/game/meta.ts',
    "import { applyAugments, applyFrameIdentity, augmentSlotCount, equipmentQualityForRecovery, factionFrameIdentity, frameImplicitDescription, inferFrameIdentity, normalizeAugments, rollFrameIdentity, singularFrameIdentity, type AugmentId, type FrameIdentityId } from './gearDepth';",
    "import { applyAugments, applyFrameIdentity, augmentSlotCount, equipmentQualityForRecovery, factionFrameIdentity, frameImplicitDescription, inferFrameIdentity, normalizeAugments, rollFrameIdentity, singularFrameIdentity, type AugmentId, type FrameIdentityId } from './gearDepth';\nimport type { GroundLootReceipt, GroundLootRarity } from './fieldLoot';",
)
replace_once(
    'src/game/meta.ts',
    "const levelThresholds = [0, 120, 300, 540, 840, 1200, 1620, 2100, 2640, 3240, 3900, 4620, 5400, 6240, 7140, 8100];",
    "const levelThresholds = [0, 120, 300, 540, 840, 1200, 1620, 2100, 2640, 3240, 3900, 4620, 5400, 6240, 7140, 8100, 9120, 10200, 11340, 12540];\nexport const maxOperatorLevel = levelThresholds.length;\nexport function levelRequirementForRecovery(recoveryLevel: number) { const normalized = Math.max(12, Math.min(56, recoveryLevel)); return Math.max(1, Math.min(maxOperatorLevel, 1 + Math.round((normalized - 12) / 44 * (maxOperatorLevel - 1)))); }",
)
# Singular, faction and ordinary recovery gear all use the recovery-level requirement.
write('src/game/meta.ts', read('src/game/meta.ts').replace("levelRequirement: Math.max(1, level - 1),", "levelRequirement: levelRequirementForRecovery(recoveryLevel),"))

# Allow ground loot to force its visible rarity when materialized on extraction.
replace_once(
    'src/game/meta.ts',
    "function makeItem(slot: EquipmentSlot, index: number, level: number, random: () => number, forcedAffixes: AffixId[] = [], recoveryLevel = 4, recoveryQuality: RecoveryQualityGrade = 0, recoverySource = 'Contract recovery', forcedCount?: number, frameOperatorLevel = level): Item {\n  const base = baseNames[slot];\n  const rarity: Rarity = forcedAffixes.length > 0 ? 'Prototype' : rollRarityForQuality(random, recoveryQuality);",
    "function makeItem(slot: EquipmentSlot, index: number, level: number, random: () => number, forcedAffixes: AffixId[] = [], recoveryLevel = 4, recoveryQuality: RecoveryQualityGrade = 0, recoverySource = 'Contract recovery', forcedCount?: number, frameOperatorLevel = level, forcedRarity?: Rarity): Item {\n  const base = baseNames[slot];\n  const rarity: Rarity = forcedRarity ?? (forcedAffixes.length > 0 ? 'Prototype' : rollRarityForQuality(random, recoveryQuality));",
)

# Five new build-defining Singulars, each with an explicit cost or cadence condition.
replace_once(
    'src/game/meta.ts',
    "  singular({ baseId: 'khepri-split-reference-link', name: 'Khepri Split-Reference Link', slot: 'implant', equipmentClass: 'Marked-machine Arc cognition implant', rarity: 'Singular', core: 'A Khepri reconstruction that spends a mark as permission to use nearby machinery as a second electrical origin.', modifiers: [{ ...affixes.markShear }, { ...affixes.arcDrone }, { ...affixes.magRedirect }], singularTrait: 'splitReference', singularEffect: 'Arc Tap on a marked target consumes the mark and can relay through nearby machinery into a second enemy.' }),\n];",
    """  singular({ baseId: 'khepri-split-reference-link', name: 'Khepri Split-Reference Link', slot: 'implant', equipmentClass: 'Marked-machine Arc cognition implant', rarity: 'Singular', core: 'A Khepri reconstruction that spends a mark as permission to use nearby machinery as a second electrical origin.', modifiers: [{ ...affixes.markShear }, { ...affixes.arcDrone }, { ...affixes.magRedirect }], singularTrait: 'splitReference', singularEffect: 'Arc Tap on a marked target consumes the mark and can relay through nearby machinery into a second enemy.' }),
  singular({ baseId: 'sixth-vector-m12', name: 'Sixth-Vector M-12', slot: 'carbine', equipmentClass: 'Cadence-fork coil carbine', rarity: 'Singular', core: 'A counter-rotating feed cage stores a firing solution for exactly five ordinary pulses before opening two side vectors on the sixth.', modifiers: [{ ...affixes.hypervelocity }, { ...affixes.extendedFeed }, { ...affixes.overdrive }], singularTrait: 'forkedSpool', singularEffect: 'Every sixth Carbine shot forks two 55% side vectors. The forked shot adds extra heat, rewarding deliberate cadence rather than permanent free damage.' }),
  singular({ baseId: 'backstep-kestrel-b9', name: 'Backstep Kestrel B-9', slot: 'breacher', equipmentClass: 'Counterstep breach scattergun', rarity: 'Singular', core: 'A recoil latch reads suit-thruster transients and briefly opens a second scatter gate after a committed evasive burn.', modifiers: [{ ...affixes.countermass }, { ...affixes.breachPropulsion }, { ...affixes.dodgeVent }], singularTrait: 'breachEcho', singularEffect: 'A Breacher shot within 0.65s of a dodge gains a three-pellet 55% echo cone, but the echoed shot adds extra heat.' }),
  singular({ baseId: 'cold-doublet-r7', name: 'Cold Doublet R-7', slot: 'rail', equipmentClass: 'Cold-start paired rail lance', rarity: 'Singular', core: 'Two unequal accelerator rails share a cryogenic bus: the secondary rail is stable only before the primary assembly warms.', modifiers: [{ ...affixes.cryoloop }, { ...affixes.tungsten }, { ...affixes.countermass }], singularTrait: 'railDoublet', singularEffect: 'Below 22% Rail heat and with 8 spare capacitor, each Rail shot launches a second 58% penetrator. The doublet consumes the extra capacitor and adds heat.' }),
  singular({ baseId: 'bloom-vector-rig', name: 'Bloom Vector Rig', slot: 'rig', equipmentClass: 'Radial impulse recovery rig', rarity: 'Singular', core: 'A ring of sacrificial micro-coils turns the MAG field collapse into a brief omnidirectional kinetic bloom.', modifiers: [{ ...affixes.capacitorRecycler }, { ...affixes.magRedirect }, { ...affixes.servoWeave }], singularTrait: 'magBloom', singularEffect: 'MAG fires eight radial kinetic micro-slugs after the impulse. Magnetic Impulse costs 25% more capacitor and recovers 8% slower.' }),
  singular({ baseId: 'cascade-sight-link', name: 'Cascade Sight Link', slot: 'implant', equipmentClass: 'Kill-relay sensor cognition link', rarity: 'Singular', core: 'A narrowband target model refuses to hold one solution for long, but transfers the dying target state into the nearest live return.', modifiers: [{ ...affixes.markShear }, { ...affixes.arcDrone }, { ...affixes.capacitorRecycler }], singularTrait: 'markCascade', singularEffect: 'Killing a marked target relays a 4.2s mark to a nearby enemy. Initial Sensor Spike marks are shorter and Sensor Spike recovers 12% slower.' }),
];""",
)
# Add new chase pieces across the campaign without replacing existing pools.
for old, new in [
    ("'orbital-station': ['arcspindle-m7', 'deadreckon-optics', 'palisade-breaker-b9']", "'orbital-station': ['arcspindle-m7', 'deadreckon-optics', 'palisade-breaker-b9', 'sixth-vector-m12', 'cascade-sight-link']"),
    ("'damaged-vessel': ['vacuum-choir-rails', 'glasswalker-eva', 'salvage-dynamo-rig', 'breathless-choir-mantle']", "'damaged-vessel': ['vacuum-choir-rails', 'glasswalker-eva', 'salvage-dynamo-rig', 'breathless-choir-mantle', 'backstep-kestrel-b9']"),
    ("'asteroid-refinery': ['borecutter-m7', 'cryostack-burn-rig', 'nullpoint-needle']", "'asteroid-refinery': ['borecutter-m7', 'cryostack-burn-rig', 'nullpoint-needle', 'cold-doublet-r7']"),
    ("'spin-habitat': ['atlas-countermass-harness', 'axis-ghost-rig', 'ghostline-m7', 'falling-star-harness']", "'spin-habitat': ['atlas-countermass-harness', 'axis-ghost-rig', 'ghostline-m7', 'falling-star-harness', 'bloom-vector-rig']"),
    ("'jovian-harvester': ['stormline-ventgun', 'jovian-stormskin', 'vacuum-choir-rails', 'vacuum-psalm-m12']", "'jovian-harvester': ['stormline-ventgun', 'jovian-stormskin', 'vacuum-choir-rails', 'vacuum-psalm-m12', 'sixth-vector-m12']"),
    ("'ice-mine': ['redline-kestrel', 'long-arc-relay-crown', 'salvage-dynamo-rig', 'scrap-circuit-rig']", "'ice-mine': ['redline-kestrel', 'long-arc-relay-crown', 'salvage-dynamo-rig', 'scrap-circuit-rig', 'backstep-kestrel-b9']"),
    ("'solar-yard': ['nullpoint-needle', 'arcspindle-m7', 'cryostack-burn-rig', 'relay-orchard-node', 'radiant-liability-kestrel']", "'solar-yard': ['nullpoint-needle', 'arcspindle-m7', 'cryostack-burn-rig', 'relay-orchard-node', 'radiant-liability-kestrel', 'bloom-vector-rig']"),
    ("'lattice-annex': ['nullpoint-needle', 'deadreckon-optics', 'vacuum-choir-rails', 'cold-witness-r7', 'khepri-split-reference-link']", "'lattice-annex': ['nullpoint-needle', 'deadreckon-optics', 'vacuum-choir-rails', 'cold-witness-r7', 'khepri-split-reference-link', 'cascade-sight-link']"),
    ("'momentum-exchange': ['pendulum-kestrel', 'mass-return-crown', 'vector-debt-m12']", "'momentum-exchange': ['pendulum-kestrel', 'mass-return-crown', 'vector-debt-m12', 'sixth-vector-m12']"),
    ("'cryo-reserve': ['umbra-heatsink-rig', 'cryoline-reference-rails', 'capacitor-rosary-rig', 'eventide-eva-skin']", "'cryo-reserve': ['umbra-heatsink-rig', 'cryoline-reference-rails', 'capacitor-rosary-rig', 'eventide-eva-skin', 'cold-doublet-r7']"),
]:
    replace_once('src/game/meta.ts', old, new)

# Apply Singular tradeoffs after traits have been collected from equipped items.
replace_once(
    'src/game/meta.ts',
    "  applyFactionSetBonuses(build, profile);",
    "  if (build.singularTraits.includes('magBloom')) { build.abilities[0].costMul *= 1.25; build.abilities[0].cooldownMul *= 1.08; }\n  if (build.singularTraits.includes('markCascade')) build.abilities[1].cooldownMul *= 1.12;\n  applyFactionSetBonuses(build, profile);",
)

# Field drops materialize only when successfully extracted. Existing hidden boss rewards remain for old callers/tests, while the live game uses the ground-drop path.
replace_once(
    'src/game/meta.ts',
    "export function awardRecovery(profile: PlayerProfile, telemetry: Telemetry, deep: boolean, _fabricationLevel = 0, source:",
    "export function awardRecovery(profile: PlayerProfile, telemetry: Telemetry, deep: boolean, _fabricationLevel = 0, source:",
)
regex_once(
    'src/game/meta.ts',
    r"export function awardRecovery\((profile: PlayerProfile, telemetry: Telemetry, deep: boolean, _fabricationLevel = 0, source: \{[^\n]+\} = \{\})\): VictoryReward \{",
    r"export function awardRecovery(\1, fieldLoot?: GroundLootReceipt[]): VictoryReward {",
)
replace_once(
    'src/game/meta.ts',
    "  const bossItem = actualDepth ? makeBossSingular(source.deepTarget ?? '', 0, nextLevel, random, bossRecoveryLevel, rollQuality(true, 4), `Boss pool // ${source.deepTarget ?? 'deep target'}`, profile.level) : null;",
    """  const fieldMode = Array.isArray(fieldLoot);
  const fieldDrops = (fieldLoot ?? []).slice(0, 12);
  const fieldSlots = chooseRecoverySlots(profile, fieldDrops.filter(drop => drop.source !== 'boss').length, random);
  let fieldSlotIndex = 0;
  const fieldItems: Item[] = fieldDrops.map((drop, index) => {
    const recoveryQuality = Math.max(drop.recoveryQualityFloor, rollQuality(drop.source === 'boss', drop.recoveryQualityFloor as RecoveryQualityGrade)) as RecoveryQualityGrade;
    const recoveryLevel = Math.max(1, Math.min(maxRecoveryLevel, drop.recoveryLevel));
    const recoverySource = `Ground drop // ${drop.enemyLabel}`;
    if (drop.source === 'boss' && drop.rarity === 'Singular') return makeBossSingular(source.deepTarget ?? '', 100 + index, nextLevel, random, recoveryLevel, recoveryQuality, recoverySource, profile.level) ?? makeLocationSingular(source.location ?? '', 100 + index, nextLevel, random, recoveryLevel, recoveryQuality, recoverySource, profile.level) ?? makeItem('rail', 100 + index, nextLevel, random, [], recoveryLevel, recoveryQuality, recoverySource, undefined, profile.level, 'Prototype');
    const slot = fieldSlots[fieldSlotIndex++] ?? recoverySlotOrder[(drop.enemyId + index) % recoverySlotOrder.length];
    const visibleRarity: Rarity = drop.rarity === 'Singular' ? 'Prototype' : drop.rarity as GroundLootRarity;
    return makeItem(slot, 100 + index, nextLevel, random, [], recoveryLevel, recoveryQuality, recoverySource, undefined, profile.level, visibleRarity);
  });
  const bossItem = actualDepth && !fieldMode ? makeBossSingular(source.deepTarget ?? '', 0, nextLevel, random, bossRecoveryLevel, rollQuality(true, 4), `Boss pool // ${source.deepTarget ?? 'deep target'}`, profile.level) : null;""",
)
replace_once(
    'src/game/meta.ts',
    "  const profileNext: PlayerProfile = {\n    ...profile,\n    xp: nextXp,",
    "  loot = [...fieldItems, ...loot];\n\n  const profileNext: PlayerProfile = {\n    ...profile,\n    xp: nextXp,",
)

# Live combat hands collected ground drops to the extraction reward system.
replace_once(
    'src/components/GameCanvas.tsx',
    "import { combatClassLabel, protocolDefinition } from '../game/eliteProtocols';",
    "import { combatClassLabel, protocolDefinition } from '../game/eliteProtocols';\nimport { lootColor, type GroundLootReceipt } from '../game/fieldLoot';",
)
replace_once(
    'src/components/GameCanvas.tsx',
    "onMissionResolve: (telemetry: Telemetry, depth: 'safe' | 'deep', salvageTags: number, expeditionProgress?: ExpeditionProgress) => void;",
    "onMissionResolve: (telemetry: Telemetry, depth: 'safe' | 'deep', salvageTags: number, expeditionProgress?: ExpeditionProgress, fieldLoot?: GroundLootReceipt[]) => void;",
)
# Canvas2D fallback drop rendering.
replace_once(
    'src/components/GameCanvas.tsx',
    "  if (quality > 0.65) for (const debris of state.debris)",
    """  for (const drop of state.groundLoot) { if (!drop.active || drop.collected) continue; const pos = project(drop.x, drop.y, camX, camY, width, height); const color = `#${lootColor(drop.rarity).toString(16).padStart(6, '0')}`; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.globalAlpha = 0.8 + Math.sin(state.time * 7 + drop.enemyId) * 0.15; ctx.beginPath(); ctx.arc(pos.x, pos.y - 8, drop.rarity === 'Singular' ? 16 : drop.rarity === 'Prototype' ? 12 : 9, 0, Math.PI * 2); ctx.stroke(); ctx.save(); ctx.translate(pos.x, pos.y - 20); ctx.rotate(Math.PI / 4); ctx.fillRect(-5, -5, 10, 10); ctx.restore(); ctx.globalAlpha = 1; }
  if (quality > 0.65) for (const debris of state.debris)""",
)
# All successful extraction routes send the collected receipts.
text = read('src/components/GameCanvas.tsx')
text = text.replace("onMissionResolve(stateRef.current.telemetry, 'safe', salvageTags, expeditionProgress)", "onMissionResolve(stateRef.current.telemetry, 'safe', salvageTags, expeditionProgress, stateRef.current.collectedLoot)")
text = text.replace("onMissionResolve(stateRef.current.telemetry, 'safe', salvageTags, isMegastructure ? expeditionProgress : undefined)", "onMissionResolve(stateRef.current.telemetry, 'safe', salvageTags, isMegastructure ? expeditionProgress : undefined, stateRef.current.collectedLoot)")
text = text.replace("onMissionResolve(stateRef.current.telemetry, 'deep', salvageTags, isMegastructure ? expeditionProgress : undefined)", "onMissionResolve(stateRef.current.telemetry, 'deep', salvageTags, isMegastructure ? expeditionProgress : undefined, stateRef.current.collectedLoot)")
write('src/components/GameCanvas.tsx', text)
replace_once(
    'src/components/GameCanvas.tsx',
    "OP T{activeMission.operationTier ?? 1} // {activeMission.locationName.toUpperCase()}",
    "OP T{activeMission.operationTier ?? 1} // ML {activeMission.monsterLevel ?? 1} // {activeMission.locationName.toUpperCase()}",
)

# App banks field items only on successful extraction.
replace_once(
    'src/App.tsx',
    "import type { Telemetry } from './game/sim';",
    "import type { Telemetry } from './game/sim';\nimport type { GroundLootReceipt } from './game/fieldLoot';",
)
replace_once(
    'src/App.tsx',
    "const finishMission = (telemetry: Telemetry, depth: 'safe' | 'deep', salvageTags: number, expeditionProgress?: ExpeditionProgress) => {",
    "const finishMission = (telemetry: Telemetry, depth: 'safe' | 'deep', salvageTags: number, expeditionProgress?: ExpeditionProgress, fieldLoot: GroundLootReceipt[] = []) => {",
)
replace_once(
    'src/App.tsx',
    "      directiveRecoveryLevelBonus: selectedContract.directiveRecoveryLevelBonus,\n    });",
    "      directiveRecoveryLevelBonus: selectedContract.directiveRecoveryLevelBonus,\n    }, fieldLoot);",
)

# Three.js pickup visuals.
replace_once(
    'src/game/threeCombatRenderer.ts',
    "import { buildHardSciFiEnvironment, decorateEnemy, decorateOperator, hardSciFiMuzzleOffset, syncEnemyVisual, syncHardSciFiBreaches, syncHardSciFiEnvironment, syncOperatorVisual } from './hardSciFiVisuals';",
    "import { buildHardSciFiEnvironment, decorateEnemy, decorateOperator, hardSciFiMuzzleOffset, syncEnemyVisual, syncHardSciFiBreaches, syncHardSciFiEnvironment, syncOperatorVisual } from './hardSciFiVisuals';\nimport { lootColor } from './fieldLoot';",
)
replace_once(
    'src/game/threeCombatRenderer.ts',
    "type DebrisVisual = THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial>;",
    "type DebrisVisual = THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial>;\ntype GroundLootVisual = { root: THREE.Group; core: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshStandardMaterial>; ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>; beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial> };",
)
replace_once(
    'src/game/threeCombatRenderer.ts',
    "  private readonly debrisPool: DebrisVisual[] = [];",
    "  private readonly debrisPool: DebrisVisual[] = [];\n  private readonly groundLootPool: GroundLootVisual[] = [];",
)
replace_once(
    'src/game/threeCombatRenderer.ts',
    "    this.syncProjectiles(state);\n    this.syncHazards(state);",
    "    this.syncProjectiles(state);\n    this.syncGroundLoot(state);\n    this.syncHazards(state);",
)
replace_once(
    'src/game/threeCombatRenderer.ts',
    "  private ensureRing(pool: RingVisual[], index: number, color: number) {",
    """  private syncGroundLoot(state: SimState) {
    let count = 0;
    for (const drop of state.groundLoot) {
      if (!drop.active || drop.collected) continue;
      while (this.groundLootPool.length <= count) {
        const root = new THREE.Group();
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2, metalness: 0.35, roughness: 0.22 }));
        core.position.y = 0.52;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.045, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.055, 1.7, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false })); beam.position.y = 0.9;
        root.add(core, ring, beam); this.dynamicRoot.add(root); this.groundLootPool.push({ root, core, ring, beam });
      }
      const visual = this.groundLootPool[count++]; const color = lootColor(drop.rarity); visual.root.visible = true; visual.root.position.set(scaled(drop.x), 0, scaled(drop.y)); visual.root.rotation.y = state.time * 0.8 + drop.enemyId; visual.core.material.color.setHex(color); visual.core.material.emissive.setHex(color); visual.ring.material.color.setHex(color); visual.beam.material.color.setHex(color); const pulse = 1 + Math.sin(state.time * 7 + drop.enemyId) * 0.12; visual.core.scale.setScalar(drop.rarity === 'Singular' ? 1.35 * pulse : drop.rarity === 'Prototype' ? 1.15 * pulse : pulse); visual.ring.scale.setScalar(drop.rarity === 'Singular' ? 1.4 : drop.rarity === 'Prototype' ? 1.18 : 1); visual.beam.material.opacity = drop.rarity === 'Singular' ? 0.48 : drop.rarity === 'Prototype' ? 0.34 : 0.2;
    }
    for (let index = count; index < this.groundLootPool.length; index += 1) this.groundLootPool[index].root.visible = false;
  }

  private ensureRing(pool: RingVisual[], index: number, color: number) {""",
)

# Build runs the new system-level tests.
replace_once(
    'package.json',
    '"build": "npm run test:beta && npm run test:gameplay && npm run test:maps && vite build",',
    '"build": "npm run test:beta && npm run test:gameplay && npm run test:maps && npm run test:loot && vite build",',
)
replace_once(
    'package.json',
    '"test:maps": "vite build --ssr tests/map-navigation.ts --outDir .map-dist && node .map-dist/map-navigation.js"',
    '"test:maps": "vite build --ssr tests/map-navigation.ts --outDir .map-dist && node .map-dist/map-navigation.js",\n    "test:loot": "vite build --ssr tests/loot-difficulty.ts --outDir .loot-dist && node .loot-dist/loot-difficulty.js"',
)

print('loot/difficulty patch applied')
