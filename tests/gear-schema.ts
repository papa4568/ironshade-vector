import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { augmentDefinitions, frameIdentityDefinitions } from '../src/game/gearDepth';
import { factionFrames } from '../src/game/factionGear';
import { rarityOrder } from '../src/game/rarity';
import {
  gearBuildTags,
  gearContentSourceAudit,
  gearPowerAxisAudit,
  gearSchemaVersion,
  gearTargetOwnership,
  validateGearSchemaContract,
} from '../src/game/gearSchema';

assert.equal(gearSchemaVersion, 1, 'Gear 2.0 target schema should start from an explicit version.');
assert.equal(validateGearSchemaContract(), true, 'Gear 2.0 target schema contract should be internally valid.');

const requiredTags = [
  'ballistics', 'penetration', 'armor-break', 'precision', 'projectile', 'recoil',
  'mobility', 'low-g', 'thermal', 'heat', 'venting', 'capacitor', 'cooldown',
  'systems', 'disruption', 'relay', 'mark', 'pressure', 'vacuum', 'defense',
];
assert.deepEqual([...gearBuildTags], requiredTags, 'P8.5-A build-tag vocabulary drifted from the roadmap contract.');

const requiredAxes = [
  'recovery-level', 'recovery-quality', 'frame-generation', 'equipment-quality',
  'modifier-grade', 'rarity', 'frame-identity', 'augments', 'faction', 'singular',
];
assert.deepEqual(gearPowerAxisAudit.map(axis => axis.id), requiredAxes, 'P8.5-A must inventory every current gear power axis before refactoring.');
assert.ok(gearPowerAxisAudit.every(axis => axis.currentOwners.length > 0 && axis.targetOwner && axis.targetRole && axis.implementationBatch.startsWith('P8.5-')), 'Every audited power axis needs current ownership, target ownership, and a later implementation batch.');

assert.deepEqual(Object.keys(gearTargetOwnership).sort(), ['affixes', 'augments', 'bases', 'buildTags', 'item', 'singulars', 'stats'].sort(), 'Gear target ownership must cover every registry category.');
assert.ok(Object.values(gearContentSourceAudit).every(sources => sources.length > 0), 'Every target registry category must identify its current source locations.');

const slots = ['carbine', 'breacher', 'rail', 'suit', 'rig', 'implant'] as const;
for (const slot of slots) {
  assert.equal(frameIdentityDefinitions.filter(definition => definition.slot === slot).length, 3, `${slot} should have three current frame identities accounted for by the audit.`);
  assert.ok(Object.values(factionFrames).every(frames => !!frames[slot]), `${slot} must exist in every current faction frame registry.`);
}
assert.equal(new Set(augmentDefinitions.map(definition => definition.id)).size, augmentDefinitions.length, 'Current Augment IDs must be unique before migration.');
assert.deepEqual(rarityOrder, ['Field', 'Refined', 'Prototype', 'Singular'], 'Target schema assumes the current four-rarity contract.');

const metaSource = readFileSync('src/game/meta.ts', 'utf8');
const basesSource = readFileSync('src/game/gearBases.ts', 'utf8');
const depthSource = readFileSync('src/game/gearDepth.ts', 'utf8');
const qualitySource = readFileSync('src/game/lootQuality.ts', 'utf8');
const reconstructionSource = readFileSync('src/game/reconstruction.ts', 'utf8');
const auditSource = readFileSync('docs/gear-architecture-audit.md', 'utf8');

for (const marker of ['const affixes:', 'bossSingularPools', 'deriveCombatBuild']) {
  assert.ok(metaSource.includes(marker), `Architecture audit marker missing from current meta source: ${marker}`);
}
assert.ok(basesSource.includes('gearBaseDefinitions') && basesSource.includes('allowedAffixGroups') && basesSource.includes('generationRange'), 'P8.5-C base-family registry changed without updating the architecture audit gate.');
assert.ok(depthSource.includes('frameIdentityDefinitions') && depthSource.includes('augmentDefinitions') && depthSource.includes('applyFrameIdentity') && depthSource.includes('applyAugments'), 'Gear-depth sources changed without updating the audit.');
assert.ok(qualitySource.includes('ModifierGrade') && qualitySource.includes('RecoveryQualityGrade') && qualitySource.includes('rollRarityForQuality'), 'Loot-quality power axes changed without updating the audit.');
assert.ok(reconstructionSource.includes('modifierLimit') && reconstructionSource.includes('candidateAffix') && reconstructionSource.includes('accessibleAugmentSlots'), 'Reconstruction responsibilities changed without updating the audit.');

for (const section of ['## Current state', '## Content ownership today', '## Target schema', '## Target ownership rules', '## Known migration debt reserved for later batches']) {
  assert.ok(auditSource.includes(section), `Gear architecture audit is missing required section: ${section}`);
}
assert.ok(auditSource.includes('P8.5-B through P8.5-K'), 'Audit must explicitly defer behavior/save migration to later Gear 2.0 batches.');

console.log('GEAR_SCHEMA_AUDIT_PASS axes=10 tags=20 registries=7 slots=6');
