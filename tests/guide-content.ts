import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { guideSections } from '../src/game/guideContent';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const app = read('src/App.tsx');
const armory = read('src/components/Armory.tsx');
const shipHub = read('src/components/ShipHub.tsx');
const css = read('src/guide.css');
const androidSmoke = read('scripts/android-runtime-smoke.mjs');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };

const ids = guideSections.map(section => section.id);
assert(ids.join('|') === 'combat-controls|equipment-rarity|builds-progression|crafting|ship-operations|accessibility-settings', 'P19-C canonical Guide section order drifted.');
assert(new Set(ids).size === ids.length, 'P19-C Guide section ids must be unique.');
assert(guideSections.every(section => section.summary.length > 20 && section.topics.length > 0 && section.topics.every(topic => topic.title && topic.body.length > 20)), 'P19-C Guide sections must contain durable readable teaching content.');

assert(shipHub.includes("intel: ['campaign', 'stories', 'factions', 'guide']") && shipHub.includes("guide: 'Guide'"), 'P19-C Guide must be a secondary Intel tab, not a sixth primary Command destination.');
assert((shipHub.match(/id: '(command|operations|operator|ship|intel)'/g) ?? []).length === 5, 'P19-C must preserve exactly five primary Command destinations.');
assert(shipHub.includes('data-guide-section={activeGuideSection.id}') && shipHub.includes('aria-label="Guide sections"') && shipHub.includes('guideRequest') && shipHub.includes('__ironshadeGuide'), 'P19-C Guide must support data-driven sections plus deep-link/history-back routing.');

for (const section of ['equipment-rarity', 'builds-progression', 'crafting', 'combat-controls', 'accessibility-settings']) {
  assert(armory.includes('section="' + section + '"'), 'P19-C Build contextual link missing Guide section ' + section);
}
assert(app.includes('openGuideFromBuild') && app.includes('guideReturnFocus') && app.includes('returnFromGuideToBuild'), 'P19-C App routing must restore the Build context after Guide back.');

assert(!armory.includes('Current success chance is derived from this frame') && !armory.includes('Each skill reads Class Skill → Weapon Family') && !armory.includes('WASD move · mouse aim'), 'P19-C duplicated long-form teaching must move out of feature screens.');
assert(armory.includes('EXACT COST') && armory.includes('TRADEOFF //') && armory.includes('<ActionRequirement presentation={craftingAccessRequirement} />') && armory.includes('<ActionRequirement presentation={skillEvolutionRequirement} />'), 'P19-C must keep costs, tradeoffs, and eligibility/blocker information local.');

assert(css.includes('.guide-layout') && css.includes('.guide-section-nav') && css.includes('min-height: 48px') && css.includes('@media (max-width: 700px)') && css.includes('var(--iv-type-body)') && css.includes('var(--iv-safe') === false, 'P19-C Guide must use shared typography/touch sizing and rely on the existing safe-area workspace rather than inventing a second shell.');
assert(androidSmoke.includes('ANDROID_P19_GUIDE_DEEPLINK_PASS') && androidSmoke.includes('data-guide-section="equipment-rarity"') && androidSmoke.includes("root.dataset.textScale = 'large'") && androidSmoke.includes('history.back()'), 'P19-C Android smoke must cover Guide deep-link/back, Large text, and responsive rotation.');
assert(pkg.scripts?.['test:guide']?.includes('tests/guide-content.ts'), 'P19-C Guide regression script is missing.');
assert(pkg.scripts?.build?.includes('npm run test:guide'), 'Full production build must gate on P19-C Guide regressions.');

console.log('GUIDE_CONTENT_PASS sections=6 ownership=canonical deeplink=build-to-intel back=history+focus critical-info=local responsive=compact+wide');
