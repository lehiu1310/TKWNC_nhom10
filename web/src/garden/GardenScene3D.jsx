import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import species from '../../../data/species.json';

const MODES = {
  day: { sky: '#d5e4e4', horizon: '#f5e9dd', bottom: '#e9e8dc', ground: '#9baa8d', sun: '#f7e4c4', intensity: 1.02, hemi: 0.84, fog: 42 },
  sunset: { sky: '#95899d', horizon: '#edc2ad', bottom: '#e9d4c5', ground: '#9b9d84', sun: '#efc5a3', intensity: 0.9, hemi: 0.78, fog: 42 },
  night: { sky: '#29394c', horizon: '#7f8d99', bottom: '#748391', ground: '#68796f', sun: '#b5c4d8', intensity: 0.48, hemi: 0.66, fog: 38 },
};
const SUN_POSITIONS = {
  day: new THREE.Vector3(-8, 12, 7),
  sunset: new THREE.Vector3(8, 4.6, -3),
  night: new THREE.Vector3(-4, 8, -5),
};

const profiles = ['daisy', 'dandelion', 'sunflower', 'tulip', 'rose', 'bell', 'plumeria', 'cluster', 'iris', 'lily', 'trumpet', 'spike', 'pansy', 'waterlily', 'star', 'pompom', 'orchid', 'bird'];
const BLOOM_TONES = ['#e97b92', '#cd5f7c', '#ee967d', '#db7f67', '#e7a556', '#e6c15f', '#d5b253', '#efe0a8', '#b38fc9', '#9674b5', '#809cce', '#6eabb5', '#c47da8', '#db9daa', '#f0ac91', '#a36f93'];
function colorOf(item) {
  // Preserve the five classifier classes' real-world signature petal colors.
  const canonical = {
    daisy: '#f8f4e7', dandelion: '#e6bf3f', roses: '#c95e76',
    sunflowers: '#f2bd35', tulips: '#d97899',
  }[String(item.id).toLowerCase()];
  if (canonical) return new THREE.Color(canonical);
  // For the wider catalogue, use a stable soft botanical palette per class.
  const tone = BLOOM_TONES[hashOf(item.id || item.name_en || item.name_vi) % BLOOM_TONES.length];
  return new THREE.Color(tone);
}

function hashOf(text) {
  return [...String(text)].reduce((value, letter) => (value * 33 + letter.charCodeAt(0)) >>> 0, 5381);
}

function profileOf(item) {
  const name = `${item.id} ${item.name_en || ''} ${item.name_vi || ''}`.toLowerCase();
  if (/dandelion|taraxacum/.test(name)) return 'dandelion';
  if (/sunflower|helianthus/.test(name)) return 'sunflower';
  if (/oxeye daisy|\bdaisy\b|aster|cosmos|marigold|chamomile|gazania|osteospermum|black-eyed[- ]susan|blanket-flower|colt-s-foot|purple-coneflower/.test(name)) return 'daisy';
  if (/\brose\b|roses|camellia|desert rose|lenten rose/.test(name)) return 'rose';
  if (/peony|dahlia|chrysanthemum|ranunculus|carnation|pincushion|globe-thistle|artichoke|king-protea|spear-thistle|bishop-of-llandaff|azalea/.test(name)) return 'pompom';
  if (/tulip|crocus/.test(name)) return 'tulip';
  if (/iris|gladiolus|sword-lily|columbine/.test(name)) return 'iris';
  if (/water-lily|lotus/.test(name)) return 'waterlily';
  if (/bird-of-paradise/.test(name)) return 'bird';
  if (/orchid|cattleya|moon-orchid|pocket-orchid|bromelia|anthurium/.test(name)) return 'orchid';
  if (/lily|daffodil|narcissus|fire-lily|tiger-lily|canna|hippeastrum/.test(name)) return 'lily';
  if (/morning-glory|trumpet|petunia|thorn-apple|passion-flower|clematis|bougainvillea/.test(name)) return 'trumpet';
  if (/foxglove|snapdragon|globe-flower|grape-hyacinth|siam-tulip|red-ginger|bee-balm|salvia|cautleya-spicata|prince-of-wales-feathers|alpine-sea-holly/.test(name)) return 'spike';
  if (/hydrangea|lilac|phlox|verbena|alyssum|sweet-william|primula|wallflower|watercress|pink-primrose|pelargonium|gaura|geranium|ball-moss/.test(name)) return 'cluster';
  if (/pansy|viola|balloon-flower|wild-pansy|cyclamen/.test(name)) return 'pansy';
  if (/poppy|anemone|windflower|buttercup|silverbush|mallow|hibiscus|love-in-the-mist|cape-flower|poinsettia/.test(name)) return 'star';
  if (/plumeria|frangipani|jasmine|magnolia/.test(name)) return 'plumeria';
  if (/bell|campanula|bluebell|canterbury-bells|snowdrop|gentian|fritillary|monkshood/.test(name)) return 'bell';
  if (/sweet-pea/.test(name)) return 'trumpet';
  if (/bolero-deep-blue/.test(name)) return 'plumeria';
  return profiles[hashOf(item.id) % profiles.length];
}

function petalGeometry(length, width, lift = 0.14, cup = 0.05) {
  const positions = [];
  const indices = [];
  const rows = 8;
  const columns = 5;
  for (let row = 0; row <= rows; row += 1) {
    const t = row / rows;
    const taper = 0.62 + 0.38 * Math.sin(Math.PI * t);
    for (let column = 0; column <= columns; column += 1) {
      const across = column / columns * 2 - 1;
      positions.push(
        across * width * taper,
        0.08 + length * t,
        lift * Math.sin(Math.PI * t) + cup * across * across,
      );
    }
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function makeBloomGeometry(profile, variation = 0) {
  const parts = [];
  const sizeFactor = 0.86 + variation * 0.075;
  const addLayer = (count, length, width, y, phase = 0, lift = 0.12, cup = 0.05, offsetX = 0, offsetZ = 0) => {
    length *= sizeFactor;
    width *= sizeFactor;
    const petal = petalGeometry(length, width, lift, cup);
    for (let index = 0; index < count; index += 1) {
      const geometry = petal.clone();
      const matrix = new THREE.Matrix4().makeRotationZ(index * Math.PI * 2 / count + phase);
      // Petals fan in the flower's upright face plane so the silhouette remains
      // readable from the garden's low, walk-in camera angle.
      matrix.setPosition(offsetX, offsetZ, y);
      geometry.applyMatrix4(matrix);
      parts.push(geometry);
    }
    petal.dispose();
  };

  if (profile === 'rose') {
    const outer = 10 + variation * 2;
    addLayer(outer, 0.34, 0.145, 0.015, 0, 0.14, 0.1);
    addLayer(8 + variation * 2, 0.27, 0.13, 0.075, 0.17, 0.2, 0.13);
    addLayer(6 + variation * 2, 0.18, 0.11, 0.13, 0.33, 0.23, 0.16);
  } else if (profile === 'tulip') addLayer(5 + variation % 4, 0.42, 0.18, 0.02, 0, 0.36, 0.22);
  else if (profile === 'daisy') addLayer(16 + variation * 3, 0.43, 0.067, 0, 0, 0.09, 0.018);
  else if (profile === 'dandelion') addLayer(24 + variation * 4, 0.31, 0.035, 0, 0, 0.15, 0.01);
  else if (profile === 'sunflower') {
    addLayer(18 + variation * 2, 0.38, 0.105, 0, 0, 0.1, 0.025);
    addLayer(12 + variation * 2, 0.31, 0.08, 0.035, Math.PI / 24, 0.09, 0.02);
  }
  else if (profile === 'bell') addLayer(4 + variation % 5, 0.37, 0.12, 0, 0, 0.27, 0.1);
  else if (profile === 'cluster') {
    const heads = 4 + variation;
    for (let head = 0; head < heads; head += 1) {
      const angle = head * Math.PI * 2 / heads;
      addLayer(4 + variation % 3, 0.19, 0.055, 0.04, angle, 0.08, 0.035, Math.cos(angle) * 0.14, Math.sin(angle) * 0.14);
    }
  }
  else if (profile === 'plumeria') addLayer(4 + variation % 3, 0.36, 0.19, 0.015, 0.1, 0.2, 0.12);
  else if (profile === 'pompom') {
    addLayer(18 + variation * 3, 0.31, 0.075, 0, 0, 0.2, 0.09);
    addLayer(14 + variation * 2, 0.25, 0.07, 0.035, 0.13, 0.24, 0.12);
    addLayer(10 + variation * 2, 0.18, 0.06, 0.07, 0.27, 0.26, 0.14);
  }
  else if (profile === 'iris') {
    addLayer(3, 0.44, 0.17, 0, 0, 0.34, 0.18);
    addLayer(3, 0.38, 0.18, 0.025, Math.PI / 3, 0.08, 0.06);
  }
  else if (profile === 'lily') {
    addLayer(6, 0.49, 0.13, 0, 0, 0.16, 0.08);
    addLayer(6, 0.4, 0.1, 0.025, Math.PI / 6, 0.19, 0.11);
  }
  else if (profile === 'trumpet') {
    addLayer(5, 0.43 + variation * 0.025, 0.21, 0, 0, 0.32, 0.22);
    addLayer(5, 0.23, 0.13, 0.06, Math.PI / 5, 0.12, 0.08);
  }
  else if (profile === 'spike') {
    for (let tier = 0; tier < 4; tier += 1) {
      const count = 5 + (tier % 2) * 2;
      addLayer(count, 0.19 - tier * 0.018, 0.07, tier * 0.105, tier * 0.3, 0.2, 0.09, 0, (tier - 1.5) * 0.045);
    }
  }
  else if (profile === 'pansy') {
    addLayer(3, 0.35, 0.2, 0, 0, 0.16, 0.14);
    addLayer(2, 0.31, 0.22, 0.04, Math.PI / 2, 0.28, 0.22);
  }
  else if (profile === 'waterlily') {
    addLayer(12 + variation * 2, 0.43, 0.095, 0, 0, 0.07, 0.035);
    addLayer(10 + variation, 0.32, 0.085, 0.035, Math.PI / 10, 0.1, 0.05);
    addLayer(7, 0.19, 0.065, 0.065, Math.PI / 7, 0.12, 0.06);
  }
  else if (profile === 'star') addLayer(5 + variation % 2, 0.47, 0.145, 0, 0, 0.13, 0.065);
  else if (profile === 'orchid') {
    addLayer(3, 0.42, 0.2, 0, 0, 0.19, 0.13);
    addLayer(2, 0.31, 0.24, 0.035, Math.PI / 2, 0.27, 0.18);
  }
  else if (profile === 'bird') {
    addLayer(3, 0.42, 0.12, 0, 0, 0.46, 0.18);
    addLayer(3, 0.32, 0.17, 0.035, Math.PI / 3, -0.04, 0.03);
  }
  else addLayer(5, 0.43, 0.2, 0, 0.12, 0.14, 0.075);

  return mergeGeometries(parts, false);
}

function makeLeafGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.2, 0.11, 0.46, 0.015);
  shape.quadraticCurveTo(0.19, -0.16, 0, 0);
  const geometry = new THREE.ShapeGeometry(shape, 8);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function makeTerrainGeometry() {
  // Carry the ground well beyond the camera view so there is no visible circular plinth edge.
  const geometry = new THREE.PlaneGeometry(96, 96, 128, 128);
  const position = geometry.attributes.position;
  const colors = [];
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const worldZ = -y;
    const elevation = terrainOffsetAt(x, worldZ);
    position.setZ(i, elevation);
    const broad = elevation;
    const detail = Math.sin(x * 0.21 + y * 0.13) * Math.cos(y * 0.17 - x * 0.08) * 0.035;
    const tint = THREE.MathUtils.clamp(0.94 + broad * 0.09 + detail * 0.16, 0.89, 1.02);
    colors.push(tint * 0.98, tint, tint * 0.94);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function terrainOffsetAt(x, worldZ) {
  const y = -worldZ;
  return Math.sin(x * 0.075 + Math.sin(y * 0.035)) * 0.25
    + Math.cos(y * 0.062 - x * 0.028) * 0.19
    + Math.sin((x + y) * 0.042) * 0.12
    + Math.sin(x * 0.21 + y * 0.13) * Math.cos(y * 0.17 - x * 0.08) * 0.035;
}

function makeRibbonGeometry(curve, halfWidth, elevationOffset, segments = 96) {
  const positions = [];
  const indices = [];
  const center = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const across = new THREE.Vector3();
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    curve.getPointAt(t, center);
    curve.getTangentAt(t, tangent);
    across.set(-tangent.z, 0, tangent.x).normalize().multiplyScalar(halfWidth);
    const leftX = center.x - across.x; const leftZ = center.z - across.z;
    const rightX = center.x + across.x; const rightZ = center.z + across.z;
    positions.push(leftX, terrainOffsetAt(leftX, leftZ) - 0.18 + elevationOffset, leftZ,
      rightX, terrainOffsetAt(rightX, rightZ) - 0.18 + elevationOffset, rightZ);
    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function noiseTexture(base, repeatX = 7, repeatY = 7) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  let seed = 13;
  for (let i = 0; i < 1150; i += 1) {
    seed = (seed * 16807) % 2147483647;
    const x = seed % 128;
    seed = (seed * 16807) % 2147483647;
    const y = seed % 128;
    const shade = seed % 2 ? 'rgba(255,255,255,.09)' : 'rgba(24,39,21,.07)';
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, 1 + (seed % 3), 1 + (seed % 2));
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 2;
  return texture;
}

function skyMaterial() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uTop: { value: new THREE.Color(MODES.day.sky) },
      uHorizon: { value: new THREE.Color(MODES.day.horizon) },
      uBottom: { value: new THREE.Color(MODES.day.bottom) },
    },
    vertexShader: 'varying vec3 vDirection; void main(){ vDirection=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom; varying vec3 vDirection; void main(){ float h=clamp(vDirection.y*0.5+0.5,0.0,1.0); vec3 c=h<0.24?mix(uBottom,uHorizon,smoothstep(0.0,0.24,h)):mix(uHorizon,uTop,smoothstep(0.24,0.82,h)); gl_FragColor=vec4(c,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  return material;
}

function makeSunGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const glow = context.createRadialGradient(64, 64, 3, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255,238,195,0.52)');
  glow.addColorStop(0.28, 'rgba(255,235,202,0.24)');
  glow.addColorStop(1, 'rgba(255,238,218,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const instanceMatrixScratch = new THREE.Matrix4();
function setInstance(mesh, index, position, rotation, scale) {
  instanceMatrixScratch.compose(position, rotation, scale);
  mesh.setMatrixAt(index, instanceMatrixScratch);
}

function sortRainbow(items) {
  return [...items].sort((a, b) => {
    const ca = colorOf(a).getHSL({ h: 0, s: 0, l: 0 }).h;
    const cb = colorOf(b).getHSL({ h: 0, s: 0, l: 0 }).h;
    return ca - cb;
  });
}

export default function GardenScene3D({ selectedId, timeOfDay, wind, resetCamera, onSelectSpecies }) {
  const containerRef = useRef(null);
  const sceneState = useRef(null);
  const selectedRef = useRef(selectedId);
  const previousSelectedId = useRef(selectedId);
  const modeRef = useRef(timeOfDay);
  const windRef = useRef(wind);
  const [active, setActive] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  selectedRef.current = selectedId;
  modeRef.current = timeOfDay;
  windRef.current = wind;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setActive(true); observer.disconnect(); }
    }, { threshold: 0.05 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const host = containerRef.current;
    if (!host) return undefined;
    host.dataset.gardenRenderer = 'full-catalogue';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
    host.dataset.gardenReducedMotion = String(reducedMotion);
    host.dataset.gardenMobileQuality = String(mobile);
    let renderer;
    let frame = 0;
    let inViewport = true;
    let visible = !document.hidden;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(MODES.day.horizon, 10, MODES.day.fog);
    const camera = new THREE.PerspectiveCamera(47, 1, 0.1, 100);
    // A closer, garden-path viewpoint makes petal silhouettes readable without
    // clipping the beds from the widescreen scene.
    camera.position.set(0, 4.7, 12.9);
    const renderers = [];
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    const flowers = sortRainbow(species).map((item, index) => {
      const bed = index % 6;
      const slot = Math.floor(index / 6);
      const slots = Math.max(1, Math.ceil(species.length / 6));
      const side = bed < 3 ? -1 : 1;
      const row = bed % 3;
      const seed = hashOf(item.id);
      const z = -4.1 + slot / Math.max(1, slots - 1) * 8.2 + ((seed % 101) / 100 - 0.5) * 0.28;
      const h = 1.22 + (seed % 37) / 100;
      return {
        item,
        profile: profileOf(item),
        // Three silhouettes per family keep species recognizably varied while
        // limiting the number of InstancedMesh batches on the full catalogue.
        variation: hashOf(item.id) % 3,
        color: colorOf(item),
        position: new THREE.Vector3(side * (1.5 + row * 1.04) + ((seed >> 3) % 100 / 100 - 0.5) * 0.28, 0.06, z),
        stemHeight: h,
        rotation: (seed % 360) * Math.PI / 180,
        scale: 0.78 + (seed % 43) / 100,
        // Give every class its own bloom proportions without adding draw calls.
        bloomWidth: 0.82 + ((seed >>> 8) % 43) / 100,
        bloomHeight: 0.84 + ((seed >>> 16) % 39) / 100,
        phase: (seed % 628) / 100,
        bloomIndex: -1,
        centerIndex: -1,
        stemIndex: -1,
        leafIndices: [],
      };
    });
    host.dataset.gardenSpeciesCount = String(flowers.length);
    const bloomMeshes = [];
    const bloomById = new Map();
    const activeMode = { skyTop: new THREE.Color(MODES.day.sky), skyHorizon: new THREE.Color(MODES.day.horizon), skyBottom: new THREE.Color(MODES.day.bottom), sun: new THREE.Color(MODES.day.sun), fog: new THREE.Color(MODES.day.horizon), ground: new THREE.Color(MODES.day.ground), sunIntensity: MODES.day.intensity, hemi: MODES.day.hemi };
    const transition = { elapsed: 1 };
    let sun;
    let hemisphere;
    let ground;
    let fireflies;
    let fireflyPhase = 0;
    let petalDrift;
    let butterflyWings;
    let grassMaterial;
    let controlsRef;
    let cameraDestination = null;

    try {
      renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.25 : 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.84;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = mobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
      renderer.domElement.setAttribute('aria-label', 'Khu vườn hoa 3D tương tác');
      host.appendChild(renderer.domElement);

      const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 20), skyMaterial());
      sky.frustumCulled = false;
      sky.renderOrder = -10;
      scene.add(sky);
      materials.add(sky.material);

      // Soft, low-contrast atmosphere elements sit in the sky, not over the garden content.
      const glowTexture = makeSunGlowTexture(); textures.add(glowTexture);
      const sunGlowMaterial = new THREE.SpriteMaterial({ map: glowTexture, color: '#fff4d7', transparent: true, depthWrite: false, fog: false });
      const sunGlow = new THREE.Sprite(sunGlowMaterial);
      sunGlow.position.set(-6.5, 5.8, -17);
      sunGlow.scale.set(11, 11, 1);
      sunGlow.renderOrder = -2;
      scene.add(sunGlow); materials.add(sunGlowMaterial);
      const cloudGeometry = new THREE.SphereGeometry(1, 12, 8);
      const cloudMaterial = new THREE.MeshBasicMaterial({ color: '#fff9ef', transparent: true, opacity: 0.48, depthWrite: false, fog: false });
      const clouds = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, 9);
      const cloudDummy = new THREE.Object3D();
      for (let i = 0; i < 9; i += 1) {
        const x = -12 + (i % 5) * 5.5;
        const y = 4.1 + (i % 3) * 0.48;
        const z = -17 - Math.floor(i / 5) * 5;
        cloudDummy.position.set(x, y, z);
        cloudDummy.scale.set(2.3 + (i % 3) * 0.45, 0.42 + (i % 2) * 0.13, 0.8);
        cloudDummy.rotation.set(0, 0, (i % 3 - 1) * 0.04);
        cloudDummy.updateMatrix(); clouds.setMatrixAt(i, cloudDummy.matrix);
      }
      scene.add(clouds); geometries.add(cloudGeometry); materials.add(cloudMaterial);

      hemisphere = new THREE.HemisphereLight('#eaf7f2', '#a9b69a', MODES.day.hemi);
      scene.add(hemisphere);
      scene.add(new THREE.AmbientLight('#fff4e5', 0.2));
      sun = new THREE.DirectionalLight(MODES.day.sun, MODES.day.intensity);
      sun.position.set(-8, 12, 7);
      sun.castShadow = renderer.shadowMap.enabled;
      sun.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
      sun.shadow.camera.left = -12; sun.shadow.camera.right = 12;
      sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12;
      sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 38;
      sun.shadow.bias = -0.00035; sun.shadow.normalBias = 0.025;
      sun.shadow.radius = mobile ? 1 : 2;
      scene.add(sun);

      const terrainMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, map: noiseTexture('#ffffff', 18, 18), roughness: 0.98 });
      textures.add(terrainMaterial.map); materials.add(terrainMaterial);
      ground = new THREE.Mesh(makeTerrainGeometry(), terrainMaterial);
      ground.position.y = -0.18; ground.receiveShadow = true;
      scene.add(ground);
      const soilMaterial = new THREE.MeshStandardMaterial({ color: '#c9a981', roughness: 1, map: noiseTexture('#dfc6a3', 3, 6) });
      textures.add(soilMaterial.map); materials.add(soilMaterial);
      const edgeMaterial = new THREE.MeshStandardMaterial({ color: '#b48b68', roughness: 0.9 }); materials.add(edgeMaterial);
      for (const side of [-1, 1]) {
        for (let row = 0; row < 3; row += 1) {
          const x = side * (1.5 + row * 1.04);
          const bed = new THREE.Mesh(new THREE.BoxGeometry(0.91, 0.2, 8.8), edgeMaterial);
          bed.position.set(x, -0.015, 0); bed.castShadow = true; bed.receiveShadow = true; scene.add(bed);
          const soil = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.12, 8.7), soilMaterial);
          soil.position.set(x, 0.12, 0); soil.receiveShadow = true; scene.add(soil);
        }
      }
      const pathPoints = [[0, 8], [0.13, 5], [-0.12, 2], [0.16, -1.4], [-0.12, -4.5], [0, -8]];
      const pathCurve = new THREE.CatmullRomCurve3(pathPoints.map(([x, z]) => new THREE.Vector3(x, 0, z)));
      const pathTexture = noiseTexture('#f0e6cf', 2, 12); textures.add(pathTexture);
      const pathMaterial = new THREE.MeshStandardMaterial({ color: '#eadcbd', map: pathTexture, roughness: 1, side: THREE.DoubleSide });
      const path = new THREE.Mesh(makeRibbonGeometry(pathCurve, 0.43, 0.035), pathMaterial);
      path.receiveShadow = true; scene.add(path); materials.add(pathMaterial); geometries.add(path.geometry);
      const pathEdgeMaterial = new THREE.MeshStandardMaterial({ color: '#c9b99b', roughness: 0.95 }); materials.add(pathEdgeMaterial);
      for (const side of [-1, 1]) {
        const points = pathCurve.getPoints(48).map((point, index, all) => {
          const tangent = all[Math.min(index + 1, all.length - 1)].clone().sub(all[Math.max(index - 1, 0)]).normalize();
          point.add(new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(side * 0.47));
          point.y = terrainOffsetAt(point.x, point.z) - 0.18 + 0.025;
          return point;
        });
        const edgeCurve = new THREE.CatmullRomCurve3(points);
        const edge = new THREE.Mesh(new THREE.TubeGeometry(edgeCurve, 72, 0.035, 5, false), pathEdgeMaterial);
        edge.receiveShadow = true; scene.add(edge); geometries.add(edge.geometry);
      }
      const pathStoneGeometry = new THREE.DodecahedronGeometry(0.09, 0);
      const pathStoneMaterial = new THREE.MeshStandardMaterial({ color: '#d4c7aa', roughness: 1 });
      const pathStones = new THREE.InstancedMesh(pathStoneGeometry, pathStoneMaterial, 56);
      const stoneDummy = new THREE.Object3D();
      for (let i = 0; i < 56; i += 1) {
        const side = i % 2 ? 1 : -1;
        const point = pathCurve.getPointAt(0.035 + Math.floor(i / 2) / 28 * 0.93);
        const tangent = pathCurve.getTangentAt(0.035 + Math.floor(i / 2) / 28 * 0.93);
        point.x += -tangent.z * side * (0.53 + (i % 3) * 0.035);
        point.z += tangent.x * side * (0.53 + (i % 3) * 0.035);
        stoneDummy.position.set(point.x, terrainOffsetAt(point.x, point.z) - 0.18 + 0.05, point.z);
        stoneDummy.scale.set(0.65 + (i % 3) * 0.12, 0.42 + (i % 2) * 0.1, 0.55 + (i % 4) * 0.08);
        stoneDummy.rotation.set(0, i * 0.71, 0.1 * (i % 3));
        stoneDummy.updateMatrix(); pathStones.setMatrixAt(i, stoneDummy.matrix);
      }
      pathStones.receiveShadow = true; scene.add(pathStones);
      geometries.add(pathStoneGeometry); materials.add(pathStoneMaterial);

      const trellisWood = new THREE.MeshStandardMaterial({ color: '#b58c6d', roughness: 0.86 }); materials.add(trellisWood);
      const trellisParts = [];
      for (const x of [-2.8, 2.8]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.45, 10), trellisWood);
        post.position.set(x, 1.55, -5.45); post.castShadow = true; scene.add(post); trellisParts.push(post);
      }
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5.8, 10), trellisWood);
      beam.rotation.z = Math.PI / 2; beam.position.set(0, 3.25, -5.45); beam.castShadow = true; scene.add(beam);
      const vineGeo = new THREE.SphereGeometry(0.12, 8, 6);
      const vineMat = new THREE.MeshStandardMaterial({ color: '#5a8c55', roughness: 0.85 }); materials.add(vineMat);
      const vineLeaves = new THREE.InstancedMesh(vineGeo, vineMat, 28);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < 28; i += 1) {
        const vine = Math.floor(i / 7); const leaf = i % 7;
        const x = -2.55 + vine * 1.7 + Math.sin(leaf * 1.7) * 0.17;
        const y = 0.45 + leaf * 0.38;
        dummy.position.set(x + (leaf % 2 ? 0.2 : -0.2), y, -5.3);
        dummy.scale.set(1.6, 0.4, 0.8); dummy.rotation.z = leaf % 2 ? -0.55 : 0.55; dummy.updateMatrix();
        vineLeaves.setMatrixAt(i, dummy.matrix);
      }
      vineLeaves.castShadow = true; scene.add(vineLeaves);

      const bushGeometry = new THREE.SphereGeometry(0.38, 16, 12);
      const bushMaterials = ['#719478', '#88a985', '#a4bc96'].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.96 }));
      for (let layer = 0; layer < bushMaterials.length; layer += 1) {
        const material = bushMaterials[layer];
        const mesh = new THREE.InstancedMesh(bushGeometry, material, 24);
        mesh.receiveShadow = true; scene.add(mesh); materials.add(material);
        for (let i = 0; i < 24; i += 1) {
          const side = i % 2 ? 1 : -1;
          const z = -9 + Math.floor(i / 2) * 1.55 + Math.sin(i * 8.4) * 0.22;
          const x = side * (5.15 + (i % 4) * 0.35 + layer * 0.12) + Math.sin(i * 4.1 + layer) * 0.22;
          dummy.position.set(x, 0.22 + layer * 0.12 + Math.sin(i * 5.3) * 0.06, z);
          dummy.scale.set(0.72 + (i % 3) * 0.11, 0.72 + ((i + layer) % 3) * 0.1, 0.75 + (i % 4) * 0.07);
          dummy.rotation.set(0, i * 0.31, 0); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
      const shrubBloomGeometry = new THREE.SphereGeometry(0.075, 8, 6);
      const shrubBloomMaterial = new THREE.MeshBasicMaterial({ color: '#fff0de' });
      const shrubBlooms = new THREE.InstancedMesh(shrubBloomGeometry, shrubBloomMaterial, 36);
      for (let i = 0; i < 36; i += 1) {
        const side = i % 2 ? 1 : -1;
        const z = -8.4 + Math.floor(i / 2) * 0.92 + Math.sin(i * 4.7) * 0.28;
        dummy.position.set(side * (5.35 + (i % 4) * 0.3), 0.68 + (i % 3) * 0.06, z);
        dummy.scale.set(0.75, 0.85, 0.75); dummy.updateMatrix(); shrubBlooms.setMatrixAt(i, dummy.matrix);
        shrubBlooms.setColorAt(i, new THREE.Color(['#fff0de', '#f5b5bd', '#e8c8ea'][i % 3]));
      }
      scene.add(shrubBlooms); geometries.add(bushGeometry, shrubBloomGeometry); materials.add(shrubBloomMaterial);

      const rockGeometry = new THREE.DodecahedronGeometry(0.2, 0);
      const rockMaterial = new THREE.MeshStandardMaterial({ color: '#b7a884', roughness: 1 }); materials.add(rockMaterial);
      const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, 36);
      for (let i = 0; i < 36; i += 1) {
        const angle = i * 2.4; const radius = 6.2 + (i % 4) * 0.38;
        dummy.position.set(Math.cos(angle) * radius, 0.01, Math.sin(angle) * radius);
        dummy.scale.set(1.3, 0.45 + (i % 3) * 0.12, 0.85); dummy.rotation.y = angle; dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
      }
      rocks.castShadow = true; rocks.receiveShadow = true; scene.add(rocks);

      const blade = new THREE.BufferGeometry();
      blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.055, 0, 0, 0.055, 0, 0, 0.004, 0.44, 0, -0.055, 0, 0, 0.004, 0.44, 0, -0.012, 0.08, 0.018], 3));
      blade.setIndex([0, 1, 2, 3, 4, 5]); blade.computeVertexNormals();
      blade.setAttribute('color', new THREE.Float32BufferAttribute([
        0.62, 0.78, 0.58, 0.62, 0.78, 0.58, 0.92, 0.98, 0.76,
        0.62, 0.78, 0.58, 0.92, 0.98, 0.76, 0.72, 0.86, 0.63,
      ], 3));
      const grassCount = mobile ? 1100 : 3400;
      grassMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, side: THREE.DoubleSide, roughness: 0.96 });
      grassMaterial.onBeforeCompile = (shader) => {
        shader.uniforms.uGrassTime = { value: 0 };
        shader.uniforms.uGrassWind = { value: 0 };
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uGrassTime; uniform float uGrassWind;');
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nfloat gardenPhase = instanceMatrix[3].x * 0.71 + instanceMatrix[3].z * 0.49;\n#else\nfloat gardenPhase = 0.0;\n#endif\ntransformed.x += sin(uGrassTime + gardenPhase) * uGrassWind * transformed.y * transformed.y * 0.2;');
        grassMaterial.userData.shader = shader;
      };
      const grass = new THREE.InstancedMesh(blade, grassMaterial, grassCount);
      grass.frustumCulled = false;
      let placedGrass = 0; let seed = 41;
      while (placedGrass < grassCount) {
        seed = (seed * 16807) % 2147483647;
        const x = ((seed % 20000) / 10000 - 1) * 9.7;
        seed = (seed * 16807) % 2147483647;
        const z = ((seed % 20000) / 10000 - 1) * 9.7;
        if (Math.abs(x) < 4.15 && Math.abs(z) < 4.7) continue;
        if (Math.abs(x) < 1.05) continue;
        const height = 0.34 + (seed % 25) / 100;
        dummy.position.set(x, -0.11, z); dummy.rotation.set(0, (seed % 628) / 100, 0);
        dummy.scale.set(0.75 + (seed % 45) / 100, height, 0.75 + (seed % 35) / 100); dummy.updateMatrix();
        grass.setMatrixAt(placedGrass, dummy.matrix);
        grass.setColorAt(placedGrass, new THREE.Color(seed % 5 ? '#d9ebc8' : '#e5edc8'));
        placedGrass += 1;
      }
      grass.instanceMatrix.needsUpdate = true; if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
      grass.castShadow = false; grass.receiveShadow = false;
      scene.add(grass); materials.add(grassMaterial);

      const groups = new Map();
      flowers.forEach((flower) => {
        const key = `${flower.profile}:${flower.variation}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(flower);
      });
      const bloomMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.48, side: THREE.DoubleSide, emissive: '#f7b83c', emissiveIntensity: 0.025 });
      const centerMaterial = new THREE.MeshStandardMaterial({ color: '#efba42', roughness: 0.72, emissive: '#ffbb42', emissiveIntensity: 0.02 });
      const stemMaterial = new THREE.MeshStandardMaterial({ color: '#42734a', roughness: 0.78 });
      const leafMaterial = new THREE.MeshStandardMaterial({ color: '#6e9d5e', roughness: 0.82, side: THREE.DoubleSide });
      materials.add(bloomMaterial); materials.add(centerMaterial); materials.add(stemMaterial); materials.add(leafMaterial);
      const centerGeo = new THREE.SphereGeometry(0.14, 12, 8); centerGeo.scale(1, 0.42, 1);
      const stemGeo = new THREE.CylinderGeometry(0.027, 0.046, 1, 7, 1);
      const leafGeo = makeLeafGeometry();
      geometries.add(centerGeo, stemGeo, leafGeo, blade, bushGeometry, rockGeometry, vineGeo);
      const centers = new THREE.InstancedMesh(centerGeo, centerMaterial, flowers.length);
      const stems = new THREE.InstancedMesh(stemGeo, stemMaterial, flowers.length);
      const leaves = new THREE.InstancedMesh(leafGeo, leafMaterial, flowers.length * 2);
      for (let i = 0; i < flowers.length; i += 1) {
        const flower = flowers[i];
        flower.centerIndex = i; flower.stemIndex = i;
        const centerColor = new THREE.Color(['daisy', 'dandelion', 'sunflower'].includes(flower.profile) ? '#d9b461' : '#f4e6ce');
        centers.setColorAt(i, centerColor);
        flower.leafIndices = [i * 2, i * 2 + 1];
        leaves.setColorAt(i * 2, new THREE.Color('#568653'));
        leaves.setColorAt(i * 2 + 1, new THREE.Color('#83a960'));
      }
      scene.add(centers, stems, leaves); bloomMeshes.push(centers, stems); renderers.push(centers, stems, leaves);
      for (const [profileKey, items] of groups) {
        if (!items.length) continue;
        const [profile, variation] = profileKey.split(':');
        const geometry = makeBloomGeometry(profile, Number(variation)); geometries.add(geometry);
        const mesh = new THREE.InstancedMesh(geometry, bloomMaterial, items.length);
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.userData.flowers = items;
        items.forEach((flower, index) => {
          flower.bloomIndex = index; flower.bloomMesh = mesh;
          mesh.setColorAt(index, colorOf(flower.item));
        });
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        scene.add(mesh); bloomMeshes.push(mesh); renderers.push(mesh);
        items.forEach((flower) => bloomById.set(flower.item.id, flower));
      }
      centers.userData.flowers = flowers; stems.userData.flowers = flowers; leaves.userData.flowers = flowers;
      centers.castShadow = true; centers.receiveShadow = true; stems.castShadow = true; leaves.castShadow = true;
      centers.instanceMatrix.setUsage(THREE.DynamicDrawUsage); stems.instanceMatrix.setUsage(THREE.DynamicDrawUsage); leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      const butterflyShape = new THREE.BufferGeometry();
      butterflyShape.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.18, 0.1, 0, -0.21, -0.08, 0, 0, 0, 0, 0.18, 0.1, 0, 0.21, -0.08, 0], 3));
      butterflyShape.setIndex([0, 1, 2, 3, 4, 5]); butterflyShape.computeVertexNormals();
      const butterflyMaterial = new THREE.MeshStandardMaterial({ color: '#df6e80', side: THREE.DoubleSide, roughness: 0.42, emissive: '#682e52', emissiveIntensity: 0.12 }); materials.add(butterflyMaterial);
      butterflyWings = new THREE.InstancedMesh(butterflyShape, butterflyMaterial, mobile ? 2 : 7);
      butterflyWings.userData.count = mobile ? 2 : 7;
      for (let i = 0; i < butterflyWings.userData.count; i += 1) {
        butterflyWings.setColorAt(i, new THREE.Color(['#e9a0aa', '#e7c477', '#ad9bd3', '#83b9a9'][i % 4]));
        const phase = i * 1.3;
        dummy.position.set(Math.sin(phase) * 4.4, 1.6 + Math.sin(phase * 1.7) * 0.8, Math.cos(phase * 0.7) * 4.7);
        dummy.scale.setScalar(0.75); dummy.updateMatrix(); butterflyWings.setMatrixAt(i, dummy.matrix);
      }
      butterflyWings.instanceMatrix.needsUpdate = true;
      scene.add(butterflyWings); renderers.push(butterflyWings); geometries.add(butterflyShape);

      const petalGeo = new THREE.PlaneGeometry(0.08, 0.16, 1, 1);
      const petalMaterial = new THREE.MeshStandardMaterial({ color: '#fff3d6', side: THREE.DoubleSide, roughness: 0.8 }); materials.add(petalMaterial);
      petalDrift = new THREE.InstancedMesh(petalGeo, petalMaterial, mobile ? 0 : 12);
      petalDrift.userData.count = mobile ? 0 : 12;
      for (let i = 0; i < petalDrift.userData.count; i += 1) {
        petalDrift.setColorAt(i, new THREE.Color(['#f8c2c8', '#f4dca4', '#fffaf1'][i % 3]));
        const phase = i * 1.7;
        dummy.position.set(Math.sin(phase) * 4.7, 0.45 + (i % 4) * 0.58, Math.cos(phase * 0.8) * 4.5);
        dummy.rotation.set(phase, 0, Math.sin(phase * 1.5) * 0.8); dummy.scale.setScalar(0.58); dummy.updateMatrix(); petalDrift.setMatrixAt(i, dummy.matrix);
      }
      petalDrift.instanceMatrix.needsUpdate = true;
      scene.add(petalDrift); renderers.push(petalDrift); geometries.add(petalGeo);

      const fireflyGeo = new THREE.SphereGeometry(0.045, 7, 6);
      const fireflyMat = new THREE.MeshBasicMaterial({ color: '#ffe699', toneMapped: false }); materials.add(fireflyMat);
      fireflies = new THREE.InstancedMesh(fireflyGeo, fireflyMat, mobile ? 8 : 18);
      fireflies.userData.count = mobile ? 8 : 18;
      for (let i = 0; i < fireflies.userData.count; i += 1) {
        fireflies.setColorAt(i, new THREE.Color(i % 2 ? '#e8f5ae' : '#ffd67e'));
        const phase = i * 2.4;
        dummy.position.set(Math.sin(phase) * 5.2, 0.7 + (Math.sin(phase * 1.6) + 1) * 1.1, Math.cos(phase * 0.8) * 5.4);
        dummy.scale.setScalar(0.9); dummy.updateMatrix(); fireflies.setMatrixAt(i, dummy.matrix);
      }
      fireflies.instanceMatrix.needsUpdate = true;
      fireflies.visible = false; scene.add(fireflies); renderers.push(fireflies); geometries.add(fireflyGeo);

      controlsRef = new OrbitControls(camera, renderer.domElement);
      controlsRef.enableDamping = !reducedMotion;
      controlsRef.dampingFactor = 0.075;
      controlsRef.minDistance = 7.5; controlsRef.maxDistance = 18;
      controlsRef.minPolarAngle = 0.42; controlsRef.maxPolarAngle = 1.32;
      controlsRef.target.set(0, 1.2, 0); controlsRef.update();
      const resize = () => {
        const width = Math.max(1, host.clientWidth); const height = Math.max(1, host.clientHeight);
        camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
        if (visible && inViewport) renderer.render(scene, camera);
      };
      const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); resize();

      const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
      const projectedFlower = new THREE.Vector3();
      const castFlower = (event) => {
        const bounds = renderer.domElement.getBoundingClientRect();
        pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(bloomMeshes, false).find((entry) => entry.object.userData.flowers?.[entry.instanceId]);
        if (hit) return hit.object.userData.flowers[hit.instanceId];
        let nearest = null; let nearestDistance = Infinity;
        for (const flower of flowers) {
          projectedFlower.copy(flower.position).add(windOffset.set(0, flower.stemHeight, 0)).project(camera);
          if (projectedFlower.z < -1 || projectedFlower.z > 1) continue;
          const x = (projectedFlower.x + 1) * 0.5 * bounds.width;
          const y = (1 - projectedFlower.y) * 0.5 * bounds.height;
          const distance = Math.hypot(x - event.clientX + bounds.left, y - event.clientY + bounds.top);
          if (distance < nearestDistance) { nearest = flower; nearestDistance = distance; }
        }
        return nearestDistance <= (mobile ? 42 : 34) ? nearest : null;
      };
      const onPointerMove = (event) => { renderer.domElement.style.cursor = castFlower(event) ? 'pointer' : 'grab'; };
      const onClick = (event) => {
        const flower = castFlower(event);
        if (flower) onSelectSpecies(flower.item);
      };
      renderer.domElement.addEventListener('pointermove', onPointerMove, { passive: true });
      renderer.domElement.addEventListener('click', onClick);

      const stemRotation = new THREE.Quaternion(); const stemUp = new THREE.Vector3(0, 1, 0);
      const bloomRotation = new THREE.Quaternion(); const bloomScale = new THREE.Vector3();
      const flowerScaleVector = new THREE.Vector3(); const stemEnd = new THREE.Vector3();
      const stemMid = new THREE.Vector3(); const stemDirection = new THREE.Vector3();
      const leafPosition = new THREE.Vector3(); const leafRotation = new THREE.Quaternion();
      const leafEuler = new THREE.Euler(); const reusableMatrix = new THREE.Matrix4();
      const windOffset = new THREE.Vector3(); const leafOffset = new THREE.Vector3();
      const applyMatrices = (time) => {
        // Reduced-motion keeps a gentle breeze (rather than freezing the garden),
        // while the render loop below is throttled to limit visual motion.
        const windPower = windRef.current * (reducedMotion ? 0.55 : 1);
        const focusFlower = flowers.find((flower) => flower.item.id === selectedRef.current);
        const focusHue = focusFlower?.color.getHSL({ h: 0, s: 0, l: 0 }).h;
        for (const flower of flowers) {
          const hue = flower.color.getHSL({ h: 0, s: 0, l: 0 }).h;
          const hueDistance = focusFlower ? Math.min(Math.abs(hue - focusHue), 1 - Math.abs(hue - focusHue)) : 1;
          const inFocusGroup = Boolean(focusFlower && flower.profile === focusFlower.profile && hueDistance < 0.1);
          const selected = flower.item.id === selectedRef.current;
          const sway = Math.sin(time * 0.00075 + flower.phase) * windPower * 0.18;
          const lift = selected ? 0.16 : inFocusGroup ? 0.06 : 0;
          windOffset.set(sway, flower.stemHeight, 0);
          stemEnd.copy(flower.position).add(windOffset);
          stemMid.copy(flower.position).add(stemEnd).multiplyScalar(0.5);
          stemDirection.copy(stemEnd).sub(flower.position).normalize();
          stemRotation.setFromUnitVectors(stemUp, stemDirection);
          flowerScaleVector.set(1, flower.stemHeight, 1);
          setInstance(stems, flower.stemIndex, stemMid, stemRotation, flowerScaleVector);

          for (let leaf = 0; leaf < 2; leaf += 1) {
            const sign = leaf === 0 ? -1 : 1;
            leafOffset.set(sway * (leaf ? 0.44 : 0.62) + sign * 0.13, flower.stemHeight * (leaf ? 0.43 : 0.62), 0);
            leafPosition.copy(flower.position).add(leafOffset);
            leafEuler.set(0.05, flower.rotation + sign * 0.15, sign * 0.84);
            leafRotation.setFromEuler(leafEuler);
            flowerScaleVector.set(0.82, 1, 0.9);
            setInstance(leaves, flower.leafIndices[leaf], leafPosition, leafRotation, flowerScaleVector);
          }

          const bloomPosition = flower.position.clone().add(new THREE.Vector3(sway + (selected ? 0 : 0), flower.stemHeight + lift, 0));
          bloomRotation.setFromEuler(new THREE.Euler(0, flower.rotation + sway * 0.28, 0));
          const flowerScale = flower.scale * (selected ? 1.16 : inFocusGroup ? 1.07 : 1);
          bloomScale.set(flowerScale * flower.bloomWidth, flowerScale * flower.bloomHeight, flowerScale);
          reusableMatrix.compose(bloomPosition, bloomRotation, bloomScale);
          flower.bloomMesh.setMatrixAt(flower.bloomIndex, reusableMatrix);
          const centerSize = flower.profile === 'sunflower' ? 1 : flower.profile === 'daisy' ? 0.82 : flower.profile === 'cluster' ? 0.34 : 0.28;
          flowerScaleVector.setScalar(centerSize * flowerScale);
          setInstance(centers, flower.centerIndex, bloomPosition, bloomRotation, flowerScaleVector);
        }
        for (const mesh of renderers) if (mesh.instanceMatrix) mesh.instanceMatrix.needsUpdate = true;
      };

      let lastStatsAt = performance.now(); let frames = 0; let lastReducedFrameAt = 0;
      const measurementStartedAt = performance.now();
      const measureLocalRun = window.location.hostname === 'localhost';
      const animate = (time) => {
        frame = 0;
        if (!inViewport || document.hidden) return;
        if (reducedMotion && windRef.current > 0 && time - lastReducedFrameAt < 50) {
          frame = requestAnimationFrame(animate);
          return;
        }
        lastReducedFrameAt = time;
        if (!reducedMotion || windRef.current > 0 || (measureLocalRun && performance.now() - measurementStartedAt < 1200)) frame = requestAnimationFrame(animate);
        const target = MODES[modeRef.current] || MODES.day;
        const easing = reducedMotion ? 1 : 0.035;
        activeMode.skyTop.lerp(new THREE.Color(target.sky), easing);
        activeMode.skyHorizon.lerp(new THREE.Color(target.horizon), easing);
        activeMode.skyBottom.lerp(new THREE.Color(target.bottom), easing);
        activeMode.sun.lerp(new THREE.Color(target.sun), easing);
        activeMode.fog.lerp(new THREE.Color(target.horizon), easing);
        activeMode.ground.lerp(new THREE.Color(target.ground), easing);
        activeMode.sunIntensity = THREE.MathUtils.lerp(activeMode.sunIntensity, target.intensity, easing);
        activeMode.hemi = THREE.MathUtils.lerp(activeMode.hemi, target.hemi, easing);
        sky.material.uniforms.uTop.value.copy(activeMode.skyTop);
        sky.material.uniforms.uHorizon.value.copy(activeMode.skyHorizon);
        sky.material.uniforms.uBottom.value.copy(activeMode.skyBottom);
        scene.fog.color.copy(activeMode.fog); scene.fog.far = target.fog;
        ground.material.color.copy(activeMode.ground);
        sun.color.copy(activeMode.sun); sun.intensity = activeMode.sunIntensity;
        sun.position.lerp(SUN_POSITIONS[modeRef.current] || SUN_POSITIONS.day, easing);
        hemisphere.intensity = activeMode.hemi;
        const night = modeRef.current === 'night'; fireflies.visible = night;
        const sunset = modeRef.current === 'sunset';
        sunGlowMaterial.color.lerp(new THREE.Color(night ? '#aebfe8' : sunset ? '#ffd1aa' : '#fff4d7'), easing);
        sunGlowMaterial.opacity = night ? 0.2 : 0.76;
        cloudMaterial.color.lerp(new THREE.Color(night ? '#7789a5' : sunset ? '#f4c0ae' : '#fff9ef'), easing);
        cloudMaterial.opacity = night ? 0.14 : 0.42;
        bloomMaterial.emissiveIntensity = THREE.MathUtils.lerp(bloomMaterial.emissiveIntensity, night ? 0.22 : 0.025, easing);
        petalMaterial.opacity = 1;
        if (grassMaterial.userData.shader) {
          grassMaterial.userData.shader.uniforms.uGrassTime.value = time * 0.0006;
          grassMaterial.userData.shader.uniforms.uGrassWind.value = windPowerForShader();
        }
        if (!reducedMotion) {
          for (let i = 0; i < fireflies.userData.count; i += 1) {
            const phase = time * 0.00055 + i * 2.4;
            dummy.position.set(Math.sin(phase) * 5.2, 0.7 + (Math.sin(phase * 1.6) + 1) * 1.1, Math.cos(phase * 0.8) * 5.4);
            dummy.scale.setScalar(0.72 + (Math.sin(phase * 2) + 1) * 0.3); dummy.updateMatrix(); fireflies.setMatrixAt(i, dummy.matrix);
          }
          for (let i = 0; i < butterflyWings.userData.count; i += 1) {
            const phase = time * 0.001 + i * 1.3;
            dummy.position.set(Math.sin(phase) * 4.4, 1.6 + Math.sin(phase * 1.7) * 0.8, Math.cos(phase * 0.7) * 4.7);
            dummy.rotation.set(Math.sin(phase) * 0.4, phase * 0.18, Math.sin(phase * 9) * 0.35);
            dummy.scale.setScalar(0.7 + (i % 3) * 0.12); dummy.updateMatrix(); butterflyWings.setMatrixAt(i, dummy.matrix);
          }
          for (let i = 0; i < petalDrift.userData.count; i += 1) {
            const phase = time * 0.00018 + i * 1.7;
            dummy.position.set(Math.sin(phase) * 4.7, 0.45 + ((time * 0.00012 + i * 0.11) % 2.8), Math.cos(phase * 0.8) * 4.5);
            dummy.rotation.set(phase, 0, Math.sin(phase * 1.5) * 0.8); dummy.scale.setScalar(0.7 + (i % 4) * 0.12); dummy.updateMatrix(); petalDrift.setMatrixAt(i, dummy.matrix);
          }
          fireflies.instanceMatrix.needsUpdate = true; butterflyWings.instanceMatrix.needsUpdate = true; petalDrift.instanceMatrix.needsUpdate = true;
        }
        applyMatrices(time);
        if (cameraDestination) {
          camera.position.lerp(cameraDestination.position, reducedMotion ? 1 : 0.08);
          controlsRef.target.lerp(cameraDestination.target, reducedMotion ? 1 : 0.08);
          if (camera.position.distanceTo(cameraDestination.position) < 0.025) cameraDestination = null;
        }
        controlsRef.update();
        renderer.render(scene, camera);
        frames += 1;
        if (window.location.hostname === 'localhost' && performance.now() - lastStatsAt >= 700) {
          const elapsed = performance.now() - lastStatsAt;
          const stats = { fps: Math.round(frames * 1000 / elapsed), drawCalls: renderer.info.render.calls, pixelRatio: renderer.getPixelRatio(), flowers: flowers.length, grass: grassCount, mobile, shadows: renderer.shadowMap.enabled };
          host.dataset.gardenFps = String(stats.fps); host.dataset.gardenDrawCalls = String(stats.drawCalls);
          window.__garden3dStats = stats;
          frames = 0; lastStatsAt = performance.now();
        }
      };
      const schedule = () => { if (!frame && inViewport && !document.hidden) frame = requestAnimationFrame(animate); };
      if (reducedMotion) controlsRef.addEventListener('change', schedule);
      const viewportObserver = new IntersectionObserver(([entry]) => {
        inViewport = entry.isIntersecting;
        if (inViewport && !document.hidden) schedule(); else { cancelAnimationFrame(frame); frame = 0; }
      }, { threshold: 0 });
      viewportObserver.observe(host);
      const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else schedule(); };
      document.addEventListener('visibilitychange', onVisibility);
      sceneState.current = { camera, controls: controlsRef, flowers, bloomById, invalidate: schedule, setCamera: (flower) => {
        const target = flower.position.clone().add(new THREE.Vector3(0, flower.stemHeight * 0.7, 0));
        cameraDestination = { target, position: target.clone().add(new THREE.Vector3(0, 4.9, 9.8)) };
        schedule();
      }, reset: () => { cameraDestination = { target: new THREE.Vector3(0, 1.2, 0), position: new THREE.Vector3(0, 5.8, 15.7) }; schedule(); } };
      host.dataset.gardenDrawCalls = String(renderer.info.render.calls);
      host.dataset.gardenPixelRatio = String(renderer.getPixelRatio());
      if (window.location.hostname === 'localhost') window.__garden3dStats = { fps: 0, drawCalls: renderer.info.render.calls, pixelRatio: renderer.getPixelRatio(), flowers: flowers.length, grass: grassCount, mobile, shadows: renderer.shadowMap.enabled, renderer: 'full-catalogue' };
      schedule();

      function windPowerForShader() { return windRef.current * (reducedMotion ? 0.55 : 1); }

      return () => {
        cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', onVisibility);
        viewportObserver.disconnect(); resizeObserver.disconnect(); controlsRef.removeEventListener('change', schedule);
        renderer.domElement.removeEventListener('pointermove', onPointerMove); renderer.domElement.removeEventListener('click', onClick);
        controlsRef.dispose();
        scene.traverse((object) => {
          if (object.geometry) geometries.add(object.geometry);
          if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
          else if (object.material) materials.add(object.material);
        });
        geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose()); textures.forEach((texture) => texture.dispose());
        renderer.dispose(); renderer.domElement.remove();
        if (window.__garden3dStats) delete window.__garden3dStats;
        sceneState.current = null;
      };
    } catch (error) {
      console.error('Không thể dựng vườn 3D:', error); setUnavailable(true);
      renderer?.dispose(); renderer?.domElement.remove();
      return undefined;
    }
  }, [active]);

  useEffect(() => {
    if (previousSelectedId.current !== selectedId) {
      previousSelectedId.current = selectedId;
      sceneState.current?.setCamera(sceneState.current.flowers.find((flower) => flower.item.id === selectedId));
    }
  }, [selectedId]);
  useEffect(() => { sceneState.current?.invalidate(); }, [timeOfDay, wind]);
  useEffect(() => { if (sceneState.current) sceneState.current.reset(); }, [resetCamera]);

  return <div className={`garden3d-canvas${unavailable ? ' garden3d-canvas-unavailable' : ''}`} ref={containerRef}>
    {unavailable && <div className="garden3d-fallback"><b>Chưa thể dựng khu vườn 3D trên thiết bị này.</b><span>Danh mục hoa và các công cụ AI vẫn hoạt động bình thường.</span></div>}
    {!active && !unavailable && <div className="garden3d-fallback">Khu vườn sẽ xuất hiện khi bạn cuộn tới đây…</div>}
  </div>;
}
