import { Suspense, lazy, useEffect, useState } from 'react';

const GardenScene3D = lazy(() => import('./GardenScene3D.jsx'));
const GardenCanvasLegacy = lazy(() => import('./GardenCanvasLegacy.jsx'));

export default function GardenCanvas(props) {
  const [lowPower, setLowPower] = useState(false);
  useEffect(() => {
    const cores = navigator.hardwareConcurrency || 8;
    const memory = navigator.deviceMemory || 8;
    const compactTouch = window.innerWidth < 768 && window.matchMedia('(pointer: coarse)').matches;
    // Keep the full catalogue on desktop. The compact fallback is intended for
    // genuinely constrained touch devices; desktop WebGL handles the instanced scene.
    setLowPower(compactTouch && (memory <= 4 || cores <= 4));
  }, []);
  const Scene = lowPower ? GardenCanvasLegacy : GardenScene3D;
  return <Suspense fallback={<div className="garden3d-fallback">Đang chuẩn bị khu vườn…</div>}><Scene {...props}/></Suspense>;
}
