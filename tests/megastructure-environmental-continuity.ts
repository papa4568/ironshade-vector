import assert from 'node:assert/strict';
import { createDefaultCampaign, generateContracts, getMegastructureStageContract, type Contract, type MegastructureId } from '../src/game/campaign';
import { applyMissionSetup, createDirector, stepMissionDirector } from '../src/game/director';
import { createSimulation, neutralCombatBuild } from '../src/game/sim';

function megastructureContract(cycle: number, id: MegastructureId): Contract {
  const campaign = { ...createDefaultCampaign(), cycle, contractsCompleted: 3 };
  const contract = generateContracts(campaign).find(item => item.megastructure === id);
  assert.ok(contract, `${id} must be available at cycle ${cycle}`);
  return contract;
}

function assertUniqueConditions(contract: Contract) {
  assert.equal(new Set(contract.conditions).size, contract.conditions.length, `${contract.locationName} must not duplicate authored and inherited environmental conditions`);
}

const perseid = megastructureContract(3, 'generation-ship');
const perseidStage1 = getMegastructureStageContract(perseid, 0);
assert.deepEqual(perseidStage1.megastructureContinuityConditions, [], 'the first Perseid space must start without inherited environmental state');
const perseidStage2 = getMegastructureStageContract(perseid, 1);
assert.deepEqual(perseidStage2.megastructureContinuityConditions, ['limited-atmosphere'], 'Perseid agricultural drum must inherit docking-spine atmosphere debt');
assert.ok(perseidStage2.conditions.includes('failing-gravity') && perseidStage2.conditions.includes('limited-atmosphere'), 'Perseid stage 2 must combine its local gravity failure with inherited atmosphere loss');
assert.match(perseidStage2.directorPreview, /ENVIRONMENTAL CONTINUITY/, 'megastructure mission preview must disclose inherited environmental state');
assertUniqueConditions(perseidStage2);
const perseidState = createSimulation(neutralCombatBuild);
applyMissionSetup(perseidState, perseidStage2);
assert.ok(perseidState.sectors[1].pressure <= 0.52, 'inherited Perseid atmosphere debt must affect the live agricultural-drum pressure ceiling');

const k91 = megastructureContract(8, 'counterweight');
const k91Stage4 = getMegastructureStageContract(k91, 3);
assert.deepEqual(k91Stage4.megastructureContinuityConditions, ['damaged-grid'], 'K-91 Ballast Vault must inherit the lift-bus grid fault');
assert.ok(k91Stage4.conditions.includes('limited-atmosphere') && k91Stage4.conditions.includes('damaged-grid'), 'K-91 final space must preserve both local atmosphere risk and carried grid damage');
assertUniqueConditions(k91Stage4);
const k91State = createSimulation(neutralCombatBuild);
applyMissionSetup(k91State, k91Stage4);
const k91Director = createDirector();
stepMissionDirector(k91State, k91Director, k91Stage4, 10.1);
assert.equal(k91Director.gridTriggered, true, 'carried K-91 grid damage must enter the normal damaged-grid director path');
assert.ok(k91State.hazards.some(hazard => hazard.active && hazard.kind === 'shockGrid'), 'carried K-91 grid damage must create a live arc-field hazard');

const orpheline = megastructureContract(13, 'hidden-habitat');
const orphelineStage4 = getMegastructureStageContract(orpheline, 3);
assert.deepEqual(orphelineStage4.megastructureContinuityConditions, ['failing-gravity'], 'Orpheline founding vault must inherit residential-ring momentum loss');
assertUniqueConditions(orphelineStage4);
const orphelineState = createSimulation(neutralCombatBuild);
applyMissionSetup(orphelineState, orphelineStage4);
assert.ok(orphelineState.sectors[1].gravity <= 0.22, 'inherited Orpheline gravity loss must affect the live vault transfer zone');

const hecate = megastructureContract(18, 'shipbreaking-yard');
const hecateStage2 = getMegastructureStageContract(hecate, 1);
assert.deepEqual(hecateStage2.megastructureContinuityConditions, ['failing-gravity'], 'Hecate Crusher Causeway must inherit the clamp-release gravity fault');
assertUniqueConditions(hecateStage2);
const hecateStage4 = getMegastructureStageContract(hecate, 3);
assert.deepEqual(hecateStage4.megastructureContinuityConditions, ['limited-atmosphere'], 'Hecate control crown must inherit the wreck-chain atmosphere ceiling');
assert.ok(hecateStage4.conditions.includes('failing-gravity') && hecateStage4.conditions.includes('damaged-grid') && hecateStage4.conditions.includes('limited-atmosphere'), 'Hecate final space must layer local yard failures with carried wreck pressure loss');
assertUniqueConditions(hecateStage4);
const hecateState = createSimulation(neutralCombatBuild);
applyMissionSetup(hecateState, hecateStage4);
assert.ok(hecateState.sectors[0].pressure <= 0.74 && hecateState.sectors[1].pressure <= 0.52 && hecateState.sectors[2].pressure <= 0.68, 'inherited Hecate pressure loss must survive into all three control-crown sectors');

console.log('Megastructure environmental continuity regression passed.');
