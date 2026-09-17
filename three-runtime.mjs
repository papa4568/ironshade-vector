// Runtime-only Three.js facade for the combat renderer.
// Keep this list aligned with runtime THREE.* usage in threeCombatRenderer,
// hardSciFiVisuals, and mapVisuals. TypeScript continues to type-check against
// the official `three` package; Vite aliases only the production runtime import.

export { WebGLRenderer } from 'three/src/renderers/WebGLRenderer.js';

export { Scene } from 'three/src/scenes/Scene.js';
export { FogExp2 } from 'three/src/scenes/FogExp2.js';
export { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera.js';

export { Mesh } from 'three/src/objects/Mesh.js';
export { InstancedMesh } from 'three/src/objects/InstancedMesh.js';
export { Line } from 'three/src/objects/Line.js';
export { Points } from 'three/src/objects/Points.js';
export { Group } from 'three/src/objects/Group.js';

export { Object3D } from 'three/src/core/Object3D.js';
export { Raycaster } from 'three/src/core/Raycaster.js';
export { BufferGeometry } from 'three/src/core/BufferGeometry.js';
export { BufferAttribute } from 'three/src/core/BufferAttribute.js';

export { Plane } from 'three/src/math/Plane.js';
export { Vector2 } from 'three/src/math/Vector2.js';
export { Vector3 } from 'three/src/math/Vector3.js';
export { Color } from 'three/src/math/Color.js';
export { MathUtils } from 'three/src/math/MathUtils.js';

export { DirectionalLight } from 'three/src/lights/DirectionalLight.js';
export { PointLight } from 'three/src/lights/PointLight.js';
export { HemisphereLight } from 'three/src/lights/HemisphereLight.js';

export { MeshStandardMaterial } from 'three/src/materials/MeshStandardMaterial.js';
export { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial.js';
export { LineBasicMaterial } from 'three/src/materials/LineBasicMaterial.js';
export { PointsMaterial } from 'three/src/materials/PointsMaterial.js';

export { BoxGeometry } from 'three/src/geometries/BoxGeometry.js';
export { CylinderGeometry } from 'three/src/geometries/CylinderGeometry.js';
export { SphereGeometry } from 'three/src/geometries/SphereGeometry.js';
export { PlaneGeometry } from 'three/src/geometries/PlaneGeometry.js';
export { TorusGeometry } from 'three/src/geometries/TorusGeometry.js';
export { IcosahedronGeometry } from 'three/src/geometries/IcosahedronGeometry.js';
export { OctahedronGeometry } from 'three/src/geometries/OctahedronGeometry.js';
export { ConeGeometry } from 'three/src/geometries/ConeGeometry.js';
export { DodecahedronGeometry } from 'three/src/geometries/DodecahedronGeometry.js';

export { GridHelper } from 'three/src/helpers/GridHelper.js';
export { CanvasTexture } from 'three/src/textures/CanvasTexture.js';

export {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BackSide,
  DoubleSide,
  DynamicDrawUsage,
  PCFShadowMap,
  SRGBColorSpace,
} from 'three/src/constants.js';
