import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import {
  clampRefineryBloomCostScale,
  REFINERY_BLOOM_LAYER,
  REFINERY_BLOOM_PROFILE,
  refineryBloomResolutionScale,
  refineryBloomStrengthForCost,
} from './refineryBloomProfile';

export {
  clampRefineryBloomCostScale,
  isRefineryBloomAssetLabel,
  REFINERY_BLOOM_LAYER,
  REFINERY_BLOOM_PROFILE,
  refineryBloomResolutionScale,
  refineryBloomStrengthForCost,
} from './refineryBloomProfile';

const selectiveBloomMixShader = {
  uniforms: {
    baseTexture: { value: null as THREE.Texture | null },
    bloomTexture: { value: null as THREE.Texture | null },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D baseTexture;
    uniform sampler2D bloomTexture;
    varying vec2 vUv;
    void main() {
      gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);
    }
  `,
};

export class RefineryBloomPipeline {
  private readonly bloomComposer: EffectComposer;
  private readonly finalComposer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly mixPass: ShaderPass;
  private readonly outputPass: OutputPass;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private costScale = -1;

  constructor(
    renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
  ) {
    const bloomTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
    const bloomRenderPass = new RenderPass(scene, camera);
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      REFINERY_BLOOM_PROFILE.strength,
      REFINERY_BLOOM_PROFILE.radius,
      REFINERY_BLOOM_PROFILE.threshold,
    );
    this.bloomComposer = new EffectComposer(renderer, bloomTarget);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(bloomRenderPass);
    this.bloomComposer.addPass(this.bloomPass);

    this.mixPass = new ShaderPass(new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(selectiveBloomMixShader.uniforms),
      vertexShader: selectiveBloomMixShader.vertexShader,
      fragmentShader: selectiveBloomMixShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    }), 'baseTexture');
    this.mixPass.material.uniforms.bloomTexture.value = this.bloomComposer.renderTarget2.texture;
    this.outputPass = new OutputPass();

    const finalTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
    this.finalComposer = new EffectComposer(renderer, finalTarget);
    this.finalComposer.addPass(new RenderPass(scene, camera));
    this.finalComposer.addPass(this.mixPass);
    this.finalComposer.addPass(this.outputPass);
  }

  resize(width: number, height: number, pixelRatio: number, requestedCostScale: number) {
    const costScale = clampRefineryBloomCostScale(requestedCostScale);
    const nextWidth = Math.max(1, width);
    const nextHeight = Math.max(1, height);
    const nextPixelRatio = Math.max(0.5, pixelRatio);
    const sizeChanged = nextWidth !== this.width || nextHeight !== this.height || Math.abs(nextPixelRatio - this.pixelRatio) > 0.01;
    const costChanged = Math.abs(costScale - this.costScale) > 0.001;

    if (sizeChanged) {
      this.width = nextWidth;
      this.height = nextHeight;
      this.pixelRatio = nextPixelRatio;
      this.finalComposer.setPixelRatio(this.pixelRatio);
      this.finalComposer.setSize(this.width, this.height);
    }
    if (sizeChanged || costChanged) {
      this.costScale = costScale;
      this.bloomComposer.setPixelRatio(this.pixelRatio * Math.max(0.01, refineryBloomResolutionScale(costScale)));
      this.bloomComposer.setSize(this.width, this.height);
      this.bloomPass.strength = refineryBloomStrengthForCost(costScale);
      this.bloomPass.radius = REFINERY_BLOOM_PROFILE.radius;
      this.bloomPass.threshold = REFINERY_BLOOM_PROFILE.threshold;
    }
  }

  render() {
    const previousMask = this.camera.layers.mask;
    const previousBackground = this.scene.background;
    try {
      this.camera.layers.set(REFINERY_BLOOM_LAYER);
      this.scene.background = null;
      this.bloomComposer.render();
    } finally {
      this.camera.layers.mask = previousMask;
      this.scene.background = previousBackground;
    }
    this.finalComposer.render();
  }

  dispose() {
    this.bloomPass.dispose();
    this.mixPass.material.dispose();
    this.outputPass.dispose();
    this.bloomComposer.dispose();
    this.finalComposer.dispose();
  }
}
