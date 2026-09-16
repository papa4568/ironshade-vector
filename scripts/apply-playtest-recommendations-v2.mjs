import { readFileSync, writeFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const write = (path, source) => writeFileSync(path, source);
function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error('Missing patch anchor: ' + label);
  return source.replace(before, after);
}
function replaceSection(source, start, end, replacement, label) {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) throw new Error('Missing section start: ' + label);
  const endIndex = source.indexOf(end, startIndex);
  if (endIndex < 0) throw new Error('Missing section end: ' + label);
  return source.slice(0, startIndex) + replacement + source.slice(endIndex);
}

// Standard board difficulty follows the operator instead of only completed-contract count.
{
  const path = 'src/game/scaling.ts';
  let source = read(path);
  if (!source.includes('standardTierCapForOperator')) {
    const replacement = [
      'export function standardTierCapForOperator(operatorLevel = 10) {',
      '  const targetMonsterLevel = Math.min(20, Math.max(1, Math.round(operatorLevel)) + 2);',
      '  let cap = 1;',
      '  for (let tier = 1; tier <= 12; tier += 1) {',
      '    if (monsterLevelForTier(tier) <= targetMonsterLevel) cap = tier;',
      '  }',
      '  return cap;',
      '}',
      'function isRotatingStandardContract(contract: Contract) {',
      "  return !contract.directiveTier && !contract.daily && !contract.storyArc && !contract.campaignChapter && !contract.commandTrace && !contract.escalationStage && !contract.megastructure;",
      '}',
      'function tierForContract(contract: Contract, campaign: CampaignState, operatorLevel: number) {',
      '  if (contract.directiveTier) return clamp(contract.directiveTier, 1, 12);',
      '  const baseline = clamp(1 + Math.floor(campaign.contractsCompleted / 2), 1, 12);',
      '  let tier = baseline;',
      '  if (contract.daily) tier = Math.max(tier, 3 + (contract.seed % 4));',
      '  if (contract.storyArc) tier = Math.max(tier, 2 + (contract.storyStep ?? 0));',
      "  if (contract.campaignChapter === 'black-lattice') tier = Math.max(tier, 3 + Math.floor((contract.campaignStep ?? 0) / 2));",
      "  if (contract.campaignChapter === 'dead-reckoning') tier = Math.max(tier, 7 + Math.floor((contract.campaignStep ?? 0) / 2));",
      "  if (contract.campaignChapter === 'dead-reckoning-interdiction') tier = Math.max(tier, 9 + Math.floor((contract.campaignStep ?? 0) / 2));",
      '  if (contract.commandTrace) tier = Math.max(tier, 10);',
      '  if (contract.escalationStage) tier = Math.max(tier, 4 + contract.escalationStage * 2);',
      '  if (contract.megastructure) tier = Math.max(tier, 5 + Math.min(3, Math.floor(campaign.contractsCompleted / 5)));',
      '  if (contract.priority) tier += 1;',
      '  if (contract.storyFinale || contract.campaignFinale || contract.escalationFinale) tier += 1;',
      '  if (isRotatingStandardContract(contract)) tier = Math.min(tier, standardTierCapForOperator(operatorLevel));',
      '  return clamp(tier, 1, 12);',
      '}',
      ''
    ].join('\n');
    source = replaceSection(source, 'function tierForContract', 'function patternFor', replacement, 'tierForContract');
    source = replaceOnce(source, 'const operationTier = tierForContract(contract, campaign);', 'const operationTier = tierForContract(contract, campaign, operatorLevel);', 'operator-aware tier calculation');
    write(path, source);
  }
}

// Route to unfinished ACT objectives and to the final hostile during extraction sweep.
{
  const path = 'src/components/GameCanvas.tsx';
  let source = read(path);
  if (!source.includes("import { findNavigationPath } from '../game/mapPathfinding';")) {
    source = replaceOnce(source, "import { getMissionObjectiveStatus, getNextMissionObjectiveTarget } from '../game/encounters';", "import { getMissionObjectiveStatus, getNextMissionObjectiveTarget } from '../game/encounters';\nimport { findNavigationPath } from '../game/mapPathfinding';", 'pathfinder import');
  }
  if (!source.includes('function objectiveScreenDirection')) {
    const anchor = "function screenVectorToWorld(dx: number, dy: number): Vec2 { const wx = dx / (2 * isoScaleX) + dy / (2 * isoScaleY); const wy = dy / (2 * isoScaleY) - dx / (2 * isoScaleX); const l = Math.hypot(wx, wy); return l > 0.01 ? { x: wx / l, y: wy / l } : { x: 0, y: 0 }; }";
    const helper = "function objectiveScreenDirection(dx: number, dy: number) { const sx = (dx - dy) * isoScaleX; const sy = (dx + dy) * isoScaleY; const angle = Math.atan2(sy, sx); const octant = (Math.round(angle / (Math.PI / 4)) + 8) % 8; return ['RIGHT', 'DOWN-RIGHT', 'DOWN', 'DOWN-LEFT', 'LEFT', 'UP-LEFT', 'UP', 'UP-RIGHT'][octant]; }";
    source = replaceOnce(source, anchor, anchor + '\n' + helper, 'screen direction helper');
  }
  const derived = [
    '  const weapon = getWeaponConfig(stateRef.current, hud.weapon);',
    '  const abilityConfigs = abilityMeta.map((_, index) => getAbilityConfig(stateRef.current, index));',
    '  const abilityReady = hud.ability.map(value => value <= 0);',
    '  const dodgeReady = hud.dodge <= 0;',
    '  const consumableReady = hud.consumableCooldown <= 0 && !hud.dead;',
    "  const statusItems = [hud.vacuumExposure > 0.5 ? 'VACUUM EXPOSURE' : '', hud.disrupted > 0 ? 'ELECTRONIC DISRUPTION' : '', hud.heat >= 0.98 ? 'OVERHEAT' : ''].filter(Boolean);",
    "  const currentOptionalRecovered = activeMission.megastructure && stateRef.current.objects.some(object => object.id === 'mega-optional-cache' && object.exposed) ? 1 : 0;",
    '  const salvageTags = expeditionTagsRef.current + hud.kills + currentOptionalRecovered * 2 + (hud.complete ? 3 : 0);',
    '  const objectiveStatus = getMissionObjectiveStatus(stateRef.current, activeMission);',
    '  const objectiveTarget = getNextMissionObjectiveTarget(stateRef.current, activeMission);',
    '  const routeNeeded = !!objectiveTarget && hud.squadRemaining === 0 && !hud.bossActive && !objectiveStatus.complete;',
    '  const objectiveRoute = routeNeeded && objectiveTarget ? findNavigationPath(stateRef.current, objectiveTarget) : null;',
    '  const objectiveWaypoint = objectiveRoute?.complete && objectiveRoute.points.length > 1 ? objectiveRoute.points[1] : objectiveTarget ? { x: objectiveTarget.x + objectiveTarget.w / 2, y: objectiveTarget.y + objectiveTarget.h / 2 } : null;',
    '  const objectiveDelta = objectiveWaypoint ? { x: objectiveWaypoint.x - stateRef.current.player.x, y: objectiveWaypoint.y - stateRef.current.player.y } : null;',
    '  const objectiveRange = objectiveRoute?.complete ? Math.round(objectiveRoute.points.slice(1).reduce((total, routePoint, index) => { const previous = objectiveRoute.points[index]; return total + Math.hypot(routePoint.x - previous.x, routePoint.y - previous.y); }, 0)) : objectiveTarget ? Math.round(Math.hypot(objectiveTarget.x + objectiveTarget.w / 2 - stateRef.current.player.x, objectiveTarget.y + objectiveTarget.h / 2 - stateRef.current.player.y)) : 0;',
    "  const objectiveDirection = objectiveDelta ? objectiveScreenDirection(objectiveDelta.x, objectiveDelta.y) : '';",
    "  const objectiveRouteMode = objectiveRoute?.complete ? 'ROUTE' : 'DIRECT';",
    '  const extractionReady = hud.extractionReady && objectiveStatus.complete;',
    '  const postClearObjective = hud.squadRemaining === 0 && !hud.bossActive && !objectiveStatus.complete;',
    "  const remainingHostiles = stateRef.current.enemies.filter(enemy => enemy.role !== 'boss' && enemy.active && !enemy.dead).sort((a, b) => Math.hypot(a.x - stateRef.current.player.x, a.y - stateRef.current.player.y) - Math.hypot(b.x - stateRef.current.player.x, b.y - stateRef.current.player.y));",
    '  const nearestHostile = remainingHostiles[0] ?? null;',
    '  const nearestHostileRange = nearestHostile ? Math.round(Math.hypot(nearestHostile.x - stateRef.current.player.x, nearestHostile.y - stateRef.current.player.y)) : 0;',
    '  const lockedHostile = mobileTargetRef.current == null ? null : stateRef.current.enemies.find(enemy => enemy.id === mobileTargetRef.current && enemy.active && !enemy.dead) ?? null;',
    '  const focusEnemy = hud.bossActive ? null : (lockedHostile ?? nearestHostile);',
    '  const nearbyLoot = stateRef.current.groundLoot.filter(drop => drop.active && !drop.collected).sort((a, b) => Math.hypot(a.x - stateRef.current.player.x, a.y - stateRef.current.player.y) - Math.hypot(b.x - stateRef.current.player.x, b.y - stateRef.current.player.y))[0] ?? null;',
    '  const extractionSweepActive = objectiveStatus.complete && hud.squadRemaining > 0 && !hud.bossActive;',
    '  const hostileRoute = extractionSweepActive && nearestHostile ? findNavigationPath(stateRef.current, { x: nearestHostile.x, y: nearestHostile.y }) : null;',
    '  const hostileWaypoint = hostileRoute?.complete && hostileRoute.points.length > 1 ? hostileRoute.points[1] : nearestHostile ? { x: nearestHostile.x, y: nearestHostile.y } : null;',
    '  const hostileDelta = hostileWaypoint ? { x: hostileWaypoint.x - stateRef.current.player.x, y: hostileWaypoint.y - stateRef.current.player.y } : null;',
    '  const hostileRange = hostileRoute?.complete ? Math.round(hostileRoute.points.slice(1).reduce((total, routePoint, index) => { const previous = hostileRoute.points[index]; return total + Math.hypot(routePoint.x - previous.x, routePoint.y - previous.y); }, 0)) : nearestHostileRange;',
    "  const hostileDirection = hostileDelta ? objectiveScreenDirection(hostileDelta.x, hostileDelta.y) : '';",
    "  const hostileRouteMode = hostileRoute?.complete ? 'ROUTE' : 'DIRECT';",
    '  const mandatoryFinale = !!(mission.storyFinale || mission.campaignFinale || mission.escalationFinale);',
    '  const isMegastructure = !!mission.megastructure;',
    '  const megastructureStageCount = mission.megastructureStageCount ?? 4;',
    '  const finalMegastructureStage = isMegastructure && expeditionStageRef.current + 1 >= megastructureStageCount;',
    '  const megastructureHasBoss = !!mission.megastructureBossTarget;',
    '  const expeditionProgress: ExpeditionProgress = { zonesCompleted: expeditionStageRef.current + 1, optionalRecovered: expeditionOptionalRef.current + currentOptionalRecovered };',
    ''
  ].join('\n');
  source = replaceSection(source, '  const weapon = getWeaponConfig', '  return <div className="game-root"', derived, 'combat derived HUD state');
  const oldObjectiveHud = "{postClearObjective && !hud.dead && <div className=\"post-clear-objective\" role=\"status\"><small>HOSTILES CLEARED // CONTRACT NOT COMPLETE</small><b>{objectiveStatus.detail}</b><span>{objectiveTarget ? `NEXT ACT // ${objectiveTarget.label.toUpperCase()}` : 'SYSTEM RECOVERY IN PROGRESS // HOLD THE ZONE'}</span></div>}";
  const newObjectiveHud = "{postClearObjective && !hud.dead && <div className=\"post-clear-objective\" role=\"status\"><small>HOSTILES CLEARED // CONTRACT NOT COMPLETE</small><b>{objectiveStatus.detail}</b><span>{objectiveTarget ? `NEXT ACT // ${objectiveTarget.label.toUpperCase()} // ${objectiveRouteMode} ${objectiveDirection} // RANGE ${objectiveRange}` : 'SYSTEM RECOVERY IN PROGRESS // HOLD THE ZONE'}</span></div>}";
  source = replaceOnce(source, oldObjectiveHud, newObjectiveHud, 'objective route HUD');
  const oldSweepHud = "{extractionSweepActive && !hud.dead && <div className=\"post-clear-objective\" role=\"status\"><small>PRIMARY OBJECTIVE SECURED // EXTRACTION SWEEP</small><b>{hud.squadRemaining} hostile{hud.squadRemaining === 1 ? '' : 's'} remain</b><span>{nearestHostile ? `NEAREST // ${nearestHostile.label.toUpperCase()} // RANGE ${nearestHostileRange}` : 'TACTICAL TRACKER ACQUIRING LAST CONTACT'}</span></div>}";
  const newSweepHud = "{extractionSweepActive && !hud.dead && <div className=\"post-clear-objective\" role=\"status\"><small>PRIMARY OBJECTIVE SECURED // EXTRACTION SWEEP</small><b>{hud.squadRemaining} hostile{hud.squadRemaining === 1 ? '' : 's'} remain</b><span>{nearestHostile ? `NEAREST // ${nearestHostile.label.toUpperCase()} // ${hostileRouteMode} ${hostileDirection} // RANGE ${hostileRange}` : 'TACTICAL TRACKER ACQUIRING LAST CONTACT'}</span></div>}";
  source = replaceOnce(source, oldSweepHud, newSweepHud, 'hostile route HUD');
  write(path, source);
}

// Surface Monster Level and level-gap guidance before deployment without blocking player choice.
{
  const path = 'src/components/ShipHub.tsx';
  let source = read(path);
  if (!source.includes('function contractReadiness')) {
    const endOfOutcome = "function runOutcomeLabel(run: { outcome?: string; depth?: string }) {\n  const value = run.outcome ?? run.depth ?? 'safe';\n  return value === 'failed' ? 'FAILED' : value === 'deep' ? 'DEEP' : 'SAFE';\n}\n";
    const helper = [
      '',
      "type ContractReadinessTone = 'matched' | 'elevated' | 'high-gap' | 'lower';",
      'function contractReadiness(contract: Contract, operatorLevel: number): { tone: ContractReadinessTone; label: string } {',
      '  const monsterLevel = contract.monsterLevel ?? 1;',
      '  const delta = monsterLevel - operatorLevel;',
      "  if (delta >= 4) return { tone: 'high-gap', label: 'HIGH LEVEL GAP // +' + delta };",
      "  if (delta >= 2) return { tone: 'elevated', label: 'ELEVATED // +' + delta + ' LEVELS' };",
      "  if (delta <= -3) return { tone: 'lower', label: 'LOWER THREAT // ' + Math.abs(delta) + ' BELOW' };",
      "  return { tone: 'matched', label: 'LEVEL-APPROPRIATE' };",
      '}',
      ''
    ].join('\n');
    source = replaceOnce(source, endOfOutcome, endOfOutcome + helper, 'contract readiness helper');
  }
  const oldChips = '<div className="condition-chips"><span>OP T{contract.operationTier ?? 1}</span><span>ER {contract.encounterRating ?? 15}</span>{contract.conditionLabels.map(condition => <span key={condition}>{condition}</span>)}</div>';
  const newChips = '<div className="condition-chips"><span>OP T{contract.operationTier ?? 1}</span><span>ML {contract.monsterLevel ?? 1}</span><span>ER {contract.encounterRating ?? 15}</span><span className={`readiness-chip ${contractReadiness(contract, profile.level).tone}`}>{contractReadiness(contract, profile.level).label}</span>{contract.conditionLabels.map(condition => <span key={condition}>{condition}</span>)}</div>';
  source = replaceOnce(source, oldChips, newChips, 'contract card monster level');
  const oldBrief = '<h3>{selected.locationName}</h3><p>{selected.briefing}</p>';
  const newBrief = '<h3>{selected.locationName}</h3><p>{selected.briefing}</p><div className={`contract-readiness ${contractReadiness(selected, profile.level).tone}`}><small>OPERATOR READINESS</small><b>LV {profile.level} // ML {selected.monsterLevel ?? 1}</b><span>{contractReadiness(selected, profile.level).label}</span></div>';
  source = replaceOnce(source, oldBrief, newBrief, 'selected contract readiness');
  write(path, source);
}

{
  const path = 'src/commandHub.css';
  let source = read(path);
  if (!source.includes('PLAYTEST READINESS VISIBILITY')) {
    source += [
      '',
      '/* PLAYTEST READINESS VISIBILITY */',
      '.readiness-chip { font-weight:900; letter-spacing:.05em; }',
      '.readiness-chip.matched,.contract-readiness.matched { border-color:#45695f; color:#a9c8bd; }',
      '.readiness-chip.elevated,.contract-readiness.elevated { border-color:#8b7543; color:#dbc789; }',
      '.readiness-chip.high-gap,.contract-readiness.high-gap { border-color:#8b4f49; color:#e4a49b; }',
      '.readiness-chip.lower,.contract-readiness.lower { border-color:#405962; color:#96b9c7; }',
      '.contract-readiness { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:8px; margin:10px 0; padding:9px 10px; border:1px solid #314740; border-radius:9px; background:#091310; }',
      '.contract-readiness small { color:#738a82; font-size:7px; font-weight:900; letter-spacing:.11em; }',
      '.contract-readiness b { color:#d3ded9; font-size:10px; }',
      '.contract-readiness span { justify-self:end; font-size:8px; font-weight:900; letter-spacing:.04em; }',
      '@media (orientation:landscape) and (max-height:650px) { .contract-readiness { margin:6px 0; padding:6px 8px; } }',
      ''
    ].join('\n');
    write(path, source);
  }
}

// Scaling regression coverage.
{
  const path = 'tests/loot-difficulty.ts';
  let source = read(path);
  source = replaceOnce(source, "import { applyThreatBudget, operationScalingFor } from '../src/game/scaling';", "import { applyThreatBudget, operationScalingFor, standardTierCapForOperator } from '../src/game/scaling';", 'scaling test import');
  const anchor = "assert(high.operationRewardMultiplier > low.operationRewardMultiplier, 'higher tier should reward more materials');\n";
  const addition = [
    '',
    'const cautiousCampaign = { ...campaign, contractsCompleted: 30, reputation: { meridian: 12, heliostat: 12, longarc: 12 } };',
    'const cautiousContract = generateContracts(cautiousCampaign)[0];',
    'const cautious = operationScalingFor(cautiousContract, cautiousCampaign, 11);',
    "assert(cautious.operationTier <= standardTierCapForOperator(11), 'standard board exceeded LV11 tier cap');",
    "assert(cautious.monsterLevel <= 13, 'standard board should stay within +2 monster levels at LV11');",
    'const explicitHardMode = operationScalingFor({ ...base, directiveTier: 12 }, cautiousCampaign, 11);',
    "assert(explicitHardMode.operationTier === 12 && explicitHardMode.monsterLevel === 20, 'explicit Directive tiers must remain uncapped by standard-board safety.');",
    ''
  ].join('\n');
  source = replaceOnce(source, anchor, anchor + addition, 'standard tier cap regressions');
  write(path, source);
}

// Pathfinding regression coverage for moving hostile targets.
{
  const path = 'tests/map-navigation.ts';
  let source = read(path);
  const start = '  for (const objective of objectives) {';
  const end = '  lowestReachableRatio = Math.min(lowestReachableRatio, audit.reachableRatio);';
  const replacement = [
    '  for (const objective of objectives) {',
    '    const path = findNavigationPath(state, objective);',
    "    if (!path.complete || path.points.length < 2) throw new Error(location + ': no obstacle-aware route to ' + objective.id);",
    '  }',
    "  const hostile = state.enemies.find(enemy => enemy.role !== 'boss' && enemy.active && !enemy.dead);",
    '  if (hostile) {',
    '    const hostilePath = findNavigationPath(state, { x: hostile.x, y: hostile.y });',
    "    if (!hostilePath.complete || hostilePath.points.length < 2) throw new Error(location + ': no obstacle-aware route to active hostile');",
    '  }',
    ''
  ].join('\n');
  source = replaceSection(source, start, end, replacement, 'hostile point routing regression');
  write(path, source);
}

// UI regression checks.
{
  const path = 'tests/ui-readability.ts';
  let source = read(path);
  const anchor = "assert(combat.includes('mission-build-label') && !combat.includes('objectiveStatus.detail : hud.squadRemaining'), 'Combat mission card still duplicates objective guidance.');\n";
  const addition = [
    "assert(combat.includes('hostileRouteMode') && combat.includes('objectiveRouteMode'), 'Combat cleanup guidance is missing obstacle-aware route state.');",
    "assert(shipHub.includes('OPERATOR READINESS') && shipHub.includes('readiness-chip'), 'Contract board is missing visible operator/monster readiness guidance.');",
    "assert(hubCss.includes('PLAYTEST READINESS VISIBILITY') && hubCss.includes('.contract-readiness.high-gap'), 'Contract readiness styling is missing.');",
    ''
  ].join('\n');
  source = replaceOnce(source, anchor, anchor + addition, 'UI playtest regressions');
  write(path, source);
}

console.log('PLAYTEST_RECOMMENDATIONS_PATCHED_V2');
