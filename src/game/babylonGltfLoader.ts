import '@babylonjs/loaders/glTF';

// Intentionally tiny dynamic-entry wrapper: Babylon's glTF plugin and its
// dependencies must stay behind the authored-asset request boundary.
export const BABYLON_GLTF_LOADER_READY = true;
