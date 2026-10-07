import { readFile, writeFile } from 'node:fs/promises';

async function patchFile(path, transform) {
  const before = await readFile(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`${path}: P28-C8 patch made no changes`);
  await writeFile(path, after);
}

function replaceRequired(source, search, replacement, label) {
  if (!source.match(search)) throw new Error(`P28-C8 patch anchor missing: ${label}`);
  return source.replace(search, replacement);
}

await patchFile('src/game/babylonWorldPresentation.ts', source => {
  source = replaceRequired(
    source,
    "import { Mesh } from '@babylonjs/core/Meshes/mesh';",
    "import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';\nimport { Mesh } from '@babylonjs/core/Meshes/mesh';",
    'AbstractMesh import',
  );
  source = replaceRequired(
    source,
    "import { selectGraphicsAssetSpec } from './graphicsAssets';",
    "import { selectGraphicsAssetSpec } from './graphicsAssets';\nimport {\n  refineryWorldObjectAssetFamily,\n  refineryWorldObjectFamilyKey,\n  refineryWorldObjectFit,\n  type RefineryWorldObjectFamilyKey,\n} from './refineryWorldObjectAssets';",
    'refinery mapping imports',
  );
  source = replaceRequired(
    source,
    /type AuthoredInteractableVisual = \{\n  instance: BabylonGraphicsAssetInstance;\n  mount: TransformNode;\n  assetId: string;\n\};/,
    `type AuthoredInteractableVisual = {\n  instance: BabylonGraphicsAssetInstance;\n  mount: TransformNode;\n  assetId: string;\n};\n\ntype AuthoredWorldObjectVisual = {\n  instance: BabylonGraphicsAssetInstance;\n  mount: TransformNode;\n  assetId: string;\n  family: RefineryWorldObjectFamilyKey;\n};`,
    'authored world type',
  );
  source = replaceRequired(
    source,
    "  private readonly authoredInteractables = new Map<string, AuthoredInteractableVisual>();\n  private readonly interactableRequests = new Set<string>();",
    "  private readonly authoredInteractables = new Map<string, AuthoredInteractableVisual>();\n  private readonly interactableRequests = new Set<string>();\n  private readonly authoredWorldObjects = new Map<string, AuthoredWorldObjectVisual>();\n  private readonly refineryObjectRequests = new Map<string, string>();",
    'world object lifecycle members',
  );
  source = replaceRequired(
    source,
    "      && this.objectVisuals.size === 0\n      && this.authoredInteractables.size === 0\n      && this.loot.length === 0)",
    "      && this.objectVisuals.size === 0\n      && this.authoredInteractables.size === 0\n      && this.authoredWorldObjects.size === 0\n      && this.loot.length === 0)",
    'release early return',
  );
  source = replaceRequired(
    source,
    "    this.active = false;\n    this.loadGeneration += 1;\n\n    for (const visual of this.authoredInteractables.values()) {",
    "    this.active = false;\n    this.loadGeneration += 1;\n\n    for (const visual of this.authoredWorldObjects.values()) {\n      visual.instance.release();\n      visual.mount.dispose();\n    }\n    this.authoredWorldObjects.clear();\n    this.refineryObjectRequests.clear();\n\n    for (const visual of this.authoredInteractables.values()) {",
    'release authored world objects',
  );
  source = replaceRequired(
    source,
    "    this.canvas.dataset.babylonCoverPremiumCount = '0';\n    this.canvas.dataset.babylonCoverPremiumSurfaces = 'inactive';",
    "    this.canvas.dataset.babylonCoverPremiumCount = '0';\n    this.canvas.dataset.babylonCoverPremiumSurfaces = 'inactive';\n    this.canvas.dataset.refineryWorldVisual = 'released';\n    this.canvas.dataset.refineryWorldMappedCount = '0';\n    this.canvas.dataset.refineryWorldAuthoredCount = '0';\n    this.canvas.dataset.refineryWorldFallbackCount = '0';\n    this.canvas.dataset.refineryWorldAssets = '';",
    'release telemetry',
  );

  const replacement = `  private disposeObjectFallback(visual: WorldObjectVisual) {\n    visual.mesh.dispose();\n    visual.material.dispose();\n  }\n\n  private ensureObjectFallback(object: CombatObject, premiumCover: boolean) {\n    let visual = this.objectVisuals.get(object.id);\n    if (visual && visual.premiumCover !== premiumCover) {\n      this.disposeObjectFallback(visual);\n      this.objectVisuals.delete(object.id);\n      visual = undefined;\n    }\n    if (visual) return visual;\n\n    const height = panelObject(object) ? 0.7 : object.kind === 'cover' ? 1.25 : 1.05;\n    const material = new PBRMaterial('p27-b5-object-material-' + object.id, this.scene);\n    material.albedoColor = colorFromHex(objectColor(object));\n    material.metallic = 0.55;\n    material.roughness = 0.48;\n    const width = Math.max(0.15, scaled(object.w));\n    const depth = Math.max(0.15, scaled(object.h));\n    const mesh = MeshBuilder.CreateBox('p28-c8-fallback-object-' + object.id, { width, height, depth }, this.scene);\n    const premiumDetailMeshes: Mesh[] = [];\n    if (premiumCover && this.getPremiumSurfaceLibrary) {\n      const surfaces = this.getPremiumSurfaceLibrary();\n      mesh.material = surfaces.get('painted-metal');\n\n      const cap = MeshBuilder.CreateBox('p28-c8-fallback-cover-bare-cap-' + object.id, {\n        width: Math.max(0.12, width * 0.90),\n        height: 0.10,\n        depth: Math.max(0.12, depth * 0.90),\n      }, this.scene);\n      cap.parent = mesh;\n      cap.position.y = height * 0.5 - 0.05;\n      cap.material = surfaces.get('bare-metal');\n      cap.isPickable = false;\n      premiumDetailMeshes.push(cap);\n\n      const bumperDepth = Math.max(0.035, Math.min(0.07, depth * 0.08));\n      for (const side of [-1, 1]) {\n        const bumper = MeshBuilder.CreateBox('p28-c8-fallback-cover-polymer-' + (side > 0 ? 'front' : 'back') + '-' + object.id, {\n          width: Math.max(0.12, width * 0.76),\n          height: 0.18,\n          depth: bumperDepth,\n        }, this.scene);\n        bumper.parent = mesh;\n        bumper.position.set(0, -height * 0.22, side * (depth * 0.5 + bumperDepth * 0.18));\n        bumper.material = surfaces.get('polymer-rubber');\n        bumper.isPickable = false;\n        premiumDetailMeshes.push(bumper);\n      }\n    } else {\n      mesh.material = material;\n    }\n    mesh.isPickable = false;\n    visual = { mesh, material, height, premiumCover, premiumDetailMeshes };\n    this.objectVisuals.set(object.id, visual);\n    return visual;\n  }\n\n  private async loadRefineryWorldObject(object: CombatObject, detailScale: number) {\n    const family = refineryWorldObjectAssetFamily(object);\n    const familyKey = refineryWorldObjectFamilyKey(object);\n    const spec = selectGraphicsAssetSpec(family, detailScale);\n    if (!spec) {\n      this.ensureObjectFallback(object, object.kind === 'cover' && Boolean(this.getPremiumSurfaceLibrary));\n      this.canvas.dataset.refineryWorldFallbackReason = familyKey + ':spec-unavailable';\n      return;\n    }\n    const current = this.authoredWorldObjects.get(object.id);\n    if (current?.assetId === spec.id || this.refineryObjectRequests.get(object.id) === spec.id) return;\n\n    this.refineryObjectRequests.set(object.id, spec.id);\n    const generation = this.loadGeneration;\n    try {\n      const instance = await getBabylonGraphicsAssetRuntime(this.scene).instantiate(spec);\n      if (this.disposed\n        || !this.active\n        || generation !== this.loadGeneration\n        || this.refineryObjectRequests.get(object.id) !== spec.id) {\n        instance.release();\n        return;\n      }\n      const mount = new TransformNode('p28-c8-authored-world-object-' + object.id, this.scene);\n      mount.setEnabled(false);\n      instance.rootNodes.forEach(root => {\n        root.parent = mount;\n      });\n\n      const previous = this.authoredWorldObjects.get(object.id);\n      previous?.instance.release();\n      previous?.mount.dispose();\n      this.authoredWorldObjects.set(object.id, { instance, mount, assetId: spec.id, family: familyKey });\n      const fallback = this.objectVisuals.get(object.id);\n      if (fallback) {\n        this.disposeObjectFallback(fallback);\n        this.objectVisuals.delete(object.id);\n      }\n      delete this.canvas.dataset.refineryWorldFallbackReason;\n      this.canvas.dataset.refineryWorldVisual = 'authored-family-mapped';\n    } catch (error) {\n      if (this.disposed\n        || generation !== this.loadGeneration\n        || this.refineryObjectRequests.get(object.id) !== spec.id) return;\n      if (!this.authoredWorldObjects.has(object.id)) {\n        this.ensureObjectFallback(object, object.kind === 'cover' && Boolean(this.getPremiumSurfaceLibrary));\n      }\n      const message = error instanceof Error ? error.message : String(error);\n      this.canvas.dataset.refineryWorldFallbackReason = familyKey + ':' + message;\n      console.warn('Babylon authored refinery world object failed for ' + object.id + '; keeping deterministic fallback.', error);\n    }\n  }\n\n  private setAuthoredWorldVisibility(visual: AuthoredWorldObjectVisual, visibility: number) {\n    for (const root of visual.instance.rootNodes) {\n      if (root instanceof AbstractMesh) root.visibility = visibility;\n      for (const mesh of root.getChildMeshes(false)) mesh.visibility = visibility;\n    }\n  }\n\n  private syncObjects(state: SimState, detailScale: number) {\n    const refineryScenario = this.premiumRefineryScenario;\n    const quality = worldMaterialQualityProfile(worldQualityName(detailScale));\n    const activeIds = new Set<string>();\n    const activeAssets = new Set<string>();\n    let activeCount = 0;\n    let interactableCount = 0;\n    let premiumCoverCount = 0;\n    let mappedCount = 0;\n    let authoredCount = 0;\n    let fallbackCount = 0;\n\n    for (const object of state.objects) {\n      activeIds.add(object.id);\n      const mappedFamily = refineryScenario ? refineryWorldObjectFamilyKey(object) : null;\n      if (mappedFamily) {\n        if (object.active) mappedCount += 1;\n        void this.loadRefineryWorldObject(object, detailScale);\n      } else {\n        this.ensureObjectFallback(object, false);\n        if (panelObject(object)) void this.loadInteractable(object, detailScale);\n      }\n\n      if (object.active) activeCount += 1;\n      if (refineryScenario && object.kind === 'cover' && object.active) premiumCoverCount += 1;\n\n      const authoredWorld = mappedFamily ? this.authoredWorldObjects.get(object.id) : undefined;\n      const authoredInteractable = mappedFamily ? undefined : this.authoredInteractables.get(object.id);\n      const fallback = this.objectVisuals.get(object.id);\n      const coverVisibility = object.kind === 'cover'\n        && Math.hypot(object.x + object.w / 2 - state.player.x, object.y + object.h / 2 - state.player.y) < 155\n        ? 0.48\n        : 1;\n      const hpRatio = object.maxHp > 0 ? Math.max(0.18, Math.min(1, object.hp / object.maxHp)) : 1;\n      const durabilityScale = object.destructible && object.maxHp < 9000 ? 0.72 + hpRatio * 0.28 : 1;\n\n      if (fallback) {\n        const useFallback = object.active && !authoredWorld && !authoredInteractable;\n        fallback.mesh.setEnabled(useFallback);\n        fallback.mesh.position.set(scaled(object.x + object.w / 2), fallback.height / 2, scaled(object.y + object.h / 2));\n        fallback.mesh.visibility = coverVisibility;\n        for (const detail of fallback.premiumDetailMeshes) detail.visibility = coverVisibility;\n        if (!fallback.premiumCover) {\n          const response = materialWorldResponse(object.material);\n          fallback.material.albedoColor = colorFromHex(objectColor(object));\n          fallback.material.alpha = coverVisibility;\n          fallback.material.emissiveColor = object.exposed ? colorFromHex(0xd69b4d).scale(0.32) : Color3.Black();\n          fallback.material.metallic = lerp(0.32, response.metalness, quality.materialDepthScale);\n          fallback.material.roughness = lerp(0.62, response.roughness, quality.materialDepthScale);\n        }\n        fallback.mesh.scaling.y = durabilityScale;\n        if (useFallback) fallbackCount += 1;\n      }\n\n      if (authoredWorld) {\n        const fit = refineryWorldObjectFit(object, WORLD_SCALE);\n        authoredWorld.mount.setEnabled(object.active);\n        authoredWorld.mount.position.set(scaled(object.x + object.w / 2), 0, scaled(object.y + object.h / 2));\n        authoredWorld.mount.rotation.y = fit.rotationY;\n        authoredWorld.mount.scaling.set(fit.scaleX, fit.scaleY * durabilityScale, fit.scaleZ);\n        this.setAuthoredWorldVisibility(authoredWorld, coverVisibility);\n        if (object.active) {\n          authoredCount += 1;\n          activeAssets.add(authoredWorld.assetId);\n        }\n      }\n\n      const presentation = interactableWorldPresentation(object.kind);\n      const cue = this.ensureInteractableCue(object);\n      if (cue && presentation) {\n        if (object.active) interactableCount += 1;\n        const centerX = object.x + object.w / 2;\n        const centerY = object.y + object.h / 2;\n        const footprintScale = Math.max(0.68, Math.min(1.18, scaled(Math.max(object.w, object.h)) * 0.78));\n        const statusColor = object.exposed ? 0x8bd29a : presentation.color;\n        const pulse = 0.88 + Math.sin(state.time * presentation.pulseHz + centerX * 0.012) * 0.12 * quality.stateMotionScale;\n        cue.root.setEnabled(object.active);\n        cue.root.position.set(scaled(centerX), 0, scaled(centerY));\n        cue.ringMaterial.diffuseColor = colorFromHex(statusColor).scale(0.2);\n        cue.ringMaterial.emissiveColor = colorFromHex(statusColor);\n        cue.ringMaterial.alpha = (0.18 + (object.exposed ? 0.09 : 0.04)) * quality.interactableCueOpacity;\n        cue.ring.scaling.set(footprintScale * presentation.scaleX * pulse, 1, footprintScale * presentation.scaleZ * pulse);\n        cue.glyphMaterial.diffuseColor = colorFromHex(statusColor).scale(0.2);\n        cue.glyphMaterial.emissiveColor = colorFromHex(statusColor);\n        cue.glyphMaterial.alpha = quality.interactableCueOpacity;\n        const glyphScale = 0.86 + (object.exposed ? 0.08 : 0);\n        cue.glyph.scaling.set(glyphScale * presentation.scaleX, 1, glyphScale * presentation.scaleZ);\n        cue.glyph.rotation.y = (presentation.shape === 'diamond' ? Math.PI / 4 : 0)\n          + state.time * 0.22 * quality.stateMotionScale;\n      }\n\n      if (authoredInteractable) {\n        authoredInteractable.mount.setEnabled(object.active);\n        authoredInteractable.mount.position.set(scaled(object.x + object.w / 2), 0, scaled(object.y + object.h / 2));\n        const footprintScale = Math.max(0.72, Math.min(1.08, scaled(Math.max(object.w, object.h)) * 0.82));\n        const authoredScale = object.kind === 'salvageNode' ? Math.max(0.82, footprintScale) : footprintScale;\n        authoredInteractable.mount.scaling.set(authoredScale, authoredScale, authoredScale);\n      }\n    }\n\n    for (const [id, visual] of this.objectVisuals) if (!activeIds.has(id)) visual.mesh.setEnabled(false);\n    for (const [id, visual] of this.interactableCues) if (!activeIds.has(id)) visual.root.setEnabled(false);\n    for (const [id, visual] of this.authoredInteractables) if (!activeIds.has(id) || refineryScenario) visual.mount.setEnabled(false);\n    for (const [id, visual] of this.authoredWorldObjects) if (!activeIds.has(id) || !refineryScenario) visual.mount.setEnabled(false);\n\n    this.canvas.dataset.worldObjectCount = String(activeCount);\n    this.canvas.dataset.interactableActive = String(interactableCount);\n    this.canvas.dataset.interactableAuthoredCount = String(\n      [...this.authoredInteractables.values()].filter(visual => visual.mount.isEnabled()).length,\n    );\n    this.canvas.dataset.babylonCoverPremiumCount = String(premiumCoverCount);\n    this.canvas.dataset.babylonCoverPremiumSurfaces = refineryScenario && this.getPremiumSurfaceLibrary\n      ? 'painted-metal+bare-metal+polymer-rubber'\n      : 'inactive';\n    this.canvas.dataset.refineryWorldVisual = refineryScenario ? 'authored-family-mapped' : 'procedural-fallback-babylon';\n    this.canvas.dataset.refineryWorldMappedCount = String(mappedCount);\n    this.canvas.dataset.refineryWorldAuthoredCount = String(authoredCount);\n    this.canvas.dataset.refineryWorldFallbackCount = String(fallbackCount);\n    this.canvas.dataset.refineryWorldAssets = [...activeAssets].sort().join(',');\n    this.canvas.dataset.interactableReadability = 'shape-coded+state-emissive+floor-cue:quality-safe';\n  }`;

  source = replaceRequired(
    source,
    /  private syncObjects\(state: SimState, detailScale: number\) \{[\s\S]*?\n  \}\n\n  private ensureObjective\(\)/,
    `${replacement}\n\n  private ensureObjective()`,
    'syncObjects replacement',
  );
  return source;
});

await patchFile('scripts/verify-authored-refinery.mjs', source => {
  source = replaceRequired(
    source,
    "        coverPremiumCount: Number(canvas.dataset.babylonCoverPremiumCount ?? 0),",
    "        coverPremiumCount: Number(canvas.dataset.babylonCoverPremiumCount ?? 0),\n        refineryWorldVisual: canvas.dataset.refineryWorldVisual ?? '',\n        refineryWorldMappedCount: Number(canvas.dataset.refineryWorldMappedCount ?? 0),\n        refineryWorldAuthoredCount: Number(canvas.dataset.refineryWorldAuthoredCount ?? 0),\n        refineryWorldFallbackCount: Number(canvas.dataset.refineryWorldFallbackCount ?? 0),\n        refineryWorldAssets: canvas.dataset.refineryWorldAssets ?? '',",
    'verifier mapping telemetry',
  );
  source = replaceRequired(
    source,
    "      if (lastState.coverPremiumSurfaces !== 'painted-metal+bare-metal+polymer-rubber' || lastState.coverPremiumCount < 1) {\n        throw new Error(`P28-B3 premium refinery cover presentation is incomplete: ${JSON.stringify(lastState)}`);\n      }",
    "      if (lastState.coverPremiumSurfaces !== 'painted-metal+bare-metal+polymer-rubber' || lastState.coverPremiumCount < 1) {\n        throw new Error(`P28-B3 premium refinery cover presentation is incomplete: ${JSON.stringify(lastState)}`);\n      }\n      if (lastState.refineryWorldFallbackCount > 0) {\n        throw new Error(`P28-C8 mapped world-object coverage entered deterministic fallback: ${JSON.stringify(lastState)}`);\n      }\n      if (lastState.refineryWorldVisual !== 'authored-family-mapped'\n        || lastState.refineryWorldMappedCount < 1\n        || lastState.refineryWorldAuthoredCount !== lastState.refineryWorldMappedCount) {\n        await sleep(200);\n        continue;\n      }",
    'verifier authored mapping requirement',
  );
  source = replaceRequired(
    source,
    "cover=${lastState.coverPremiumCount}:${lastState.coverPremiumSurfaces} lighting=",
    "cover=${lastState.coverPremiumCount}:${lastState.coverPremiumSurfaces} world=${lastState.refineryWorldAuthoredCount}/${lastState.refineryWorldMappedCount}:fallback-${lastState.refineryWorldFallbackCount} assets=${lastState.refineryWorldAssets} lighting=",
    'verifier console telemetry',
  );
  return source;
});

await patchFile('scripts/p28a5-image-grade-capture.mjs', source => {
  source = replaceRequired(
    source,
    "// Historical proof markers retained for completed candidates: visualDetail: 'p28-c5-refinery-processor-lod0'; visualDetail: 'p28-c6-refinery-terminal-lod0'",
    "// Historical proof markers retained for completed candidates: visualDetail: 'p28-c5-refinery-processor-lod0'; visualDetail: 'p28-c6-refinery-terminal-lod0'; visualDetail: 'p28-c7-refinery-crate-lod0'",
    'image grade history',
  );
  source = replaceRequired(
    source,
    "    stack: canvas.dataset.babylonPostStack ?? '',",
    "    stack: canvas.dataset.babylonPostStack ?? '',\n    refineryWorldVisual: canvas.dataset.refineryWorldVisual ?? '',\n    refineryWorldMappedCount: Number(canvas.dataset.refineryWorldMappedCount ?? 0),\n    refineryWorldAuthoredCount: Number(canvas.dataset.refineryWorldAuthoredCount ?? 0),\n    refineryWorldFallbackCount: Number(canvas.dataset.refineryWorldFallbackCount ?? 0),",
    'image grade mapping telemetry',
  );
  source = replaceRequired(
    source,
    "  if (!normal || normal.tier !== 'high' || !normal.atmosphere.includes('exposure-1.055:contrast-0.985:grade-p28-a5-dark-separation-v1')) {",
    "  if (!normal\n    || normal.tier !== 'high'\n    || !normal.atmosphere.includes('exposure-1.055:contrast-0.985:grade-p28-a5-dark-separation-v1')\n    || normal.refineryWorldVisual !== 'authored-family-mapped'\n    || normal.refineryWorldMappedCount < 1\n    || normal.refineryWorldAuthoredCount !== normal.refineryWorldMappedCount\n    || normal.refineryWorldFallbackCount !== 0) {",
    'image grade mapping readiness',
  );
  source = replaceRequired(
    source,
    "    visualDetail: 'p28-c7-refinery-crate-lod0',",
    "    visualDetail: 'p28-c8-refinery-world-authored-mappings',",
    'image grade C8 tag',
  );
  source = replaceRequired(
    source,
    'detail=p28-c7-refinery-crate-lod0',
    'detail=p28-c8-refinery-world-authored-mappings',
    'image grade console C8 tag',
  );
  return source;
});

await patchFile('tests/refinery-machinery-premium-surfaces.mjs', source => {
  const anchor = "await import('./refinery-terminal-lod0.mjs');";
  if (!source.includes(anchor)) throw new Error('P28-C8 machinery test import anchor missing');
  return source.replace(anchor, `${anchor}\nawait import('./refinery-world-authored-mappings.mjs');`);
});

console.log('P28_C8_REFINERY_WORLD_PATCH_APPLIED');
