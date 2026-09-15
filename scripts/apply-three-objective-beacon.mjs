import fs from 'node:fs';

const file = 'src/game/threeCombatRenderer.ts';
let text = fs.readFileSync(file, 'utf8');

const replaceOnce = (from, to, label) => {
  if (text.includes(to)) return;
  if (!text.includes(from)) throw new Error(`Missing ${label} anchor`);
  text = text.replace(from, to);
};

replaceOnce(
  "import type { EquipmentFaction } from './factionGear';\n",
  "import type { EquipmentFaction } from './factionGear';\nimport { getNextMissionObjectiveTarget } from './encounters';\n",
  'import',
);

replaceOnce(
  '  private readonly dynamicRoot = new THREE.Group();\n',
  '  private readonly dynamicRoot = new THREE.Group();\n  private readonly objectiveBeacon = new THREE.Group();\n',
  'field',
);

replaceOnce(
  '    this.scene.add(this.environmentRoot, this.objectRoot, this.dynamicRoot, this.playerRoot);\n',
  '    this.scene.add(this.environmentRoot, this.objectRoot, this.dynamicRoot, this.playerRoot);\n    this.dynamicRoot.add(this.objectiveBeacon);\n',
  'constructor',
);

replaceOnce(
  '    this.syncObjects(state);\n    this.syncPlayer(state, operatorFaction);\n',
  '    this.syncObjects(state);\n    this.syncObjectiveBeacon(state, mission);\n    this.syncPlayer(state, operatorFaction);\n',
  'render',
);

const anchor = '  private syncPlayer(state: SimState, operatorFaction: EquipmentFaction | null) {\n';
const method = `  private syncObjectiveBeacon(state: SimState, mission: Contract) {
    const target = getNextMissionObjectiveTarget(state, mission);
    if (!target) {
      this.objectiveBeacon.visible = false;
      return;
    }

    if (this.objectiveBeacon.children.length === 0) {
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xc8e87f, transparent: true, opacity: 0.92, depthTest: false, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.065, 8, 48), markerMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.08;
      ring.renderOrder = 40;
      ring.name = 'objective-ring';

      const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), markerMaterial.clone());
      diamond.position.y = 1.75;
      diamond.renderOrder = 41;
      diamond.name = 'objective-diamond';

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 1.28, 6),
        new THREE.MeshBasicMaterial({ color: 0xc8e87f, transparent: true, opacity: 0.34, depthTest: false, depthWrite: false }),
      );
      beam.position.y = 1.05;
      beam.renderOrder = 39;
      beam.name = 'objective-beam';
      this.objectiveBeacon.add(ring, diamond, beam);
    }

    this.objectiveBeacon.visible = true;
    this.objectiveBeacon.position.set(scaled(target.x + target.w / 2), 0, scaled(target.y + target.h / 2));
    const pulse = 1 + Math.sin(state.time * 6.5) * 0.08;
    this.objectiveBeacon.scale.setScalar(pulse);
    const ring = this.objectiveBeacon.getObjectByName('objective-ring');
    const diamond = this.objectiveBeacon.getObjectByName('objective-diamond');
    if (ring) ring.rotation.z = state.time * 0.9;
    if (diamond) diamond.rotation.y = state.time * 1.8;
  }

`;
if (!text.includes('private syncObjectiveBeacon')) {
  if (!text.includes(anchor)) throw new Error('Missing method anchor');
  text = text.replace(anchor, method + anchor);
}

fs.writeFileSync(file, text);
console.log('Three.js objective beacon integrated.');
