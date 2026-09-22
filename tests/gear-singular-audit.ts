import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  gearSingularCategories,
  singularChaseDefinition,
  singularChaseDefinitions,
  validateSingularChaseRegistry,
} from '../src/game/gearSingulars';

assert.equal(validateSingularChaseRegistry(), true, 'P8.5-I Singular chase registry must remain internally valid.');
assert.equal(singularChaseDefinitions.length, 60, 'P8.5-I must classify every current named Singular.');
assert.equal(new Set(singularChaseDefinitions.map(definition => definition.baseId)).size, singularChaseDefinitions.length, 'Singular chase registry base IDs must be unique.');

const requiredCategories = [
  'skill-transformer',
  'resource-loop',
  'movement-transformer',
  'projectile-transformer',
  'defense-transformer',
  'conditional-engine',
  'build-converter',
  'environmental-interaction',
] as const;
assert.deepEqual([...gearSingularCategories], [...requiredCategories], 'Singular category vocabulary drifted from the P8.5-I contract.');
for (const category of requiredCategories) {
  assert.ok(singularChaseDefinitions.some(definition => definition.category === category), `P8.5-I category has no Singulars: ${category}`);
}

const metaSource = readFileSync('src/game/meta.ts', 'utf8');
const simSource = readFileSync('src/game/sim.ts', 'utf8');
const runtimeSingulars = [...metaSource.matchAll(/singular\(\{\s*baseId:\s*'([^']+)'[\s\S]*?singularTrait:\s*'([^']+)'[\s\S]*?singularEffect:\s*'([^']+)'\s*\}\)/g)]
  .map(match => ({ baseId: match[1], singularTrait: match[2], rule: match[3] }));

assert.equal(runtimeSingulars.length, singularChaseDefinitions.length, 'Every runtime Singular must have exactly one P8.5-I audit row.');
assert.equal(new Set(runtimeSingulars.map(item => item.baseId)).size, runtimeSingulars.length, 'Runtime Singular base IDs must stay unique.');

for (const item of runtimeSingulars) {
  const definition = singularChaseDefinition(item.baseId);
  assert.ok(definition, `Runtime Singular is missing chase metadata: ${item.baseId}`);
  assert.equal(definition.singularTrait, item.singularTrait, `Singular trait drifted for ${item.baseId}`);
  assert.equal(definition.rule, item.rule, `Singular rule text drifted for ${item.baseId}`);
  assert.ok(definition.opportunityCost.length >= 24, `Singular opportunity cost is too vague for ${item.baseId}`);
}

for (const definition of singularChaseDefinitions) {
  assert.ok(runtimeSingulars.some(item => item.baseId === definition.baseId), `Chase registry contains a stale Singular: ${definition.baseId}`);
}

const runtimeTraits = new Set(runtimeSingulars.map(item => item.singularTrait));
for (const trait of runtimeTraits) {
  const escaped = trait.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  assert.match(simSource, new RegExp(`hasTrait\\([^\\n]*['"]${escaped}['"]\\)`), `Singular trait has no simulation hook: ${trait}`);
}

assert.ok(metaSource.includes('singularCategory: definition.category'), 'Runtime Singular items must expose their chase category.');
assert.ok(metaSource.includes('singularOpportunityCost: definition.opportunityCost'), 'Runtime Singular items must expose their opportunity cost.');

console.log(`GEAR_SINGULAR_AUDIT_PASS singulars=${singularChaseDefinitions.length} traits=${runtimeTraits.size} categories=${gearSingularCategories.length}`);
