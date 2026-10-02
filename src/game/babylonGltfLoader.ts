import '@babylonjs/loaders/glTF/2.0/glTFLoader';

// Intentionally tiny dynamic-entry wrapper: Ironshade's authored GLBs currently
// require baseline glTF 2.0 only. Keep Babylon's optional extension registry out
// of production until an authored asset explicitly needs one.
export const BABYLON_GLTF_LOADER_READY = true;
