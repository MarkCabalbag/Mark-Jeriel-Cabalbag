import * as THREE from 'three';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import type { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import type { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export interface Post {
  composer: EffectComposer;
  bokeh: BokehPass;
  bloom: UnrealBloomPass;
}

/** Desktop only. Lazy-loaded; any failure resolves to null and the page renders without post. */
export async function setupPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, w: number, h: number, dpr: number): Promise<Post | null> {
  try {
    const [{ EffectComposer }, { RenderPass }, { BokehPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
      import('three/examples/jsm/postprocessing/EffectComposer.js'),
      import('three/examples/jsm/postprocessing/RenderPass.js'),
      import('three/examples/jsm/postprocessing/BokehPass.js'),
      import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
      import('three/examples/jsm/postprocessing/OutputPass.js'),
    ]);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bokeh = new BokehPass(scene, camera as THREE.PerspectiveCamera, { focus: 6, aperture: 0.0005, maxblur: 0.007 });
    composer.addPass(bokeh);
    const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.14, 0.45, 0.93);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    return { composer, bokeh, bloom };
  } catch (e) {
    console.warn('Postprocessing unavailable, rendering without it.', e);
    return null;
  }
}

export function disposePost(post: Post | null) {
  if (!post) return;
  post.composer.passes.forEach((p) => (p as unknown as { dispose?: () => void }).dispose?.());
  post.composer.renderTarget1.dispose();
  post.composer.renderTarget2.dispose();
}
