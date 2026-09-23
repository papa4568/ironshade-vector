import assert from 'node:assert/strict';
import {
  breacherVariantDefinitions,
  carbineVariantDefinitions,
  railVariantDefinitions,
  weaponVariantBuildIntegrations,
} from '../src/game/classArsenal';
import {
  classAbilityKits,
  operatorWeaponFamilyByClass,
  type OperatorClassId,
  type OperatorWeaponFamily,
} from '../src/game/classSkills';

const operatorClasses = Object.keys(operatorWeaponFamilyByClass) as OperatorClassId[];
const ownedFamilies = Object.values(operatorWeaponFamilyByClass) as OperatorWeaponFamily[];
const variantDefinitions = [
  ...carbineVariantDefinitions,
  ...breacherVariantDefinitions,
  ...railVariantDefinitions,
];

assert.deepEqual(
  [...operatorClasses].sort(),
  ['systems', 'vanguard', 'vector'],
  'P14-F closes with exactly the three shipped operator classes until a genuinely distinct future class is authored.',
);
assert.equal(
  new Set(ownedFamilies).size,
  operatorClasses.length,
  'Every shipped operator class must retain exactly one distinct owned weapon family.',
);
assert.deepEqual(
  [...new Set(ownedFamilies)].sort(),
  ['breacher', 'carbine', 'rail'],
  'P14-F must not introduce a fourth weapon family without a new class or distinct combat-role decision.',
);

for (const operatorClass of operatorClasses) {
  const family = operatorWeaponFamilyByClass[operatorClass];
  const kit = classAbilityKits[operatorClass];
  assert.equal(kit.length, 3, `${operatorClass} must keep a complete class-owned skill kit.`);
  for (const ability of kit) {
    assert.equal(
      ability.weaponFamily,
      family,
      `${operatorClass} ability ${ability.name} must remain owned by ${family}; cross-family drift would invalidate the P14-F gate.`,
    );
  }
}

assert.equal(variantDefinitions.length, 6, 'The completed P14 arsenal must remain the verified six-variant set.');
assert.equal(weaponVariantBuildIntegrations.length, 6, 'Every shipped variant must keep one build-integration row.');

const variantsByFamily = new Map<OperatorWeaponFamily, number>();
for (const definition of variantDefinitions) {
  variantsByFamily.set(definition.family, (variantsByFamily.get(definition.family) ?? 0) + 1);
}
for (const family of ownedFamilies) {
  assert.equal(
    variantsByFamily.get(family),
    2,
    `${family} must retain its verified two-variant pair before another family can be justified.`,
  );
}

const integrationFamilies = new Set(weaponVariantBuildIntegrations.map(entry => entry.family));
assert.deepEqual(
  [...integrationFamilies].sort(),
  ['breacher', 'carbine', 'rail'],
  'Build integration must not silently create a fourth family surface.',
);

console.log(
  `P14_F_FOURTH_FAMILY_GATE_PASS classes=${operatorClasses.length} families=${new Set(ownedFamilies).size} variants=${variantDefinitions.length} decision=hold-three-families-until-distinct-role`,
);
