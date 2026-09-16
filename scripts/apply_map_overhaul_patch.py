from pathlib import Path
import json


def replace_once(path: str, old: str, new: str, label: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'{label}: anchor missing in {path}')
    p.write_text(text.replace(old, new, 1))

# Encounter geometry: protect the shared navigation lanes after every location and mission modifier is configured.
replace_once(
    'src/game/encounters.ts',
    "import type { CombatObject, SimState } from './sim';\n",
    "import type { CombatObject, SimState } from './sim';\nimport { reserveNavigationLanes } from './mapNavigation';\n",
    'encounters import',
)
replace_once(
    'src/game/encounters.ts',
    "  configureCampaignFinale(state, contract);\n  configureEscalationFinale(state, contract);\n}\n",
    "  configureCampaignFinale(state, contract);\n  configureEscalationFinale(state, contract);\n  reserveNavigationLanes(state, contract.location);\n}\n",
    'encounters navigation lanes',
)

# Build the richer environment in the same root as the existing hard-SF kit so it shares lifecycle/disposal.
replace_once(
    'src/game/hardSciFiVisuals.ts',
    "import type { Enemy, SimState, WeaponId } from './sim';\n",
    "import type { Enemy, SimState, WeaponId } from './sim';\nimport { buildMapVisualOverhaul, syncMapVisualOverhaul } from './mapVisuals';\n",
    'visual import',
)
replace_once(
    'src/game/hardSciFiVisuals.ts',
    "  addStationArchitecture(environment, mission.location, worldW, worldH, palette);\n  addLocationKit(environment, mission.location, worldW, worldH, palette);\n",
    "  addStationArchitecture(environment, mission.location, worldW, worldH, palette);\n  buildMapVisualOverhaul(environment, mission, worldW, worldH, palette);\n  addLocationKit(environment, mission.location, worldW, worldH, palette);\n",
    'visual build hook',
)
replace_once(
    'src/game/hardSciFiVisuals.ts',
    "  const environment = root.getObjectByName(ENV_KEY);\n  if (!environment) return;\n  const dust = environment.getObjectByName('hard-dust')",
    "  const environment = root.getObjectByName(ENV_KEY);\n  if (!environment) return;\n  syncMapVisualOverhaul(environment as THREE.Group, state);\n  const dust = environment.getObjectByName('hard-dust')",
    'visual sync hook',
)

# Renderer: obstacle footprint language, near-player occlusion fade, and obstacle-aware objective breadcrumbs.
replace_once(
    'src/game/threeCombatRenderer.ts',
    "import { getNextMissionObjectiveTarget } from './encounters';\n",
    "import { getNextMissionObjectiveTarget } from './encounters';\nimport { findNavigationPath } from './mapPathfinding';\n",
    'renderer path import',
)
replace_once(
    'src/game/threeCombatRenderer.ts',
    "  private readonly objectiveBeacon = new THREE.Group();\n  private readonly playerRoot = new THREE.Group();\n",
    "  private readonly objectiveBeacon = new THREE.Group();\n  private readonly objectiveGuide = new THREE.Group();\n  private readonly playerRoot = new THREE.Group();\n",
    'renderer guide group',
)
replace_once(
    'src/game/threeCombatRenderer.ts',
    "  private environmentSignature = '';\n  private width = 1;\n",
    "  private environmentSignature = '';\n  private objectiveGuideTargetId = '';\n  private objectiveGuideRefreshAt = -1;\n  private objectiveGuidePoints: Array<{ x: number; y: number }> = [];\n  private width = 1;\n",
    'renderer guide cache',
)
replace_once(
    'src/game/threeCombatRenderer.ts',
    "    this.scene.add(this.environmentRoot, this.objectRoot, this.dynamicRoot, this.playerRoot);\n    this.dynamicRoot.add(this.objectiveBeacon);\n",
    "    this.scene.add(this.environmentRoot, this.objectRoot, this.dynamicRoot, this.playerRoot);\n    this.dynamicRoot.add(this.objectiveBeacon, this.objectiveGuide);\n",
    'renderer guide attach',
)
old_create = """        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.objectRoot.add(mesh);
        this.objectVisuals.set(object.id, mesh);
"""
new_create = """        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const collidable = object.kind === 'cover' || object.kind === 'conduit' || object.kind === 'coolant' || object.kind === 'breachPlate' || object.kind === 'anchorNode';
        if (collidable) {
          const footprintColor = object.material === 'bulkhead' ? 0xd66f4f : object.material === 'system' ? 0x68aab1 : 0xd0a65d;
          const footprint = new THREE.Mesh(
            new THREE.BoxGeometry(Math.max(0.24, scaled(object.w) + 0.28), 0.035, Math.max(0.24, scaled(object.h) + 0.28)),
            new THREE.MeshBasicMaterial({ color: footprintColor, transparent: true, opacity: 0.34, depthWrite: false }),
          );
          footprint.name = 'navigation-footprint';
          footprint.position.y = -height / 2 + 0.035;
          mesh.add(footprint);
        }
        this.objectRoot.add(mesh);
        this.objectVisuals.set(object.id, mesh);
"""
replace_once('src/game/threeCombatRenderer.ts', old_create, new_create, 'renderer footprint')
old_object_sync = """      mesh.material.emissive.setHex(object.exposed ? 0xd69b4d : 0x000000);
      mesh.material.emissiveIntensity = object.exposed ? 0.32 : 0;
      const hpRatio = object.maxHp > 0 ? THREE.MathUtils.clamp(object.hp / object.maxHp, 0.18, 1) : 1;
      mesh.scale.y = object.destructible && object.maxHp < 9000 ? 0.72 + hpRatio * 0.28 : 1;
"""
new_object_sync = """      mesh.material.emissive.setHex(object.exposed ? 0xd69b4d : 0x000000);
      mesh.material.emissiveIntensity = object.exposed ? 0.32 : 0;
      const objectCenterX = object.x + object.w / 2;
      const objectCenterY = object.y + object.h / 2;
      const nearPlayer = Math.hypot(objectCenterX - state.player.x, objectCenterY - state.player.y) < 155;
      const tallOccluder = mesh.geometry.parameters.height >= 1.05 && object.kind === 'cover';
      mesh.material.transparent = nearPlayer && tallOccluder;
      mesh.material.opacity = nearPlayer && tallOccluder ? 0.48 : 1;
      const footprint = mesh.getObjectByName('navigation-footprint') as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial> | undefined;
      if (footprint) footprint.material.opacity = object.active ? (object.material === 'bulkhead' ? 0.48 : 0.3) : 0;
      const hpRatio = object.maxHp > 0 ? THREE.MathUtils.clamp(object.hp / object.maxHp, 0.18, 1) : 1;
      mesh.scale.y = object.destructible && object.maxHp < 9000 ? 0.72 + hpRatio * 0.28 : 1;
"""
replace_once('src/game/threeCombatRenderer.ts', old_object_sync, new_object_sync, 'renderer object clarity')
replace_once(
    'src/game/threeCombatRenderer.ts',
    "    if (!target) {\n      this.objectiveBeacon.visible = false;\n      return;\n    }\n",
    "    if (!target) {\n      this.objectiveBeacon.visible = false;\n      this.objectiveGuide.visible = false;\n      return;\n    }\n",
    'renderer guide hide',
)
replace_once(
    'src/game/threeCombatRenderer.ts',
    "    if (diamond) diamond.rotation.y = state.time * 1.8;\n  }\n\n  private syncPlayer",
    "    if (diamond) diamond.rotation.y = state.time * 1.8;\n    this.syncObjectiveGuide(state, target);\n  }\n\n  private syncObjectiveGuide(state: SimState, target: CombatObject) {\n    this.objectiveGuide.visible = true;\n    if (this.objectiveGuideTargetId !== target.id || state.time >= this.objectiveGuideRefreshAt) {\n      const result = findNavigationPath(state, target);\n      this.objectiveGuideTargetId = target.id;\n      this.objectiveGuideRefreshAt = state.time + 0.55;\n      const markers: Array<{ x: number; y: number }> = [];\n      for (let index = 0; index < result.points.length - 1; index += 1) {\n        const a = result.points[index];\n        const b = result.points[index + 1];\n        const distance = Math.hypot(b.x - a.x, b.y - a.y);\n        const count = Math.max(1, Math.floor(distance / 125));\n        for (let step = 1; step <= count; step += 1) {\n          const t = step / (count + 1);\n          markers.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });\n        }\n      }\n      this.objectiveGuidePoints = markers.slice(0, 28);\n    }\n    while (this.objectiveGuide.children.length < this.objectiveGuidePoints.length) {\n      const marker = new THREE.Mesh(\n        new THREE.BoxGeometry(0.28, 0.035, 0.28),\n        new THREE.MeshBasicMaterial({ color: 0xc8e87f, transparent: true, opacity: 0.72, depthWrite: false, depthTest: false }),\n      );\n      marker.rotation.y = Math.PI / 4;\n      marker.renderOrder = 38;\n      this.objectiveGuide.add(marker);\n    }\n    for (let index = 0; index < this.objectiveGuide.children.length; index += 1) {\n      const marker = this.objectiveGuide.children[index] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;\n      const point = this.objectiveGuidePoints[index];\n      marker.visible = !!point;\n      if (!point) continue;\n      marker.position.set(scaled(point.x), 0.075, scaled(point.y));\n      marker.material.opacity = 0.42 + Math.sin(state.time * 6.5 + index * 0.7) * 0.24;\n    }\n  }\n\n  private syncPlayer",
    'renderer objective path',
)

# Make the navigation audit part of every production build.
p = Path('package.json')
data = json.loads(p.read_text())
data['scripts']['test:maps'] = 'vite build --ssr tests/map-navigation.ts --outDir .map-dist && node .map-dist/map-navigation.js'
data['scripts']['build'] = 'npm run test:beta && npm run test:gameplay && npm run test:maps && vite build'
p.write_text(json.dumps(data, indent=2) + '\n')
