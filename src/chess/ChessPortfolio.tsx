import { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import './styles/chess.css';
import { Acts } from './layers/Acts';
import { Chrome, Loader, Nav } from './layers/Chrome';
import { createEngine } from './engine/engine';
import { bus } from './engine/store';
import { CAMERA_FOV } from './data/shots';

/** Hands R3F's renderer, scene and camera to the engine once. R3F never renders (frameloop="never"). */
function Bridge({ root }: { root: React.RefObject<HTMLDivElement | null> }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const setDpr = useThree((s) => s.setDpr);
  const size = useThree((s) => s.size);
  useEffect(() => {
    const engine = createEngine({ gl, scene, camera, root: root.current!, setDpr });
    bus.engine = engine;
    if (bus.loaded) engine.ready(); // loader finished before the canvas mounted
    return () => {
      engine.destroy();
      bus.engine = null;
    };
  }, [gl, scene, camera, setDpr, root]);
  // R3F is the single resize owner; tell the engine when its size changes
  useEffect(() => { bus.engine?.resize(); }, [size.width, size.height]);
  return null;
}

const CANVAS_STYLE: React.CSSProperties = { position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0 };

export default function ChessPortfolio() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const b = document.body;
    const prev = b.className;
    b.className = 'chess';
    if (reduced) document.documentElement.classList.add('rm');
    // production title + description (spec 08-content.md section 1)
    const prevTitle = document.title;
    document.title = 'Mark Cabalbag — Full Stack Developer';
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const prevDesc = meta?.content;
    if (meta) meta.content = 'Mark Jeriel Cabalbag, full stack developer. Landing pages and web apps, solved several moves ahead.';
    return () => {
      b.className = prev;
      document.documentElement.classList.remove('rm');
      document.title = prevTitle;
      if (meta && prevDesc !== undefined) meta.content = prevDesc;
    };
  }, [reduced]);

  return (
    <div ref={root} className="chess-root">
      <Canvas
        style={CANVAS_STYLE}
        frameloop="never"
        flat
        dpr={[1, 1.5]}
        shadows={{ enabled: true, type: THREE.PCFSoftShadowMap, autoUpdate: false }}
        camera={{ fov: CAMERA_FOV, near: 0.1, far: 140, position: [-0.6, 0.36, 5.7] }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        aria-hidden="true"
      >
        <Bridge root={root} />
      </Canvas>
      <Chrome />
      <Nav />
      <Acts />
      <Loader />
    </div>
  );
}
