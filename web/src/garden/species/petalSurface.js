import * as THREE from 'three';

let cachedMaps;

// A tiny, shared procedural relief map adds restrained vein structure and
// uneven matte response without loading external textures or raising draw calls.
export function getPetalSurfaceMaps() {
  if (cachedMaps) return cachedMaps;
  if (typeof document === 'undefined') return {};

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return {};

  context.fillStyle = '#808080';
  context.fillRect(0, 0, canvas.width, canvas.height);
  let seed = 19;
  for (let i = 0; i < 5200; i += 1) {
    seed = (seed * 16807) % 2147483647;
    const x = seed % canvas.width;
    seed = (seed * 16807) % 2147483647;
    const y = seed % canvas.height;
    const shade = 112 + (seed % 32);
    context.fillStyle = `rgba(${shade},${shade},${shade},0.16)`;
    context.fillRect(x, y, 1, 1);
  }

  // UV x runs from petal base to tip; draw delicate branching veins from its
  // central rib toward both margins. Keep contrast low so they read in light.
  context.lineCap = 'round';
  context.strokeStyle = 'rgba(207,207,207,0.3)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(5, 128);
  context.bezierCurveTo(142, 121, 340, 136, 507, 126);
  context.stroke();
  context.lineWidth = 1.15;
  for (let i = 1; i <= 15; i += 1) {
    const x = 9 + i * 31;
    const reach = 12 + i * 1.65;
    for (const side of [-1, 1]) {
      context.beginPath();
      context.moveTo(x, 128);
      context.quadraticCurveTo(x + 18, 128 + side * reach * 0.45, x + 43, 128 + side * reach);
      context.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  cachedMaps = { bumpMap: texture, roughnessMap: texture };
  return cachedMaps;
}
