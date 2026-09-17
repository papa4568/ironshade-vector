import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const gameCanvasPath = 'src/components/GameCanvas.tsx';
const helperPath = 'src/game/expeditionCarry.ts';
const gameplayTestPath = 'tests/gameplay-regressions.ts';

let gameCanvas = readFileSync(gameCanvasPath, 'utf8');
const lootImport = "import { lootColor, lootLabel, type GroundLootReceipt } from '../game/fieldLoot';";
const carryImport = "import { carryExpeditionLoot } from '../game/expeditionCarry';";
if (!gameCanvas.includes(carryImport)) {
  if (!gameCanvas.includes(lootImport)) throw new Error('Unable to locate field-loot import in GameCanvas');
  gameCanvas = gameCanvas.replace(lootImport, `${lootImport}\n${carryImport}`);
}

const carryNeedle = `    if (carry) {\n      state.time = carry.time + 1;`;
const carryReplacement = `    if (carry) {\n      state.collectedLoot = carryExpeditionLoot(carry.collectedLoot);\n      state.time = carry.time + 1;`;
if (!gameCanvas.includes('state.collectedLoot = carryExpeditionLoot(carry.collectedLoot);')) {
  if (!gameCanvas.includes(carryNeedle)) throw new Error('Unable to locate megastructure stage carry block in GameCanvas');
  gameCanvas = gameCanvas.replace(carryNeedle, carryReplacement);
}
writeFileSync(gameCanvasPath, gameCanvas);

const helperSource = `import type { GroundLootReceipt } from './fieldLoot';\n\nexport function carryExpeditionLoot(collectedLoot: GroundLootReceipt[]) {\n  return collectedLoot.map(receipt => ({ ...receipt }));\n}\n`;
if (!existsSync(helperPath) || readFileSync(helperPath, 'utf8') !== helperSource) writeFileSync(helperPath, helperSource);

let gameplayTest = readFileSync(gameplayTestPath, 'utf8');
const fsImport = "import { readFileSync } from 'node:fs';";
if (!gameplayTest.includes(fsImport)) {
  gameplayTest = gameplayTest.replace("import assert from 'node:assert/strict';", `import assert from 'node:assert/strict';\n${fsImport}`);
}
const helperImport = "import { carryExpeditionLoot } from '../src/game/expeditionCarry';";
if (!gameplayTest.includes(helperImport)) {
  const saveRecoveryImport = "import { CAMPAIGN_STORAGE_KEY, prepareSaveRecovery, PROFILE_STORAGE_KEY } from '../src/game/saveRecovery';";
  if (!gameplayTest.includes(saveRecoveryImport)) throw new Error('Unable to locate save recovery import in gameplay regressions');
  gameplayTest = gameplayTest.replace(saveRecoveryImport, `${saveRecoveryImport}\n${helperImport}`);
}

const regressionMarker = "const expeditionLootSource = [{ id: 'stage-1-drop'";
if (!gameplayTest.includes(regressionMarker)) {
  const insertBefore = 'failStorageWrites = true;';
  if (!gameplayTest.includes(insertBefore)) throw new Error('Unable to locate gameplay regression insertion point');
  const regression = `const expeditionLootSource = [{ id: 'stage-1-drop', enemyId: 7, enemyLabel: 'Stage One Elite', rarity: 'Prototype' as const, source: 'elite' as const, recoveryQualityFloor: 3 as const, recoveryLevel: 24, monsterLevel: 8 }];\nconst expeditionLootCarry = carryExpeditionLoot(expeditionLootSource);\nassert.deepEqual(expeditionLootCarry, expeditionLootSource, 'megastructure stage transit should preserve every collected field-loot receipt');\nassert.notEqual(expeditionLootCarry, expeditionLootSource, 'stage transit should copy the receipt list instead of sharing the mutable array');\nassert.notEqual(expeditionLootCarry[0], expeditionLootSource[0], 'stage transit should copy individual receipts so later mutation cannot rewrite earlier-stage recovery data');\nconst gameCanvasSource = readFileSync('src/components/GameCanvas.tsx', 'utf8');\nassert.match(gameCanvasSource, /state\\.collectedLoot = carryExpeditionLoot\\(carry\\.collectedLoot\\);/, 'GameCanvas must carry collected expedition loot into each new megastructure stage');\n\n`;
  gameplayTest = gameplayTest.replace(insertBefore, regression + insertBefore);
}
writeFileSync(gameplayTestPath, gameplayTest);

if (!gameCanvas.includes(carryImport) || !gameCanvas.includes('state.collectedLoot = carryExpeditionLoot(carry.collectedLoot);')) throw new Error('GameCanvas carry integration did not apply');
if (!readFileSync(gameplayTestPath, 'utf8').includes(regressionMarker)) throw new Error('Megastructure loot regression did not apply');
console.log('MEGASTRUCTURE_LOOT_CARRY_PATCHED');
