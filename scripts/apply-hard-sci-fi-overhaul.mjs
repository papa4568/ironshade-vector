import fs from 'node:fs';

const rendererPath = 'src/game/threeCombatRenderer.ts';
const visualsPath = 'src/game/hardSciFiVisuals.ts';
let renderer = fs.readFileSync(rendererPath, 'utf8');
let visuals = fs.readFileSync(visualsPath, 'utf8');

function patch(source, find, replace, label) {
  if (!source.includes(find)) throw new Error(`Missing patch target: ${label}`);
  return source.replace(find, replace);
}

renderer = patch(
  renderer,
  "import { getWorldSize, type CombatObject, type Enemy, type Player, type SimState, type WeaponId } from './sim';",
  "import { getWorldSize, type CombatObject, type Enemy, type Player, type SimState, type WeaponId } from './sim';\nimport { buildHardSciFiEnvironment, decorateEnemy, decorateOperator, hardSciFiMuzzleOffset, syncEnemyVisual, syncHardSciFiBreaches, syncHardSciFiEnvironment, syncOperatorVisual } from './hardSciFiVisuals';",
  'hard sci-fi imports',
);

renderer = patch(
  renderer,
  '    this.playerRoot.add(this.playerBody);',
  '    this.playerRoot.add(this.playerBody);\n    decorateOperator(this.playerRoot);',
  'operator suit decoration',
);

renderer = patch(
  renderer,
  '    this.ensureEnvironment(state, mission);\n    this.syncSectors(state);',
  '    this.ensureEnvironment(state, mission);\n    syncHardSciFiEnvironment(this.environmentRoot, state, mission);\n    this.syncSectors(state);',
  'environment animation sync',
);

renderer = patch(
  renderer,
  '    this.syncBreaches(state);\n    this.syncDebris(state, quality);',
  '    this.syncBreaches(state);\n    syncHardSciFiBreaches(this.dynamicRoot, state, WORLD_SCALE);\n    this.syncDebris(state, quality);',
  'breach jets',
);

renderer = patch(
  renderer,
  '    this.addPerimeter(world.w, world.h, palette);\n    this.addLocationScenery(mission.location, world.w, world.h, palette);',
  '    this.addPerimeter(world.w, world.h, palette);\n    this.addLocationScenery(mission.location, world.w, world.h, palette);\n    buildHardSciFiEnvironment(this.environmentRoot, mission, scaled(world.w), scaled(world.h), palette);',
  'space environment kit',
);

renderer = patch(
  renderer,
  '    this.playerRoot.position.set(scaled(player.x), 0, scaled(player.y));\n    const suitColor = operatorFaction ? factionColors[operatorFaction] : 0x8aa89d;',
  '    this.playerRoot.position.set(scaled(player.x), 0, scaled(player.y));\n    syncOperatorVisual(this.playerRoot, this.weaponPivot, state, operatorFaction);\n    const suitColor = operatorFaction ? factionColors[operatorFaction] : 0x8aa89d;',
  'operator visual animation',
);

renderer = patch(
  renderer,
  '    this.muzzleFlash.visible = state.weaponFlash > 0;\n    const flashScale = 0.7 + Math.min(1.7, state.weaponFlash * 8);',
  '    this.muzzleFlash.visible = state.weaponFlash > 0;\n    this.muzzleFlash.position.x = hardSciFiMuzzleOffset(this.weaponPivot, 1.45);\n    const flashScale = 0.7 + Math.min(1.7, state.weaponFlash * 8);',
  'weapon muzzle alignment',
);

renderer = patch(
  renderer,
  '    head.castShadow = true;\n    root.add(head);\n\n    const targetRing',
  '    head.castShadow = true;\n    root.add(head);\n    decorateEnemy(root, enemy);\n\n    const targetRing',
  'enemy suit decoration',
);

renderer = patch(
  renderer,
  '      visual.root.position.set(scaled(enemy.x), 0, scaled(enemy.y));\n      if (enemy.dead) {',
  '      visual.root.position.set(scaled(enemy.x), 0, scaled(enemy.y));\n      syncEnemyVisual(visual.root, enemy, state);\n      if (enemy.dead) {',
  'enemy visual animation',
);

renderer = patch(
  renderer,
  "    const cameraHeight = narrow ? 18.5 : this.coarse ? 16.2 : 14.8;\n    const cameraOffset = narrow ? 13.5 : this.coarse ? 12.2 : 11.2;",
  "    const cameraHeight = narrow ? 18 : this.coarse ? 14.8 : 12.8;\n    const cameraOffset = narrow ? 13.2 : this.coarse ? 11.2 : 9.8;",
  'cinematic camera height',
);

renderer = patch(
  renderer,
  '    this.camera.lookAt(px, 0.4, pz);',
  '    this.camera.lookAt(px + state.player.aim.x * 1.1, 0.62, pz + state.player.aim.y * 1.1);',
  'camera aim lead',
);

visuals = patch(
  visuals,
  '  for (const detail of Object.values(details)) {\n    detail.root.visible = false;\n    pivot.add(detail.root);',
  '  for (const detail of Object.values(details)) {\n    detail.root.visible = false;\n    detail.root.position.y = 1.02;\n    pivot.add(detail.root);',
  'weapon vertical alignment',
);

visuals = patch(
  visuals,
  '  const gait = Math.sin(state.time * (8.5 + stride * 3)) * stride;\n\n  rig.shell.color.setHex',
  '  const gait = Math.sin(state.time * (8.5 + stride * 3)) * stride;\n  root.position.y = lowG ? 0.08 + Math.sin(state.time * 2.6) * 0.045 : 0;\n\n  rig.shell.color.setHex',
  'operator low-g drift',
);

visuals = patch(
  visuals,
  '  const gravity = sector?.gravity ?? 1;\n  const gait = Math.sin(state.time * 8 + enemy.id)',
  '  const gravity = sector?.gravity ?? 1;\n  root.position.y = gravity < 0.72 ? 0.04 + Math.sin(state.time * 2.2 + enemy.id) * 0.035 : 0;\n  const gait = Math.sin(state.time * 8 + enemy.id)',
  'enemy low-g drift',
);

fs.writeFileSync(rendererPath, renderer);
fs.writeFileSync(visualsPath, visuals);
console.log('Hard-sci-fi combat overhaul integrated.');
