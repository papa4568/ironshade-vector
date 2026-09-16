import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`${label} anchor missing`);
  return source.replace(before, after);
}

const combatPath = 'src/components/GameCanvas.tsx';
let combat = readFileSync(combatPath, 'utf8');

const importBefore = "import { getMissionObjectiveStatus, getNextMissionObjectiveTarget } from '../game/encounters';";
const importAfter = `${importBefore}\nimport { findNavigationPath } from '../game/mapPathfinding';`;
combat = replaceOnce(combat, importBefore, importAfter, 'pathfinding import');

const targetBefore = "const objectiveTarget = getNextMissionObjectiveTarget(stateRef.current, activeMission); const objectiveDelta = objectiveTarget ? { x: objectiveTarget.x + objectiveTarget.w / 2 - stateRef.current.player.x, y: objectiveTarget.y + objectiveTarget.h / 2 - stateRef.current.player.y } : null; const objectiveRange = objectiveDelta ? Math.round(Math.hypot(objectiveDelta.x, objectiveDelta.y)) : 0; const objectiveDirection = objectiveDelta ? objectiveScreenDirection(objectiveDelta.x, objectiveDelta.y) : ''; const extractionReady = hud.extractionReady && objectiveStatus.complete;";
const targetAfter = "const objectiveTarget = getNextMissionObjectiveTarget(stateRef.current, activeMission); const routeNeeded = !!objectiveTarget && hud.squadRemaining === 0 && !hud.bossActive && !objectiveStatus.complete; const objectiveRoute = routeNeeded && objectiveTarget ? findNavigationPath(stateRef.current, objectiveTarget) : null; const objectiveWaypoint = objectiveRoute?.complete && objectiveRoute.points.length > 1 ? objectiveRoute.points[1] : objectiveTarget ? { x: objectiveTarget.x + objectiveTarget.w / 2, y: objectiveTarget.y + objectiveTarget.h / 2 } : null; const objectiveDelta = objectiveWaypoint ? { x: objectiveWaypoint.x - stateRef.current.player.x, y: objectiveWaypoint.y - stateRef.current.player.y } : null; const objectiveRange = objectiveRoute?.complete ? Math.round(objectiveRoute.points.slice(1).reduce((total, point, index) => { const previous = objectiveRoute.points[index]; return total + Math.hypot(point.x - previous.x, point.y - previous.y); }, 0)) : objectiveTarget ? Math.round(Math.hypot(objectiveTarget.x + objectiveTarget.w / 2 - stateRef.current.player.x, objectiveTarget.y + objectiveTarget.h / 2 - stateRef.current.player.y)) : 0; const objectiveDirection = objectiveDelta ? objectiveScreenDirection(objectiveDelta.x, objectiveDelta.y) : ''; const objectiveRouteMode = objectiveRoute?.complete ? 'ROUTE' : 'DIRECT'; const extractionReady = hud.extractionReady && objectiveStatus.complete;";
combat = replaceOnce(combat, targetBefore, targetAfter, 'route-aware objective locator');

const promptBefore = "{objectiveTarget ? `NEXT ACT // ${objectiveTarget.label.toUpperCase()} // ${objectiveDirection} // RANGE ${objectiveRange}` : 'SYSTEM RECOVERY IN PROGRESS // HOLD THE ZONE'}";
const promptAfter = "{objectiveTarget ? `NEXT ACT // ${objectiveTarget.label.toUpperCase()} // ${objectiveRouteMode} ${objectiveDirection} // RANGE ${objectiveRange}` : 'SYSTEM RECOVERY IN PROGRESS // HOLD THE ZONE'}";
combat = replaceOnce(combat, promptBefore, promptAfter, 'route-aware objective prompt');
writeFileSync(combatPath, combat);

const uiTestPath = 'tests/ui-readability.ts';
let uiTest = readFileSync(uiTestPath, 'utf8');
const testBefore = "assert(combat.includes('objectiveScreenDirection') && combat.includes('RANGE ${objectiveRange}'), 'Post-clear objectives are missing off-screen direction and range guidance.');";
const testAfter = "assert(combat.includes('findNavigationPath') && combat.includes('ROUTE ${objectiveDirection}') && combat.includes('RANGE ${objectiveRange}'), 'Post-clear objectives are missing obstacle-aware route direction and range guidance.');";
uiTest = replaceOnce(uiTest, testBefore, testAfter, 'route guidance regression');
writeFileSync(uiTestPath, uiTest);
