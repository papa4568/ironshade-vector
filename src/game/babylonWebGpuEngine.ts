export { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine.pure';

// Match Babylon 9.28.0's WebGPU engine runtime registrations while intentionally
// omitting @babylonjs/core/Audio/audioEngine. Ironshade owns audio separately and
// never asks Babylon to create or play sounds.
import '@babylonjs/core/ShadersWGSL/clearQuad.vertex';
import '@babylonjs/core/ShadersWGSL/clearQuad.fragment';
import '@babylonjs/core/Engines/WebGPU/webgpuShaderProcessorsWGSL';
import '@babylonjs/core/Buffers/buffer.align';
import '@babylonjs/core/Engines/AbstractEngine/abstractEngine.loadingScreen';
import '@babylonjs/core/Engines/AbstractEngine/abstractEngine.dom';
import '@babylonjs/core/Engines/AbstractEngine/abstractEngine.states';
import '@babylonjs/core/Engines/AbstractEngine/abstractEngine.stencil';
import '@babylonjs/core/Engines/AbstractEngine/abstractEngine.renderPass';
import '@babylonjs/core/Engines/AbstractEngine/abstractEngine.texture';
import '@babylonjs/core/Engines/AbstractEngine/abstractEngine.loadFile';
import '@babylonjs/core/Engines/AbstractEngine/abstractEngine.textureLoaders';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.alpha';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.alphaToCoverage';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.rawTexture';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.readTexture';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.cubeTexture';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.renderTarget';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.renderTargetTexture';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.renderTargetCube';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.query';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.dynamicTexture';

export const BABYLON_WEBGPU_AUDIO_POLICY = 'game-owned-audio' as const;
