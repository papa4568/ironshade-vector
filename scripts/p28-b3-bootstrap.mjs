import { readFile, writeFile } from 'node:fs/promises';

async function replaceOnce(path, before, after) {
  const source = await readFile(path, 'utf8');
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${path}: expected source block not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${path}: expected source block is not unique`);
  await writeFile(path, source.slice(0, first) + after + source.slice(first + before.length));
}

await replaceOnce(
  'scripts/prepare-refinery-premium-surfaces.mjs',
  `  { family: 'wallPanel', relativePath: 'environments/refinery-wall-service-panel-lod1.glb' },\n  { family: 'wallPanel', relativePath: 'environments/refinery-wall-service-panel-lod2.glb' },\n];`,
  `  { family: 'wallPanel', relativePath: 'environments/refinery-wall-service-panel-lod1.glb' },\n  { family: 'wallPanel', relativePath: 'environments/refinery-wall-service-panel-lod2.glb' },\n  { family: 'crate', relativePath: 'environments/refinery-crate-lod1.glb' },\n  { family: 'crate', relativePath: 'environments/refinery-crate-lod2.glb' },\n];`,
);

await replaceOnce(
  'src/game/babylonCombatRenderer.ts',
  `  wallPanel: {\n    'refinery-structural': 'bare-metal',\n    'refinery-shell': 'painted-metal',\n  },\n};\nconst REFINERY_PREMIUM_SURFACE_ORDER: readonly RefineryFamilyKey[] = ['floor', 'floorGrate', 'bulkhead', 'wallPanel'];\nconst REFINERY_PREMIUM_SURFACE_LABELS: Partial<Record<RefineryFamilyKey, string>> = {\n  floor: 'floor',\n  floorGrate: 'floor-grate',\n  bulkhead: 'bulkhead',\n  wallPanel: 'wall-panel',\n};\nconst REFINERY_PREMIUM_SURFACE_TELEMETRY = 'floor:bare-metal+deck-plate|floor-grate:bare-metal+painted-metal|bulkhead:painted-metal|wall-panel:bare-metal+painted-metal';`,
  `  wallPanel: {\n    'refinery-structural': 'bare-metal',\n    'refinery-shell': 'painted-metal',\n  },\n  crate: {\n    'refinery-structural': 'bare-metal',\n    'refinery-shell': 'painted-metal',\n    'refinery-hazard-emissive': 'polymer-rubber',\n  },\n};\nconst REFINERY_PREMIUM_SURFACE_ORDER: readonly RefineryFamilyKey[] = ['floor', 'floorGrate', 'bulkhead', 'wallPanel', 'crate'];\nconst REFINERY_PREMIUM_SURFACE_LABELS: Partial<Record<RefineryFamilyKey, string>> = {\n  floor: 'floor',\n  floorGrate: 'floor-grate',\n  bulkhead: 'bulkhead',\n  wallPanel: 'wall-panel',\n  crate: 'crate',\n};\nconst REFINERY_PREMIUM_SURFACE_TELEMETRY = 'floor:bare-metal+deck-plate|floor-grate:bare-metal+painted-metal|bulkhead:painted-metal|wall-panel:bare-metal+painted-metal|crate:bare-metal+painted-metal+polymer-rubber';`,
);

await replaceOnce(
  'src/game/babylonCombatRenderer.ts',
  `    this.worldPresentation = new BabylonRefineryWorldPresentation(scene, canvas, qualityCoarse);`,
  `    this.worldPresentation = new BabylonRefineryWorldPresentation(\n      scene,\n      canvas,\n      qualityCoarse,\n      () => this.getRefineryPremiumSurfaceLibrary(),\n    );`,
);

await replaceOnce(
  'src/game/babylonCombatRenderer.ts',
  `        throw new Error(\`Incomplete P28-B2 premium surface binding: \${premiumSurfaces || 'none'}\`);`,
  `        throw new Error(\`Incomplete P28-B2/B3 premium surface binding: \${premiumSurfaces || 'none'}\`);`,
);

await replaceOnce(
  'src/game/babylonWorldPresentation.ts',
  `import { selectGraphicsAssetSpec } from './graphicsAssets';\nimport { findNavigationPath } from './mapPathfinding';`,
  `import { selectGraphicsAssetSpec } from './graphicsAssets';\nimport type { BabylonPremiumPbrSurfaceLibrary } from './babylonPremiumPbrSurfaceLibrary';\nimport { findNavigationPath } from './mapPathfinding';`,
);

await replaceOnce(
  'src/game/babylonWorldPresentation.ts',
  `type WorldObjectVisual = {\n  mesh: Mesh;\n  material: PBRMaterial;\n  height: number;\n};`,
  `type WorldObjectVisual = {\n  mesh: Mesh;\n  material: PBRMaterial;\n  height: number;\n  premiumCover: boolean;\n  premiumDetailMeshes: Mesh[];\n};`,
);

await replaceOnce(
  'src/game/babylonWorldPresentation.ts',
  `  private readonly scene: Scene;\n  private readonly canvas: HTMLCanvasElement;\n  private readonly objectVisuals = new Map<string, WorldObjectVisual>();`,
  `  private readonly scene: Scene;\n  private readonly canvas: HTMLCanvasElement;\n  private readonly getPremiumSurfaceLibrary: (() => BabylonPremiumPbrSurfaceLibrary) | null;\n  private readonly objectVisuals = new Map<string, WorldObjectVisual>();`,
);

await replaceOnce(
  'src/game/babylonWorldPresentation.ts',
  `  constructor(scene: Scene, canvas: HTMLCanvasElement, _coarse: boolean) {\n    this.scene = scene;\n    this.canvas = canvas;`,
  `  constructor(\n    scene: Scene,\n    canvas: HTMLCanvasElement,\n    _coarse: boolean,\n    getPremiumSurfaceLibrary: (() => BabylonPremiumPbrSurfaceLibrary) | null = null,\n  ) {\n    this.scene = scene;\n    this.canvas = canvas;\n    this.getPremiumSurfaceLibrary = getPremiumSurfaceLibrary;`,
);

await replaceOnce(
  'src/game/babylonWorldPresentation.ts',
  `    this.syncObjects(state, detailScale);`,
  `    this.syncObjects(state, detailScale, mission.location === 'asteroid-refinery');`,
);

await replaceOnce(
  'src/game/babylonWorldPresentation.ts',
  `    this.canvas.dataset.breachActive = '0';\n    this.canvas.dataset.babylonWorldRelease = reason + ':deterministic';`,
  `    this.canvas.dataset.breachActive = '0';\n    this.canvas.dataset.babylonCoverPremiumCount = '0';\n    this.canvas.dataset.babylonCoverPremiumSurfaces = 'inactive';\n    this.canvas.dataset.babylonWorldRelease = reason + ':deterministic';`,
);

await replaceOnce(
  'src/game/babylonWorldPresentation.ts',
  `  private syncObjects(state: SimState, detailScale: number) {\n    const quality = worldMaterialQualityProfile(worldQualityName(detailScale));\n    const activeIds = new Set<string>();\n    let activeCount = 0;\n    let interactableCount = 0;`,
  `  private syncObjects(state: SimState, detailScale: number, refineryScenario: boolean) {\n    const quality = worldMaterialQualityProfile(worldQualityName(detailScale));\n    const activeIds = new Set<string>();\n    let activeCount = 0;\n    let interactableCount = 0;\n    let premiumCoverCount = 0;`,
);

await replaceOnce(
  'src/game/babylonWorldPresentation.ts',
  `      let visual = this.objectVisuals.get(object.id);\n      if (!visual) {\n        const height = panelObject(object) ? 0.7 : object.kind === 'cover' ? 1.25 : 1.05;\n        const material = new PBRMaterial('p27-b5-object-material-' + object.id, this.scene);\n        material.albedoColor = colorFromHex(objectColor(object));\n        material.metallic = 0.55;\n        material.roughness = 0.48;\n        const mesh = MeshBuilder.CreateBox('p27-b5-object-' + object.id, {\n          width: Math.max(0.15, scaled(object.w)),\n          height,\n          depth: Math.max(0.15, scaled(object.h)),\n        }, this.scene);\n        mesh.material = material;\n        mesh.isPickable = false;\n        visual = { mesh, material, height };\n        this.objectVisuals.set(object.id, visual);\n        if (panelObject(object)) void this.loadInteractable(object, detailScale);\n      }\n\n      if (object.active) activeCount += 1;\n      const authored = this.authoredInteractables.get(object.id);\n      visual.mesh.setEnabled(object.active && !authored);\n      visual.mesh.position.set(scaled(object.x + object.w / 2), visual.height / 2, scaled(object.y + object.h / 2));\n      const response = materialWorldResponse(object.material);\n      visual.material.albedoColor = colorFromHex(objectColor(object));\n      visual.material.alpha = object.kind === 'cover'\n        && Math.hypot(object.x + object.w / 2 - state.player.x, object.y + object.h / 2 - state.player.y) < 155\n        ? 0.48\n        : 1;\n      visual.material.emissiveColor = object.exposed ? colorFromHex(0xd69b4d).scale(0.32) : Color3.Black();\n      visual.material.metallic = lerp(0.32, response.metalness, quality.materialDepthScale);\n      visual.material.roughness = lerp(0.62, response.roughness, quality.materialDepthScale);`,
  `      const premiumCover = refineryScenario && object.kind === 'cover' && Boolean(this.getPremiumSurfaceLibrary);\n      let visual = this.objectVisuals.get(object.id);\n      if (visual && visual.premiumCover !== premiumCover) {\n        visual.mesh.dispose();\n        visual.material.dispose();\n        this.objectVisuals.delete(object.id);\n        visual = undefined;\n      }\n      if (!visual) {\n        const height = panelObject(object) ? 0.7 : object.kind === 'cover' ? 1.25 : 1.05;\n        const material = new PBRMaterial('p27-b5-object-material-' + object.id, this.scene);\n        material.albedoColor = colorFromHex(objectColor(object));\n        material.metallic = 0.55;\n        material.roughness = 0.48;\n        const width = Math.max(0.15, scaled(object.w));\n        const depth = Math.max(0.15, scaled(object.h));\n        const mesh = MeshBuilder.CreateBox('p27-b5-object-' + object.id, { width, height, depth }, this.scene);\n        const premiumDetailMeshes: Mesh[] = [];\n        if (premiumCover && this.getPremiumSurfaceLibrary) {\n          const surfaces = this.getPremiumSurfaceLibrary();\n          mesh.material = surfaces.get('painted-metal');\n\n          const cap = MeshBuilder.CreateBox('p28-b3-cover-bare-cap-' + object.id, {\n            width: Math.max(0.12, width * 0.90),\n            height: 0.10,\n            depth: Math.max(0.12, depth * 0.90),\n          }, this.scene);\n          cap.parent = mesh;\n          cap.position.y = height * 0.5 - 0.05;\n          cap.material = surfaces.get('bare-metal');\n          cap.isPickable = false;\n          premiumDetailMeshes.push(cap);\n\n          const bumperDepth = Math.max(0.035, Math.min(0.07, depth * 0.08));\n          for (const side of [-1, 1]) {\n            const bumper = MeshBuilder.CreateBox(`p28-b3-cover-polymer-\${side > 0 ? 'front' : 'back'}-\${object.id}`, {\n              width: Math.max(0.12, width * 0.76),\n              height: 0.18,\n              depth: bumperDepth,\n            }, this.scene);\n            bumper.parent = mesh;\n            bumper.position.set(0, -height * 0.22, side * (depth * 0.5 + bumperDepth * 0.18));\n            bumper.material = surfaces.get('polymer-rubber');\n            bumper.isPickable = false;\n            premiumDetailMeshes.push(bumper);\n          }\n        } else {\n          mesh.material = material;\n        }\n        mesh.isPickable = false;\n        visual = { mesh, material, height, premiumCover, premiumDetailMeshes };\n        this.objectVisuals.set(object.id, visual);\n        if (panelObject(object)) void this.loadInteractable(object, detailScale);\n      }\n\n      if (object.active) activeCount += 1;\n      if (visual.premiumCover && object.active) premiumCoverCount += 1;\n      const authored = this.authoredInteractables.get(object.id);\n      visual.mesh.setEnabled(object.active && !authored);\n      visual.mesh.position.set(scaled(object.x + object.w / 2), visual.height / 2, scaled(object.y + object.h / 2));\n      const response = materialWorldResponse(object.material);\n      const coverVisibility = object.kind === 'cover'\n        && Math.hypot(object.x + object.w / 2 - state.player.x, object.y + object.h / 2 - state.player.y) < 155\n        ? 0.48\n        : 1;\n      visual.mesh.visibility = coverVisibility;\n      for (const detail of visual.premiumDetailMeshes) detail.visibility = coverVisibility;\n      if (!visual.premiumCover) {\n        visual.material.albedoColor = colorFromHex(objectColor(object));\n        visual.material.alpha = coverVisibility;\n        visual.material.emissiveColor = object.exposed ? colorFromHex(0xd69b4d).scale(0.32) : Color3.Black();\n        visual.material.metallic = lerp(0.32, response.metalness, quality.materialDepthScale);\n        visual.material.roughness = lerp(0.62, response.roughness, quality.materialDepthScale);\n      }`,
);

await replaceOnce(
  'src/game/babylonWorldPresentation.ts',
  `    this.canvas.dataset.interactableAuthoredCount = String(\n      [...this.authoredInteractables.values()].filter(visual => visual.mount.isEnabled()).length,\n    );\n    this.canvas.dataset.interactableReadability = 'shape-coded+state-emissive+floor-cue:quality-safe';`,
  `    this.canvas.dataset.interactableAuthoredCount = String(\n      [...this.authoredInteractables.values()].filter(visual => visual.mount.isEnabled()).length,\n    );\n    this.canvas.dataset.babylonCoverPremiumCount = String(premiumCoverCount);\n    this.canvas.dataset.babylonCoverPremiumSurfaces = refineryScenario && this.getPremiumSurfaceLibrary\n      ? 'painted-metal+bare-metal+polymer-rubber'\n      : 'inactive';\n    this.canvas.dataset.interactableReadability = 'shape-coded+state-emissive+floor-cue:quality-safe';`,
);

await replaceOnce(
  'tests/refinery-premium-surfaces.mjs',
  `  wallPanel: 'refinery-wall-service-panel-shell',\n};\nconst expectedNodeTransforms = {`,
  `  wallPanel: 'refinery-wall-service-panel-shell',\n  crate: 'refinery-crate-shell',\n};\nconst expectedNodeTransforms = {`,
);

await replaceOnce(
  'tests/refinery-premium-surfaces.mjs',
  `  'refinery-wall-service-panel-shell': { translation: [0, 1.28, 0], scale: [0.18, 2.56, 2.75] },\n};`,
  `  'refinery-wall-service-panel-shell': { translation: [0, 1.28, 0], scale: [0.18, 2.56, 2.75] },\n  'refinery-crate-shell': { translation: [0, 0.42, 0], scale: [1.05, 0.84, 0.82] },\n};`,
);

await replaceOnce(
  'tests/refinery-premium-surfaces.mjs',
  `const expectedTelemetry = 'floor:bare-metal+deck-plate|floor-grate:bare-metal+painted-metal|bulkhead:painted-metal|wall-panel:bare-metal+painted-metal';`,
  `const expectedTelemetry = 'floor:bare-metal+deck-plate|floor-grate:bare-metal+painted-metal|bulkhead:painted-metal|wall-panel:bare-metal+painted-metal|crate:bare-metal+painted-metal+polymer-rubber';`,
);

await replaceOnce(
  'tests/refinery-premium-surfaces.mjs',
  `for (const surface of ['deck-plate', 'bare-metal', 'painted-metal']) {`,
  `for (const surface of ['deck-plate', 'bare-metal', 'painted-metal', 'polymer-rubber']) {`,
);

await replaceOnce(
  'scripts/verify-authored-refinery.mjs',
  `        premiumSurfaces: canvas.dataset.babylonEnvironmentPremiumSurfaces ?? '',\n        materialDetail: canvas.dataset.babylonEnvironmentMaterialDetail ?? '',`,
  `        premiumSurfaces: canvas.dataset.babylonEnvironmentPremiumSurfaces ?? '',\n        materialDetail: canvas.dataset.babylonEnvironmentMaterialDetail ?? '',\n        coverPremiumSurfaces: canvas.dataset.babylonCoverPremiumSurfaces ?? '',\n        coverPremiumCount: Number(canvas.dataset.babylonCoverPremiumCount ?? 0),`,
);

await replaceOnce(
  'scripts/verify-authored-refinery.mjs',
  `      if (lastState.premiumSurfaces !== 'floor:bare-metal+deck-plate|floor-grate:bare-metal+painted-metal|bulkhead:painted-metal|wall-panel:bare-metal+painted-metal'\n        || lastState.materialDetail !== 'normal+roughness+metalness:shared-premium-pbr') {\n        throw new Error(\`P28-B2 premium refinery surface binding is incomplete: \${JSON.stringify(lastState)}\`);\n      }`,
  `      if (lastState.premiumSurfaces !== 'floor:bare-metal+deck-plate|floor-grate:bare-metal+painted-metal|bulkhead:painted-metal|wall-panel:bare-metal+painted-metal|crate:bare-metal+painted-metal+polymer-rubber'\n        || lastState.materialDetail !== 'normal+roughness+metalness:shared-premium-pbr') {\n        throw new Error(\`P28-B2/B3 premium refinery surface binding is incomplete: \${JSON.stringify(lastState)}\`);\n      }\n      if (lastState.coverPremiumSurfaces !== 'painted-metal+bare-metal+polymer-rubber' || lastState.coverPremiumCount < 1) {\n        throw new Error(\`P28-B3 premium refinery cover presentation is incomplete: \${JSON.stringify(lastState)}\`);\n      }`,
);

await replaceOnce(
  'scripts/verify-authored-refinery.mjs',
  `premium=\${lastState.premiumSurfaces} lighting=`,
  `premium=\${lastState.premiumSurfaces} cover=\${lastState.coverPremiumCount}:\${lastState.coverPremiumSurfaces} lighting=`,
);

const b3Test = `import { readFile } from 'node:fs/promises';\nimport { resolve } from 'node:path';\nimport { REFINERY_PREMIUM_SURFACE_TARGETS, upgradeRefineryPremiumSurfaceGlb } from '../scripts/prepare-refinery-premium-surfaces.mjs';\n\nfunction assert(condition, message) {\n  if (!condition) throw new Error(message);\n}\n\nfunction parseGlb(buffer, label) {\n  assert(buffer.toString('ascii', 0, 4) === 'glTF', \\`\\${label}: invalid GLB magic\\`);\n  const jsonLength = buffer.readUInt32LE(12);\n  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim());\n}\n\nconst crateTargets = REFINERY_PREMIUM_SURFACE_TARGETS.filter(target => target.family === 'crate');\nassert(crateTargets.length === 2, \\`Expected two crate premium-surface targets, got \\${crateTargets.length}\\`);\nfor (const target of crateTargets) {\n  const path = resolve(process.cwd(), 'public/assets/models', target.relativePath);\n  const bytes = await readFile(path);\n  const gltf = parseGlb(bytes, target.relativePath);\n  assert(bytes.equals(upgradeRefineryPremiumSurfaceGlb(bytes, target)), \\`\\${target.relativePath}: upgrade is not deterministic/idempotent\\`);\n  assert(gltf.extras?.ironshadeP28B2SurfaceGeometry?.family === 'crate', \\`\\${target.relativePath}: premium geometry marker is missing\\`);\n  assert(gltf.extras?.ironshadeP28B2SurfaceGeometry?.gameplayBoundsChanged === false, \\`\\${target.relativePath}: gameplay bounds must remain unchanged\\`);\n  for (const mesh of gltf.meshes ?? []) {\n    for (const primitive of mesh.primitives ?? []) {\n      assert(primitive.attributes?.TANGENT === 2, \\`\\${target.relativePath}: TANGENT is missing\\`);\n      assert(primitive.attributes?.TEXCOORD_0 === 3, \\`\\${target.relativePath}: TEXCOORD_0 is missing\\`);\n    }\n  }\n  const shell = (gltf.nodes ?? []).find(node => node.name === 'refinery-crate-shell');\n  const band = (gltf.nodes ?? []).find(node => node.name === 'refinery-crate-band');\n  const marker = (gltf.nodes ?? []).find(node => node.name === 'refinery-crate-marker');\n  assert(JSON.stringify(shell?.scale) === JSON.stringify([1.05, 0.84, 0.82]), \\`\\${target.relativePath}: shell scale changed\\`);\n  assert(JSON.stringify(band?.scale) === JSON.stringify([0.12, 0.90, 0.90]), \\`\\${target.relativePath}: band scale changed\\`);\n  assert(marker?.mesh === 2, \\`\\${target.relativePath}: marker must retain the authored third material slot\\`);\n}\n\nconst renderer = await readFile(resolve(process.cwd(), 'src/game/babylonCombatRenderer.ts'), 'utf8');\nconst world = await readFile(resolve(process.cwd(), 'src/game/babylonWorldPresentation.ts'), 'utf8');\nconst verifier = await readFile(resolve(process.cwd(), 'scripts/verify-authored-refinery.mjs'), 'utf8');\nconst telemetry = 'crate:bare-metal+painted-metal+polymer-rubber';\nassert(renderer.includes(\\`'refinery-hazard-emissive': 'polymer-rubber'\\`), 'Crate marker slot is not bound to polymer/rubber');\nassert(renderer.includes(telemetry), 'Crate premium-surface telemetry is missing');\nfor (const surface of ['painted-metal', 'bare-metal', 'polymer-rubber']) {\n  assert(world.includes(\\`surfaces.get('\\${surface}')\\`), \\`Premium refinery cover does not use \\${surface}\\`);\n}\nassert(world.includes(\\`mission.location === 'asteroid-refinery'\\`), 'Premium cover treatment is not scoped to the refinery');\nassert(world.includes('coverVisibility'), 'Cover readability transparency contract was not preserved');\nassert(world.includes('Math.max(0.15, scaled(object.w))') && world.includes('Math.max(0.15, scaled(object.h))'), 'Cover simulation footprint sizing changed');\nassert(verifier.includes('canvas.dataset.babylonCoverPremiumSurfaces'), 'Live verifier does not inspect premium cover surfaces');\nassert(verifier.includes('lastState.coverPremiumCount < 1'), 'Live verifier does not require a rendered premium cover');\n\nconsole.log('REFINERY_COVER_CRATE_PREMIUM_SURFACES_PASS crate-lods=2 cover=painted-metal+bare-metal+polymer-rubber bounds=simulation-owned');\n`;
await writeFile('tests/refinery-cover-crate-premium-surfaces.mjs', b3Test);

await replaceOnce(
  'package.json',
  `\"test:graphics:content\": \"node tests/graphics-content-assets.mjs && node tests/premium-pbr-reference.mjs && node tests/premium-pbr-library.mjs && node tests/refinery-premium-surfaces.mjs\"`,
  `\"test:graphics:content\": \"node tests/graphics-content-assets.mjs && node tests/premium-pbr-reference.mjs && node tests/premium-pbr-library.mjs && node tests/refinery-premium-surfaces.mjs && node tests/refinery-cover-crate-premium-surfaces.mjs\"`,
);

console.log('P28_B3_BOOTSTRAP_APPLIED');
