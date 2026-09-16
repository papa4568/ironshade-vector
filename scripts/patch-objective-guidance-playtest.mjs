import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`${label} anchor missing`);
  return source.replace(before, after);
}

const combatPath = 'src/components/GameCanvas.tsx';
let combat = readFileSync(combatPath, 'utf8');

const vectorAnchor = "function screenVectorToWorld(dx: number, dy: number): Vec2 { const wx = dx / (2 * isoScaleX) + dy / (2 * isoScaleY); const wy = dy / (2 * isoScaleY) - dx / (2 * isoScaleX); const l = Math.hypot(wx, wy); return l > 0.01 ? { x: wx / l, y: wy / l } : { x: 0, y: 0 }; }";
const vectorAfter = `${vectorAnchor}\nfunction objectiveScreenDirection(dx: number, dy: number) { const sx = (dx - dy) * isoScaleX; const sy = (dx + dy) * isoScaleY; const angle = Math.atan2(sy, sx); const octant = (Math.round(angle / (Math.PI / 4)) + 8) % 8; return ['RIGHT', 'DOWN-RIGHT', 'DOWN', 'DOWN-LEFT', 'LEFT', 'UP-LEFT', 'UP', 'UP-RIGHT'][octant]; }`;
combat = replaceOnce(combat, vectorAnchor, vectorAfter, 'objective direction helper');

const targetBefore = "const objectiveTarget = getNextMissionObjectiveTarget(stateRef.current, activeMission); const extractionReady = hud.extractionReady && objectiveStatus.complete;";
const targetAfter = "const objectiveTarget = getNextMissionObjectiveTarget(stateRef.current, activeMission); const objectiveDelta = objectiveTarget ? { x: objectiveTarget.x + objectiveTarget.w / 2 - stateRef.current.player.x, y: objectiveTarget.y + objectiveTarget.h / 2 - stateRef.current.player.y } : null; const objectiveRange = objectiveDelta ? Math.round(Math.hypot(objectiveDelta.x, objectiveDelta.y)) : 0; const objectiveDirection = objectiveDelta ? objectiveScreenDirection(objectiveDelta.x, objectiveDelta.y) : ''; const extractionReady = hud.extractionReady && objectiveStatus.complete;";
combat = replaceOnce(combat, targetBefore, targetAfter, 'objective locator state');

const promptBefore = "{objectiveTarget ? `NEXT ACT // ${objectiveTarget.label.toUpperCase()}` : 'SYSTEM RECOVERY IN PROGRESS // HOLD THE ZONE'}";
const promptAfter = "{objectiveTarget ? `NEXT ACT // ${objectiveTarget.label.toUpperCase()} // ${objectiveDirection} // RANGE ${objectiveRange}` : 'SYSTEM RECOVERY IN PROGRESS // HOLD THE ZONE'}";
combat = replaceOnce(combat, promptBefore, promptAfter, 'post-clear objective guidance');
writeFileSync(combatPath, combat);

const uiTestPath = 'tests/ui-readability.ts';
let uiTest = readFileSync(uiTestPath, 'utf8');
const testAnchor = "assert(combat.includes('mission-build-label') && !combat.includes('objectiveStatus.detail : hud.squadRemaining'), 'Combat mission card still duplicates objective guidance.');";
const testAfter = `${testAnchor}\nassert(combat.includes('objectiveScreenDirection') && combat.includes('RANGE ${'${objectiveRange}'}'), 'Post-clear objectives are missing off-screen direction and range guidance.');`;
uiTest = replaceOnce(uiTest, testAnchor, testAfter, 'UI objective locator regression');
writeFileSync(uiTestPath, uiTest);

const playtestPath = 'scripts/browser-level1-20-playtest.mjs';
let playtest = readFileSync(playtestPath, 'utf8');
const handleAnchor = '\nasync function handleOverlay(page, overlay, missionIndex, startingLevel) {';
const locatorHelper = String.raw`
async function followPostClearLocator(page) {
  const prompt = page.locator('.post-clear-objective').first();
  if (!await visible(prompt)) return false;
  const guidance = await text(prompt);
  const match = guidance.match(/NEXT ACT[\s\S]*?\b(UP-LEFT|UP-RIGHT|DOWN-LEFT|DOWN-RIGHT|UP|DOWN|LEFT|RIGHT)\b[\s\S]*?RANGE\s+(\d+)/i);
  if (!match) return false;
  const angles = { RIGHT: 0, 'DOWN-RIGHT': Math.PI / 4, DOWN: Math.PI / 2, 'DOWN-LEFT': Math.PI * 3 / 4, LEFT: Math.PI, 'UP-LEFT': Math.PI * 5 / 4, UP: Math.PI * 3 / 2, 'UP-RIGHT': Math.PI * 7 / 4 };
  const direction = match[1].toUpperCase();
  const range = Number(match[2]);
  const duration = range > 500 ? 1800 : range > 240 ? 1200 : 650;
  log('Following visible objective locator: ' + direction + ' range ' + range);
  await moveWithStick(page, angles[direction], duration);
  await interactIfAvailable(page);
  return true;
}
`;
playtest = replaceOnce(playtest, handleAnchor, `${locatorHelper}${handleAnchor}`, 'playtest objective follower');

const loopAnchor = "    await interactIfAvailable(page);\n    await useCombatActions(page, cycle);";
const loopAfter = "    if (await followPostClearLocator(page)) { cycle += 1; continue; }\n    await interactIfAvailable(page);\n    await useCombatActions(page, cycle);";
playtest = replaceOnce(playtest, loopAnchor, loopAfter, 'playtest post-clear navigation');
writeFileSync(playtestPath, playtest);
