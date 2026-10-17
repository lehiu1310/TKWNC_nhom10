import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import species from '../../../data/species.json';

const MODES = {
  day: { sky: '#d9e7e5', horizon: '#f5e9dc', ground: '#9cab8e', light: 1.35, ambient: 1.12, lamp: '#fff1dc' },
  sunset: { sky: '#9c8b9e', horizon: '#f0c6ad', ground: '#9b9d83', light: 1.15, ambient: 0.96, lamp: '#f4c29b' },
  night: { sky: '#29394c', horizon: '#7d8996', ground: '#697b70', light: 0.72, ambient: 0.82, lamp: '#b5c6db' },
};

function makeSkyTexture(top, horizon) {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(0.58, horizon);
  gradient.addColorStop(1, '#f8efd9');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}

const makeMaterial = (color, options = {}) => new THREE.MeshStandardMaterial({
  color, roughness: options.roughness ?? 0.78, metalness: options.metalness ?? 0.01,
  side: options.side ?? THREE.FrontSide, vertexColors: options.vertexColors ?? false,
});

function petalGeometry(length, width, baseColor, lightColor, bend = 0.12) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const indices = [];
  const base = new THREE.Color(baseColor);
  const light = new THREE.Color(lightColor);
  const rows = 14;
  const columns = 8;

  for (let row = 0; row <= rows; row += 1) {
    const t = row / rows;
    const taper = t < 0.12 ? t / 0.12 : t > 0.94 ? (1 - t) / 0.06 : 0.78 + 0.22 * Math.sin(Math.PI * (t - 0.12) / 0.82);
    const halfWidth = Math.max(0.002, width * Math.max(0, taper));
    const depth = bend * Math.sin(Math.PI * t);
    for (let column = 0; column <= columns; column += 1) {
      const across = (column / columns) * 2 - 1;
      positions.push(across * halfWidth, length * t, depth + (1 - across * across) * 0.035 * Math.sin(Math.PI * t));
      const mix = Math.min(0.4, 0.08 + t * 0.28 + Math.abs(across) * 0.06);
      const color = base.clone().lerp(light, mix);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function leafGeometry(length, width) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const indices = [];
  const rows = 10;
  const columns = 6;
  const dark = new THREE.Color('#66806b');
  const light = new THREE.Color('#aec09a');
  for (let row = 0; row <= rows; row += 1) {
    const t = row / rows;
    const halfWidth = width * Math.pow(Math.sin(Math.PI * t), 0.72);
    for (let column = 0; column <= columns; column += 1) {
      const across = (column / columns) * 2 - 1;
      const x = across * halfWidth;
      const y = length * t + (1 - Math.abs(across)) * 0.045 * Math.sin(Math.PI * t);
      const z = (1 - across * across) * 0.025 * Math.sin(Math.PI * t);
      positions.push(x, y, z);
      const color = dark.clone().lerp(light, 0.25 + t * 0.38 + (1 - Math.abs(across)) * 0.18);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function flowerPalette(item) {
  const id = `${item.id} ${item.name_en || ''} ${item.name_vi || ''}`.toLowerCase();
  const hash = [...id].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 7);
  const variation = (hash % 13) / 100;
  if (id.includes('daisy') || id.includes('oxeye')) return { petal: '#f5eee2', light: '#fffaf1', center: '#d6b46d', count: 18 + (hash % 13), type: 'daisy', length: 0.54 + variation, width: 0.055 + variation * 0.35 };
  if (id.includes('dandelion')) return { petal: '#d9bd70', light: '#efe0a5', center: '#c9a657', count: 25 + (hash % 17), type: 'dandelion', length: 0.41 + variation, width: 0.032 + variation * 0.18 };
  if (id.includes('sunflower')) return { petal: '#d8ae5f', light: '#eed28c', center: '#765947', count: 18 + (hash % 13), type: 'sunflower', length: 0.34 + variation, width: 0.085 + variation * 0.35 };
  if (id.includes('rose')) return { petal: '#bd7584', light: '#dfa4a8', center: '#985c6c', count: 18 + (hash % 13), type: 'rose', length: 0.34 + variation, width: 0.13 + variation * 0.4 };
  if (id.includes('tulip')) return { petal: '#c77f91', light: '#e6b0b8', center: '#d4bd82', count: 5 + (hash % 3), type: 'tulip', length: 0.55 + variation, width: 0.17 + variation * 0.4 };
  // Dataset accent colors often describe the card theme rather than the actual petals.
  // Give the wider catalogue a deliberate, varied garden palette while retaining its real labels.
  const palette = ['#e97b92', '#cd5f7c', '#ee967d', '#db7f67', '#e7a556', '#e6c15f', '#d5b253', '#efe0a8', '#b38fc9', '#9674b5', '#809cce', '#6eabb5', '#c47da8', '#db9daa', '#f0ac91', '#a36f93'];
  const petal = palette[hash % palette.length];
  const light = new THREE.Color(petal).lerp(new THREE.Color('#fff7ec'), 0.24).getStyle();
  const namedForms = [
    [/peony|dahlia|chrysanthemum|ranunculus|camellia/, 'dahlia'],
    [/hydrangea|lilac|phlox|verbena|cluster/, 'cluster'],
    [/lily|bluebell|campanula|foxglove|bellflower/, 'bell'],
    [/hibiscus|plumeria|frangipani|poppy|anemone/, 'poppy'],
    [/cosmos|marigold|aster|chamomile|gerbera/, 'cosmos'],
  ];
  const namedForm = namedForms.find(([pattern]) => pattern.test(id))?.[1];
  const forms = ['dahlia', 'cosmos', 'poppy', 'cluster', 'bell'];
  const centers = ['#9e795a', '#b58d65', '#8b695f', '#c4a66d', '#9d806b', '#b89477', '#9b8359', '#d2b975'];
  const type = namedForm || forms[hash % forms.length];
  const count = type === 'cluster' ? 3 + hash % 6 : type === 'poppy' ? 4 + hash % 3 : type === 'bell' ? 4 + hash % 5 : 8 + hash % 17;
  return { petal, light, center: centers[hash % centers.length], count, type, length: 0.34 + variation + (hash % 17) / 100, width: 0.06 + (hash % 15) / 100 };
}

function addPetalLayer(bloom, palette, count, length, width, z, rotation = 0, bend = 0.12) {
  const geometry = petalGeometry(length, width, palette.petal, palette.light, bend);
  const petalMat = makeMaterial('#ffffff', { vertexColors: true, side: THREE.DoubleSide, roughness: 0.54 });
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + rotation;
    const petal = new THREE.Mesh(geometry, petalMat);
    petal.rotation.z = angle;
    petal.position.z = z;
    petal.castShadow = true;
    petal.receiveShadow = true;
    bloom.add(petal);
  }
}

function makeFlower(item, index, position) {
  const root = new THREE.Group();
  root.userData.species = item;
  root.userData.windPhase = index * 0.63;
  root.position.set(position.x, 0, position.z);
  root.rotation.y = (index % 7 - 3) * 0.08;
  const palette = flowerPalette(item);
  const sizeSeed = [...String(item.id)].reduce((value, character) => (value * 33 + character.charCodeAt(0)) >>> 0, 5381);
  root.scale.setScalar(0.76 + (sizeSeed % 57) / 100);
  const stemPoints = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.02 * Math.sin(index), 0.48, 0),
    new THREE.Vector3(0.035 * Math.sin(index * 0.7), 1.02, 0),
    new THREE.Vector3(0, 1.52, 0),
  ];
  const stemCurve = new THREE.CatmullRomCurve3(stemPoints);
  const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 12, 0.032 + (index % 3) * 0.004, 7, false), makeMaterial('#47764b'));
  stem.castShadow = true;
  root.add(stem);
  for (let leafIndex = 0; leafIndex < 3; leafIndex += 1) {
    const side = leafIndex === 1 ? -1 : 1;
    const leaf = new THREE.Mesh(leafGeometry(0.48 + (leafIndex % 2) * 0.13, 0.15), makeMaterial('#ffffff', { vertexColors: true, side: THREE.DoubleSide, roughness: 0.66 }));
    leaf.position.set(side * (0.05 + (leafIndex === 2 ? 0.1 : 0)), 0.34 + leafIndex * 0.24, 0.005);
    leaf.rotation.z = side * (0.72 + leafIndex * 0.08);
    leaf.rotation.x = side * 0.12;
    leaf.castShadow = true;
    root.add(leaf);
    const vein = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(
      new THREE.Vector3(0, 0, 0.035), new THREE.Vector3(0, 0.41 + (leafIndex % 2) * 0.11, 0.035),
    ), 6, 0.008, 4, false), makeMaterial('#c0d590'));
    vein.position.copy(leaf.position);
    vein.rotation.copy(leaf.rotation);
    root.add(vein);
  }
  const bloom = new THREE.Group();
  bloom.position.set(0, 1.52, 0);
  if (palette.type === 'rose') {
    const outer = Math.round(palette.count * 0.4);
    const middle = Math.round(palette.count * 0.34);
    const inner = Math.max(5, palette.count - outer - middle);
    addPetalLayer(bloom, palette, outer, palette.length * 1.14, palette.width, -0.03, 0, 0.2);
    addPetalLayer(bloom, palette, middle, palette.length * 0.88, palette.width * 0.88, 0.025, Math.PI / outer, 0.23);
    addPetalLayer(bloom, palette, inner, palette.length * 0.6, palette.width * 0.7, 0.085, Math.PI / inner, 0.24);
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), makeMaterial(palette.center, { roughness: 0.46 }));
    heart.position.z = 0.14;
    heart.scale.set(0.95, 0.78, 0.72);
    bloom.add(heart);
  } else if (palette.type === 'tulip') {
    const petalsPerLayer = Math.ceil(palette.count / 2);
    addPetalLayer(bloom, palette, petalsPerLayer, palette.length, palette.width, 0.01, 0, 0.2);
    addPetalLayer(bloom, palette, petalsPerLayer, palette.length * 0.91, palette.width * 0.94, 0.035, Math.PI / petalsPerLayer, 0.23);
    bloom.rotation.x = -0.12;
  } else if (palette.type === 'daisy') {
    addPetalLayer(bloom, palette, palette.count, palette.length, palette.width, 0, 0, 0.12);
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12), makeMaterial(palette.center, { roughness: 0.75 }));
    center.position.z = 0.1;
    center.scale.set(1, 1, 0.42);
    bloom.add(center);
    for (let seed = 0; seed < 28; seed += 1) {
      const angle = seed * 2.4;
      const radius = 0.145 * Math.sqrt(seed / 28);
      const floret = new THREE.Mesh(new THREE.SphereGeometry(0.014, 5, 4), makeMaterial(seed % 3 ? '#f6d66b' : '#d99b2e'));
      floret.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.17);
      bloom.add(floret);
    }
  } else if (palette.type === 'dandelion') {
    addPetalLayer(bloom, palette, palette.count, palette.length, palette.width, 0, 0, 0.09);
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 10), makeMaterial(palette.center));
    center.position.z = 0.06;
    bloom.add(center);
  } else {
    const count = palette.count;
    if (palette.type === 'poppy' || palette.type === 'cosmos') {
      const petals = palette.count;
      addPetalLayer(bloom, palette, petals, palette.length, palette.type === 'poppy' ? palette.width * 2.8 : palette.width, -0.02, 0.12, 0.2);
      const center = new THREE.Mesh(new THREE.SphereGeometry(palette.type === 'poppy' ? 0.16 : 0.12, 14, 10), makeMaterial(palette.center));
      center.position.z = 0.12;
      center.scale.set(1, 1, 0.55);
      bloom.add(center);
      if (palette.type === 'poppy') {
        const capsule = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.1, 12), makeMaterial('#587344'));
        capsule.position.set(0, 0, 0.2);
        bloom.add(capsule);
      }
    } else if (palette.type === 'cluster') {
      for (let head = 0; head < palette.count; head += 1) {
        const angle = (head / palette.count) * Math.PI * 2;
        const mini = new THREE.Group();
        mini.position.set(Math.cos(angle) * 0.18, Math.sin(angle) * 0.18, head % 2 ? 0.08 : 0);
        addPetalLayer(mini, palette, 5 + (head % 3), palette.length * 0.54, palette.width * 0.72, 0, 0, 0.13);
        mini.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), makeMaterial(palette.center)));
        bloom.add(mini);
      }
    } else if (palette.type === 'bell') {
      addPetalLayer(bloom, palette, palette.count, palette.length, palette.width, 0, Math.PI / palette.count, 0.2);
      const throat = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 9), makeMaterial(palette.center));
      throat.position.set(0, -0.02, 0.12);
      bloom.add(throat);
    } else if (palette.type === 'dahlia') {
      const outer = Math.round(palette.count * 0.56);
      addPetalLayer(bloom, palette, outer, palette.length, palette.width, -0.02, 0, 0.18);
      addPetalLayer(bloom, palette, palette.count - outer, palette.length * 0.72, palette.width * 0.84, 0.035, Math.PI / outer, 0.21);
    } else {
      addPetalLayer(bloom, palette, count, 0.51, 0.14, 0, 0, 0.15);
    }
    if (palette.type === 'sunflower') addPetalLayer(bloom, palette, Math.round(count * 0.72), 0.43, 0.105, 0.035, Math.PI / count, 0.17);
    if (palette.type === 'sunflower' || palette.type === 'dahlia') {
      const radius = palette.type === 'sunflower' ? 0.22 : 0.12;
      const center = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), makeMaterial(palette.center, { roughness: 0.78 }));
      center.position.z = 0.09;
      center.scale.set(1, 1, 0.48);
      bloom.add(center);
      if (palette.type === 'sunflower') {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.018, 6, 32), makeMaterial('#f1ca68', { roughness: 0.62 }));
        rim.position.z = 0.105;
        bloom.add(rim);
      }
    }
    if (palette.type === 'sunflower') {
      const seeds = new THREE.Group();
      for (let seed = 0; seed < 36; seed += 1) {
        const angle = seed * 2.399;
        const radius = 0.2 * Math.sqrt(seed / 36);
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 5, 4), makeMaterial(seed % 2 ? '#493126' : '#8a5b36', { roughness: 0.9 }));
        dot.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.112);
        seeds.add(dot);
      }
      bloom.add(seeds);
    }
  }
  root.add(bloom);
  root.userData.bloom = bloom;
  return root;
}

function makeRibbon(points, width, color, y = 0) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(point[0], y, point[1])));
  const samples = curve.getPoints(90);
  const positions = [];
  const indices = [];
  samples.forEach((point, index) => {
    const tangent = curve.getTangent(index / (samples.length - 1));
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(width / 2);
    positions.push(point.x + side.x, y, point.z + side.z, point.x - side.x, y, point.z - side.z);
    if (index < samples.length - 1) {
      const a = index * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, makeMaterial(color, { roughness: 0.96, side: THREE.DoubleSide }));
}

function addGardenDecor(scene) {
  const bark = makeMaterial('#9a826d');
  const barkLight = makeMaterial('#b39b80');
  const leafDark = makeMaterial('#718a73');
  const leafLight = makeMaterial('#9eae8b');

  // A quiet, arched trellis gives the garden a distant focal point.
  for (const x of [-2.8, 2.8]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 3.4, 10), bark);
    post.position.set(x, 1.68, -5.45);
    post.castShadow = true;
    scene.add(post);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.22, 12), barkLight);
    foot.position.set(x, 0.13, -5.45);
    scene.add(foot);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.75, 10), barkLight);
  beam.rotation.z = Math.PI / 2;
  beam.position.set(0, 3.34, -5.45);
  beam.castShadow = true;
  scene.add(beam);
  for (let i = 0; i < 9; i += 1) {
    const slat = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.35, 6), bark);
    slat.rotation.z = Math.PI / 2;
    slat.position.set(-2.4 + i * 0.6, 3.05, -5.45);
    scene.add(slat);
  }
  for (let vine = 0; vine < 4; vine += 1) {
    const x = -2.65 + vine * 1.75;
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 0.3, -5.3), new THREE.Vector3(x + 0.15, 1.2, -5.35),
      new THREE.Vector3(x - 0.1, 2.15, -5.4), new THREE.Vector3(x + (vine % 2 ? 0.35 : -0.35), 3.1, -5.4),
    ]);
    const strand = new THREE.Mesh(new THREE.TubeGeometry(path, 18, 0.026, 5, false), leafDark);
    scene.add(strand);
    for (let leafIndex = 0; leafIndex < 5; leafIndex += 1) {
      const t = 0.22 + leafIndex * 0.14;
      const point = path.getPoint(t);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), leafIndex % 2 ? leafLight : leafDark);
      leaf.scale.set(1.6, 0.38, 0.75);
      leaf.rotation.z = leafIndex % 2 ? -0.55 : 0.55;
      leaf.position.copy(point);
      leaf.position.x += leafIndex % 2 ? 0.16 : -0.16;
      scene.add(leaf);
    }
  }

  // Soft low shrubs and rounded stones frame the edges without competing with the flowers.
  for (let i = 0; i < 12; i += 1) {
    const side = i % 2 ? 1 : -1;
    const z = -4.6 + Math.floor(i / 2) * 1.7;
    const x = side * (6.25 + (i % 3) * 0.22);
    const bush = new THREE.Group();
    bush.position.set(x, 0, z);
    for (let lobe = 0; lobe < 3; lobe += 1) {
      const globe = new THREE.Mesh(new THREE.IcosahedronGeometry(0.58 + (lobe % 2) * 0.1, 1), lobe === 1 ? leafLight : leafDark);
      globe.position.set((lobe - 1) * 0.34, 0.54 + (lobe === 1 ? 0.28 : 0), (lobe % 2) * 0.12);
      globe.scale.set(1.02, 0.82, 0.92);
      globe.castShadow = true;
      globe.receiveShadow = true;
      bush.add(globe);
    }
    scene.add(bush);
  }
  for (let i = 0; i < 13; i += 1) {
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + (i % 3) * 0.035, 0), makeMaterial(i % 2 ? '#d4c4a1' : '#c9bb9e', { roughness: 1 }));
    stone.scale.set(1.45, 0.45, 1);
    stone.position.set(Math.sin(i * 1.8) * 6.5, 0.04, -4.2 + i * 0.68);
    stone.rotation.y = i * 0.43;
    stone.castShadow = true;
    stone.receiveShadow = true;
    scene.add(stone);
  }
}

export default function GardenCanvas({ selectedId, timeOfDay, wind, resetCamera, onSelectSpecies }) {
  const containerRef = useRef(null);
  const sceneState = useRef(null);
  const windRef = useRef(wind);
  const [unavailable, setUnavailable] = useState(false);
  const [activated, setActivated] = useState(false);
  useEffect(() => { windRef.current = wind; }, [wind]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    container.dataset.gardenRenderer = 'compact-fallback';
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setActivated(true);
        observer.disconnect();
      }
    }, { rootMargin: '0px 0px 0px 0px', threshold: 0.05 });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!activated) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;
    let renderer;
    let controls;
    let frame = 0;
    let observer;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new THREE.Scene();
    const initialSky = makeSkyTexture(MODES.day.sky, MODES.day.horizon);
    scene.background = initialSky;
    scene.fog = new THREE.Fog(MODES.day.sky, 13, 28);
    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100);
    camera.position.set(0, 5.9, 13.8);
    const flowers = [];
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set([initialSky]);
    let inViewport = true;
    let visible = !document.hidden;

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
      const isMobile = window.matchMedia('(max-width: 767px)').matches || window.matchMedia('(pointer: coarse)').matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.92;
      renderer.shadowMap.enabled = !reduceMotion;
      renderer.shadowMap.type = isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
      renderer.domElement.setAttribute('aria-label', 'Khu vườn hoa 3D tương tác');
      container.appendChild(renderer.domElement);

      const ambient = new THREE.HemisphereLight('#edf4f2', '#75806c', MODES.day.ambient);
      scene.add(ambient);
      const fill = new THREE.AmbientLight('#fff7ed', 0.24);
      scene.add(fill);
      const sun = new THREE.DirectionalLight(MODES.day.lamp, MODES.day.light);
      sun.position.set(-6, 12, 8);
      sun.castShadow = renderer.shadowMap.enabled;
      sun.shadow.mapSize.set(1024, 1024);
      if (isMobile) sun.shadow.mapSize.set(512, 512);
      sun.shadow.camera.near = 0.5;
      sun.shadow.camera.far = 34;
      sun.shadow.camera.left = -10;
      sun.shadow.camera.right = 10;
      sun.shadow.camera.top = 10;
      sun.shadow.camera.bottom = -10;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.025;
      sun.shadow.radius = isMobile ? 1 : 3;
      scene.add(sun);

      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(10.2, 10.4, 0.32, 96), makeMaterial('#d8cbbb', { roughness: 0.9 }));
      plinth.position.y = -0.26;
      plinth.receiveShadow = true;
      plinth.castShadow = true;
      scene.add(plinth);
      const ground = new THREE.Mesh(new THREE.CircleGeometry(10, 96), makeMaterial(MODES.day.ground, { roughness: 0.98 }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.08;
      ground.receiveShadow = true;
      scene.add(ground);

      const path = makeRibbon([[-0.25, 7.8], [0.18, 4.7], [-0.12, 2.0], [0.22, -1.4], [-0.1, -4.2], [0, -7.5]], 1.55, '#d8c39b', -0.055);
      path.receiveShadow = true;
      scene.add(path);
      const pathSeam = makeRibbon([[-0.25, 7.8], [0.18, 4.7], [-0.12, 2.0], [0.22, -1.4], [-0.1, -4.2], [0, -7.5]], 0.055, '#f0dfbe', -0.047);
      scene.add(pathSeam);

      // Two long, softly raised beds make a clear path through the flowers.
      for (const side of [-1, 1]) {
        for (let row = 0; row < 3; row += 1) {
          const bed = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.18, 8.6), makeMaterial(row % 2 ? '#a18d76' : '#b19a7e', { roughness: 0.9 }));
          bed.position.set(side * (1.55 + row * 1.05), 0.02, -0.05 + row * 0.08);
          bed.rotation.y = side * -0.015;
          bed.castShadow = true;
          bed.receiveShadow = true;
          scene.add(bed);
          const soil = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.08, 8.48), makeMaterial('#75685b', { roughness: 1 }));
          soil.position.set(bed.position.x, 0.13, bed.position.z);
          scene.add(soil);
        }
      }

      addGardenDecor(scene);

      // A representative sample keeps WebGL light while the selector still uses the full catalogue.
      const plantCount = Math.min(24, species.length);
  const gardenSpecies = Array.from({ length: plantCount }, (_, index) => species[
        Math.round(index * (species.length - 1) / Math.max(1, plantCount - 1))
      ]).sort((a, b) => {
        const hueA = new THREE.Color(flowerPalette(a).petal).getHSL({ h: 0, s: 0, l: 0 }).h;
        const hueB = new THREE.Color(flowerPalette(b).petal).getHSL({ h: 0, s: 0, l: 0 }).h;
        return hueA - hueB;
      });
      gardenSpecies.forEach((item, index) => {
        const row = Math.floor(index / 2);
        const side = index % 2 ? 1 : -1;
        const bedRow = Math.floor(row / 6);
        const position = {
          x: side * (1.45 + bedRow * 1.04 + (row % 2) * 0.1),
          z: -3.6 + (row % 6) * 1.35 + (side > 0 ? 0.22 : 0),
        };
        const flower = makeFlower(item, index, position);
        flowers.push(flower);
        scene.add(flower);
      });

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.065;
      controls.minDistance = 8;
      controls.maxDistance = 20;
      controls.maxPolarAngle = Math.PI * 0.48;
      controls.minPolarAngle = Math.PI * 0.19;
      controls.target.set(0, 1.85, -0.1);
      controls.update();

      const resize = () => {
        const width = Math.max(1, container.clientWidth);
        const height = Math.max(1, container.clientHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        if (visible && inViewport) renderer.render(scene, camera);
      };
      observer = new ResizeObserver(resize);
      observer.observe(container);
      resize();

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      if (window.location.hostname === 'localhost') {
        window.__garden3dStats = {
          fps: null,
          drawCalls: renderer.info.render.calls,
          pixelRatio: renderer.getPixelRatio(),
          shadowMap: renderer.shadowMap.enabled,
          active: visible && inViewport,
        };
      }
      let downPoint = null;
      const onDown = (event) => { downPoint = [event.clientX, event.clientY]; };
      const onClick = (event) => {
        if (downPoint && Math.hypot(event.clientX - downPoint[0], event.clientY - downPoint[1]) > 5) return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(flowers, true)[0];
        if (!hit) return;
        let target = hit.object;
        while (target && !target.userData.species) target = target.parent;
        if (target?.userData.species) onSelectSpecies(target.userData.species);
      };
      renderer.domElement.addEventListener('pointerdown', onDown);
      renderer.domElement.addEventListener('click', onClick);

      const onVisibility = () => {
        visible = !document.hidden;
        if (visible && inViewport) scheduleFrame();
        else { cancelAnimationFrame(frame); frame = 0; }
      };
      document.addEventListener('visibilitychange', onVisibility);
      let lastStatsAt = performance.now();
      let framesSinceStats = 0;
      let lastReducedRenderAt = 0;
      const animate = (time) => {
        if (!visible || !inViewport) { frame = 0; return; }
        frame = requestAnimationFrame(animate);
        if (reduceMotion && time - lastReducedRenderAt < 50) return;
        lastReducedRenderAt = time;
        // Keep a soft breeze even when reduced motion is requested; other
        // ambient effects stay disabled and the scene updates at 20fps max.
        const strength = windRef.current * (reduceMotion ? 0.55 : 1);
        for (const flower of flowers) {
          flower.rotation.z = Math.sin(time * 0.0005 + flower.userData.windPhase) * strength * 0.12;
          flower.userData.bloom.rotation.y = Math.sin(time * 0.00068 + flower.userData.windPhase) * strength * 0.08;
        }
        controls.update();
        renderer.render(scene, camera);
        framesSinceStats += 1;
        if (window.location.hostname === 'localhost' && performance.now() - lastStatsAt >= 500) {
          const elapsed = performance.now() - lastStatsAt;
          window.__garden3dStats = {
            fps: Math.round(framesSinceStats * 1000 / elapsed),
            drawCalls: renderer.info.render.calls,
            pixelRatio: renderer.getPixelRatio(),
            shadowMap: renderer.shadowMap.enabled,
          };
          container.dataset.gardenFps = String(window.__garden3dStats.fps);
          container.dataset.gardenDrawCalls = String(window.__garden3dStats.drawCalls);
          framesSinceStats = 0;
          lastStatsAt = performance.now();
        }
      };
      const scheduleFrame = () => {
        if (!frame && visible && inViewport) frame = requestAnimationFrame(animate);
      };
      const viewportObserver = new IntersectionObserver(([entry]) => {
        inViewport = entry.isIntersecting;
        if (window.__garden3dStats) window.__garden3dStats.active = inViewport && !document.hidden;
        if (inViewport && !document.hidden) scheduleFrame();
        else { cancelAnimationFrame(frame); frame = 0; }
      }, { threshold: 0 });
      viewportObserver.observe(container);
      scheduleFrame();
      sceneState.current = { scene, sun, ambient, ground, renderer, camera, controls, flowers, textures, isMobile };
      container.dataset.gardenDrawCalls = String(renderer.info.render.calls);
      container.dataset.gardenPixelRatio = String(renderer.getPixelRatio());
      if (window.location.hostname === 'localhost') {
        window.__garden3dStats = { fps: 0, drawCalls: renderer.info.render.calls, pixelRatio: renderer.getPixelRatio(), shadowMap: renderer.shadowMap.enabled, active: visible && inViewport };
      }

      return () => {
        cancelAnimationFrame(frame);
        flowers.forEach((flower) => { flower.userData.disposed = true; });
        document.removeEventListener('visibilitychange', onVisibility);
        renderer.domElement.removeEventListener('pointerdown', onDown);
        renderer.domElement.removeEventListener('click', onClick);
        observer?.disconnect();
        viewportObserver.disconnect();
        controls.dispose();
        scene.traverse((object) => {
          if (!object.isMesh) return;
          geometries.add(object.geometry);
          if (Array.isArray(object.material)) object.material.forEach((entry) => { materials.add(entry); if (entry.map) textures.add(entry.map); });
          else { materials.add(object.material); if (object.material.map) textures.add(object.material.map); }
        });
        scene.traverse((object) => {
          if (!object.isSprite || !object.material) return;
          materials.add(object.material);
          if (object.material.map) textures.add(object.material.map);
        });
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((entry) => entry.dispose());
        textures.forEach((texture) => texture.dispose());
        renderer.dispose();
        if (window.__garden3dStats) delete window.__garden3dStats;
        renderer.domElement.remove();
        sceneState.current = null;
      };
    } catch (error) {
      console.error('Không thể dựng khu vườn WebGL:', error);
      setUnavailable(true);
      renderer?.dispose();
      renderer?.domElement.remove();
      return undefined;
    }
  }, [activated]);

  useEffect(() => {
    const current = sceneState.current;
    if (!current) return;
    const mode = MODES[timeOfDay] || MODES.day;
    const nextSky = makeSkyTexture(mode.sky, mode.horizon);
    if (current.scene.background?.isTexture) current.scene.background.dispose();
    current.scene.background = nextSky;
    current.textures.add(nextSky);
    current.scene.fog.color.set(mode.sky);
    current.ground.material.color.set(mode.ground);
    current.sun.color.set(mode.lamp);
    current.sun.intensity = mode.light;
    current.ambient.intensity = mode.ambient;
  }, [timeOfDay]);

  useEffect(() => {
    const current = sceneState.current;
    if (!current) return;
    const focus = current.flowers.find((flower) => flower.userData.species.id === selectedId);
    if (focus) current.controls.target.copy(focus.position.clone().add(new THREE.Vector3(0, 1.1, 0)));
  }, [selectedId]);

  useEffect(() => { sceneState.current?.controls.reset(); }, [resetCamera]);

  return <div className={`garden3d-canvas${unavailable ? ' garden3d-canvas-unavailable' : ''}`} ref={containerRef}>
    {unavailable && <div className="garden3d-fallback"><b>Thiết bị chưa hỗ trợ WebGL.</b><span>Danh mục hoa và bốn công cụ AI vẫn hoạt động bình thường.</span></div>}
    {!activated && !unavailable && <div className="garden3d-fallback">Khu vườn sẽ xuất hiện khi bạn cuộn tới đây…</div>}
  </div>;
}
