import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/game/threeCombatRenderer.ts';
let source = readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one anchor, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  'render budget import',
  "import { lootColor } from './fieldLoot';\n",
  "import { lootColor } from './fieldLoot';\nimport { AdaptiveRenderBudget, type RenderBudgetSnapshot } from './renderQuality';\n",
);

replaceOnce(
  'unique resource disposal',
  `function disposeTree(root: THREE.Object3D) {\n  root.traverse(child => {\n    const mesh = child as THREE.Mesh;\n    if (mesh.geometry) mesh.geometry.dispose();\n    const material = mesh.material;\n    if (Array.isArray(material)) material.forEach(item => item.dispose());\n    else if (material) material.dispose();\n  });\n}\n`,
  `function disposeTree(root: THREE.Object3D) {\n  const geometries = new Set<THREE.BufferGeometry>();\n  const materials = new Set<THREE.Material>();\n  root.traverse(child => {\n    const mesh = child as THREE.Mesh;\n    if (mesh.geometry) geometries.add(mesh.geometry);\n    const material = mesh.material;\n    if (Array.isArray(material)) material.forEach(item => materials.add(item));\n    else if (material) materials.add(material);\n  });\n  geometries.forEach(geometry => geometry.dispose());\n  materials.forEach(material => material.dispose());\n}\n`,
);

replaceOnce(
  'renderer resource fields',
  `  private readonly groundLootPool: GroundLootVisual[] = [];\n  private readonly coarse: boolean;\n  private environmentSignature = '';\n`,
  `  private readonly groundLootPool: GroundLootVisual[] = [];\n  private readonly projectileCoreGeometry = new THREE.SphereGeometry(0.11, 8, 6);\n  private readonly projectileTrailGeometry = new THREE.BoxGeometry(0.62, 0.035, 0.035);\n  private readonly groundLootCoreGeometry = new THREE.OctahedronGeometry(0.22, 0);\n  private readonly groundLootRingGeometry = new THREE.TorusGeometry(0.48, 0.045, 6, 32);\n  private readonly groundLootBeamGeometry = new THREE.CylinderGeometry(0.018, 0.055, 1.7, 6);\n  private readonly effectRingGeometry = new THREE.TorusGeometry(1, 0.045, 6, 40);\n  private readonly debrisGeometry = new THREE.IcosahedronGeometry(0.12, 0);\n  private readonly objectiveGuideMesh = new THREE.InstancedMesh(\n    new THREE.BoxGeometry(0.28, 0.035, 0.28),\n    new THREE.MeshBasicMaterial({ color: 0xc8e87f, transparent: true, opacity: 0.62, depthWrite: false, depthTest: false }),\n    28,\n  );\n  private readonly objectiveGuideTransform = new THREE.Object3D();\n  private readonly renderBudget: AdaptiveRenderBudget;\n  private readonly coarse: boolean;\n  private environmentSignature = '';\n`,
);

replaceOnce(
  'frame timing field',
  `  private pixelRatio = 1;\n\n  constructor(canvas: HTMLCanvasElement, coarse: boolean) {\n    this.coarse = coarse;\n`,
  `  private pixelRatio = 1;\n  private lastFrameAt = 0;\n\n  constructor(canvas: HTMLCanvasElement, coarse: boolean) {\n    this.coarse = coarse;\n    this.renderBudget = new AdaptiveRenderBudget(coarse);\n`,
);

replaceOnce(
  'instanced objective guide setup',
  `    this.scene.add(this.environmentRoot, this.objectRoot, this.dynamicRoot, this.playerRoot);\n    this.dynamicRoot.add(this.objectiveBeacon, this.objectiveGuide);\n    this.scene.add(new THREE.HemisphereLight(0xa6c7c2, 0x14110e, 1.25));\n`,
  `    this.scene.add(this.environmentRoot, this.objectRoot, this.dynamicRoot, this.playerRoot);\n    this.dynamicRoot.add(this.objectiveBeacon, this.objectiveGuide);\n    this.objectiveGuideMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);\n    this.objectiveGuideMesh.count = 0;\n    this.objectiveGuideMesh.renderOrder = 38;\n    this.objectiveGuide.add(this.objectiveGuideMesh);\n    this.scene.add(new THREE.HemisphereLight(0xa6c7c2, 0x14110e, 1.25));\n`,
);

replaceOnce(
  'adaptive render sampling',
  `  render(state: SimState, width: number, height: number, quality: number, mission: Contract, mobileTargetId: number | null, operatorFaction: EquipmentFaction | null) {\n    this.resize(width, height, quality);\n`,
  `  render(state: SimState, width: number, height: number, quality: number, mission: Contract, mobileTargetId: number | null, operatorFaction: EquipmentFaction | null) {\n    const now = performance.now();\n    const frameMs = this.lastFrameAt > 0 ? now - this.lastFrameAt : 1000 / 60;\n    this.lastFrameAt = now;\n    const budget = this.renderBudget.sample(frameMs, quality);\n    this.resize(width, height, quality, budget);\n`,
);

replaceOnce(
  'adaptive debris detail',
  `    this.syncDebris(state, quality);\n`,
  `    this.syncDebris(state, quality * budget.detailScale);\n`,
);

replaceOnce(
  'adaptive resize',
  `  private resize(width: number, height: number, quality: number) {\n    const maxRatio = this.coarse || quality < 0.8 ? 1.35 : 1.8;\n    const nextRatio = Math.min(maxRatio, window.devicePixelRatio || 1);\n    if (Math.abs(nextRatio - this.pixelRatio) > 0.01) {\n      this.pixelRatio = nextRatio;\n      this.renderer.setPixelRatio(nextRatio);\n    }\n    if (width !== this.width || height !== this.height) {\n      this.width = Math.max(1, width);\n      this.height = Math.max(1, height);\n      this.renderer.setSize(this.width, this.height, false);\n      this.camera.aspect = this.width / this.height;\n      this.camera.updateProjectionMatrix();\n    }\n    this.keyLight.castShadow = quality > 0.62;\n  }\n`,
  `  private resize(width: number, height: number, quality: number, budget: RenderBudgetSnapshot) {\n    const qualityCap = quality < 0.55 ? 1.12 : this.coarse || quality < 0.8 ? 1.35 : 1.8;\n    const maxRatio = Math.max(0.76, qualityCap * budget.pixelRatioScale);\n    const nextRatio = Math.min(maxRatio, window.devicePixelRatio || 1);\n    if (Math.abs(nextRatio - this.pixelRatio) > 0.01) {\n      this.pixelRatio = nextRatio;\n      this.renderer.setPixelRatio(nextRatio);\n    }\n    if (width !== this.width || height !== this.height) {\n      this.width = Math.max(1, width);\n      this.height = Math.max(1, height);\n      this.renderer.setSize(this.width, this.height, false);\n      this.camera.aspect = this.width / this.height;\n      this.camera.updateProjectionMatrix();\n    }\n    this.keyLight.castShadow = budget.shadows;\n  }\n`,
);

replaceOnce(
  'shared perimeter resources',
  `    const walls = [\n      new THREE.Mesh(longWall, material.clone()),\n      new THREE.Mesh(longWall.clone(), material.clone()),\n      new THREE.Mesh(shortWall, material.clone()),\n      new THREE.Mesh(shortWall.clone(), material.clone()),\n    ];\n`,
  `    const walls = [\n      new THREE.Mesh(longWall, material),\n      new THREE.Mesh(longWall, material),\n      new THREE.Mesh(shortWall, material),\n      new THREE.Mesh(shortWall, material),\n    ];\n`,
);

const materialReuseReplacements = [
  ["new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material.clone())", "new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)"],
  ["new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 4.8, 16), structural.clone())", "new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 4.8, 16), structural)"],
  ["new THREE.Mesh(new THREE.TorusGeometry(radius, 0.16, 8, 64), emissive.clone())", "new THREE.Mesh(new THREE.TorusGeometry(radius, 0.16, 8, 64), emissive)"],
  ["new THREE.Mesh(new THREE.ConeGeometry(0.7 + (i % 3) * 0.3, 2.4 + (i % 4) * 0.8, 6), emissive.clone())", "new THREE.Mesh(new THREE.ConeGeometry(0.7 + (i % 3) * 0.3, 2.4 + (i % 4) * 0.8, 6), emissive)"],
  ["new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 2.2), emissive.clone())", "new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 2.2), emissive)"],
  ["new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.48, 12, 48), structural.clone())", "new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.48, 12, 48), structural)"],
  ["new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 4.2, 12), emissive.clone())", "new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 4.2, 12), emissive)"],
];
for (const [before, after] of materialReuseReplacements) replaceOnce(`material reuse ${before.slice(0, 36)}`, before, after);

replaceOnce(
  'instanced objective guide',
  `    while (this.objectiveGuide.children.length < this.objectiveGuidePoints.length) {\n      const marker = new THREE.Mesh(\n        new THREE.BoxGeometry(0.28, 0.035, 0.28),\n        new THREE.MeshBasicMaterial({ color: 0xc8e87f, transparent: true, opacity: 0.72, depthWrite: false, depthTest: false }),\n      );\n      marker.rotation.y = Math.PI / 4;\n      marker.renderOrder = 38;\n      this.objectiveGuide.add(marker);\n    }\n    for (let index = 0; index < this.objectiveGuide.children.length; index += 1) {\n      const marker = this.objectiveGuide.children[index] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;\n      const point = this.objectiveGuidePoints[index];\n      marker.visible = !!point;\n      if (!point) continue;\n      marker.position.set(scaled(point.x), 0.075, scaled(point.y));\n      marker.material.opacity = 0.42 + Math.sin(state.time * 6.5 + index * 0.7) * 0.24;\n    }\n`,
  `    this.objectiveGuideMesh.count = this.objectiveGuidePoints.length;\n    this.objectiveGuideMesh.material.opacity = 0.56 + Math.sin(state.time * 5.4) * 0.1;\n    for (let index = 0; index < this.objectiveGuidePoints.length; index += 1) {\n      const point = this.objectiveGuidePoints[index];\n      const pulse = 0.82 + Math.sin(state.time * 6.5 + index * 0.7) * 0.14;\n      this.objectiveGuideTransform.position.set(scaled(point.x), 0.075, scaled(point.y));\n      this.objectiveGuideTransform.rotation.set(0, Math.PI / 4, 0);\n      this.objectiveGuideTransform.scale.setScalar(pulse);\n      this.objectiveGuideTransform.updateMatrix();\n      this.objectiveGuideMesh.setMatrixAt(index, this.objectiveGuideTransform.matrix);\n    }\n    this.objectiveGuideMesh.instanceMatrix.needsUpdate = true;\n`,
);

replaceOnce(
  'shared projectile geometry',
  `      const core = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2, metalness: 0.15, roughness: 0.22 }));\n      const trail = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));\n`,
  `      const core = new THREE.Mesh(this.projectileCoreGeometry, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2, metalness: 0.15, roughness: 0.22 }));\n      const trail = new THREE.Mesh(this.projectileTrailGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));\n`,
);

replaceOnce(
  'shared ground loot geometry',
  `        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2, metalness: 0.35, roughness: 0.22 }));\n        core.position.y = 0.52;\n        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.045, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;\n        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.055, 1.7, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false })); beam.position.y = 0.9;\n`,
  `        const core = new THREE.Mesh(this.groundLootCoreGeometry, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2, metalness: 0.35, roughness: 0.22 }));\n        core.position.y = 0.52;\n        const ring = new THREE.Mesh(this.groundLootRingGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;\n        const beam = new THREE.Mesh(this.groundLootBeamGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false })); beam.position.y = 0.9;\n`,
);

replaceOnce(
  'shared ring geometry',
  `      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 6, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false }));\n`,
  `      const ring = new THREE.Mesh(this.effectRingGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false }));\n`,
);

replaceOnce(
  'shared debris geometry',
  `      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ color: 0x66736f, metalness: 0.72, roughness: 0.48 }));\n`,
  `      const mesh = new THREE.Mesh(this.debrisGeometry, new THREE.MeshStandardMaterial({ color: 0x66736f, metalness: 0.72, roughness: 0.48 }));\n`,
);

writeFileSync(path, source);
console.log('ADAPTIVE_RENDERER_PATCH_PASS');
