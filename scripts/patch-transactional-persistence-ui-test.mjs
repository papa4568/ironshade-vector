import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const path = 'tests/ui-readability.ts';
let source = readFileSync(path, 'utf8');
const oldAssertion = "assert(app.includes('LOCAL SAVE FAILED') && app.includes('!saveProfile(profile)') && app.includes('!saveCampaign(campaign)'), 'Local persistence failures are not surfaced to the player.');";
const newAssertion = "assert(app.includes('LOCAL SAVE FAILED') && app.includes('!saveGameState(profile, campaign)'), 'Local persistence failures are not surfaced to the player.');";
if (!source.includes(newAssertion)) {
  if (!source.includes(oldAssertion)) throw new Error('Unable to locate local persistence UI regression assertion');
  source = source.replace(oldAssertion, newAssertion);
  writeFileSync(path, source);
}
if (existsSync('scripts/patch-transactional-persistence-ui-test.mjs')) unlinkSync('scripts/patch-transactional-persistence-ui-test.mjs');
console.log('TRANSACTIONAL_PERSISTENCE_UI_TEST_PATCHED');
