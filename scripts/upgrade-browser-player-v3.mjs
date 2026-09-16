import { readFileSync, writeFileSync } from 'node:fs';

const sourcePath = 'tests/e2e-level1-20-v2.mjs';
const targetPath = 'tests/e2e-level1-20-v3.mjs';
let source = readFileSync(sourcePath, 'utf8');

function replaceOnce(before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing ${label} anchor`);
  source = source.replace(before, after);
}

replaceOnce(
  "    const now = Date.now(), p = s.player;\n",
  "    const now = Date.now(), p = s.player;\n    const hostileDistance = s.hostile ? Math.hypot(s.hostile.x - p.x, s.hostile.y - p.y) : Infinity;\n    const objectiveDistance = s.objective ? Math.hypot(s.objective.x - p.x, s.objective.y - p.y) : Infinity;\n",
  'distance telemetry'
);

replaceOnce(
  "    if (p.weapon !== 'carbine') await page.keyboard.press('Digit1');\n",
  "    if (s.hostile?.armor > 0 && hostileDistance > 270 && p.weapon !== 'rail') await page.keyboard.press('Digit3');\n    else if (s.hostile && hostileDistance < 150 && p.weapon !== 'breacher') await page.keyboard.press('Digit2');\n    else if ((!s.hostile || s.hostile.armor <= 0 || hostileDistance <= 270) && hostileDistance >= 150 && p.weapon !== 'carbine') await page.keyboard.press('Digit1');\n",
  'weapon policy'
);

replaceOnce(
  "    if (s.hostile) {\n",
  `    const prioritizeObjective = !!s.objective && !s.objectiveStatus?.complete && !s.bossActive && (\n      !!s.contextLabel ||\n      objectiveDistance < 150 ||\n      (!s.objective.destructible && hostileDistance > 260) ||\n      (!s.objective.destructible && s.squadRemaining <= 4 && hostileDistance > 190)\n    );\n\n    if (prioritizeObjective) {\n      const waypoint = navWaypoint(s, s.objective);\n      const move = targetKeys(p, waypoint, 'objective', phase, s.objective);\n      await setKeys(move.keys);\n      await aimAt(p, s.hostile ?? s.objective);\n      const direct = clearSegment(p, s.objective, s.solids ?? [], 4);\n      if (s.objective.destructible && !s.objective.exposed && direct) {\n        if (!mouseDown) { await page.mouse.down(); mouseDown = true; }\n      } else if (s.hostile && clearSegment(p, s.hostile, s.solids ?? [], 4)) {\n        if (!mouseDown) { await page.mouse.down(); mouseDown = true; }\n      } else if (mouseDown) { await page.mouse.up(); mouseDown = false; }\n      if ((objectiveDistance < 150 || s.contextLabel) && now - lastInteractAt > 520) {\n        await page.keyboard.press('KeyX');\n        lastInteractAt = now;\n      }\n      if (hostileDistance < 300 && now - lastDodgeAt > 1350 && (p.dodgeCooldown ?? 1) <= 0) {\n        await page.keyboard.press('Space');\n        lastDodgeAt = now;\n      }\n    } else if (s.hostile) {\n`,
  'objective combat policy'
);

writeFileSync(targetPath, source);
console.log('BROWSER_PLAYER_V3_READY');
