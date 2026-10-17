import * as THREE from 'three';
import { getPetalSurfaceMaps } from './petalSurface.js';

const tracked = (root, geometry, material) => {
  if (geometry) root.userData.geometries.push(geometry);
  if (material) root.userData.materials.add(material);
};

function makePetalGeometry({ length, width, shape = 'round', tipShape, baseColor, edgeColor, curl = 0.15, wave = 0.025, trueDaisy = false }) {
  // A denser shared petal mesh removes the visibly polygonal edges without
  // multiplying draw calls: every petal in a layer still shares one geometry.
  // Preserve the approved Daisy mesh exactly; use a lower-cost smooth grid for
  // the other templates while staying above the required 24 x 12 minimum.
  const rows = trueDaisy ? 40 : 28; const cols = trueDaisy ? 22 : 14;
  const positions = []; const colors = []; const uvs = []; const indices = [];
  for (let i = 0; i <= rows; i += 1) {
    const t = i / rows;
    for (let j = 0; j <= cols; j += 1) {
      const v = j / cols * 2 - 1;
      const startTaper = 0.12 + 0.88 * THREE.MathUtils.smoothstep(t, 0, 0.18);
      const tipProgress = THREE.MathUtils.clamp((t - 0.7) / 0.3, 0, 1);
      // A quarter-ellipse taper gives daisy rays a rounded distal silhouette
      // instead of a chopped rectangle or a needle-like triangle.
      const roundedTip = trueDaisy || tipShape === 'spatulate' || tipShape === 'round'
        ? Math.sqrt(Math.max(0, 1 - Math.pow(THREE.MathUtils.clamp((t - 0.78) / 0.22, 0, 1), 2)))
        : tipShape === 'pointed' ? Math.max(0.025, 1 - tipProgress)
          : Math.sqrt(Math.max(0, 1 - tipProgress * tipProgress));
      const fullness = trueDaisy
        ? startTaper * roundedTip
        : shape === 'daisy' || shape === 'ray'
          ? startTaper * roundedTip
        : startTaper * (1 - 0.32 * THREE.MathUtils.smoothstep(t, 0.78, 1));
      const tipRound = shape === 'daisy' || shape === 'ray' ? 1 : 1 - 0.12 * THREE.MathUtils.smoothstep(t, 0.88, 1);
      // Gentle, irregular margins and a slight off-centre ridge keep the petals
      // from reading as identical plastic paddles while retaining one shared mesh.
      const edgeWave = trueDaisy ? 0 : shape === 'dahlia'
        ? Math.cos(v * Math.PI * 4 + t * 1.8) * wave * 0.38
        : Math.sin(v * Math.PI * 2 + t * 2.1) * wave * 0.68;
      const scallop = edgeWave * Math.abs(v) * t;
      const x = v * width * fullness * tipRound + scallop + Math.sin(t * Math.PI * 1.4) * v * width * 0.05;
      let z = t * length + width * (trueDaisy ? 0.14 : 0.88) * (1 - v * v) * THREE.MathUtils.smoothstep(t, 0.66, 1)
        + Math.sin(v * Math.PI * 3 + t * 5) * wave * 0.2 * Math.sin(Math.PI * t);
      if (shape === 'tulip') z = length * (t - 0.12 * Math.sin(Math.PI * t));
      const y = (1 - v * v) * (0.045 + curl * t) + Math.pow(Math.abs(v), 3) * curl * t * 0.2
        + Math.sin(v * Math.PI * 3 + t * 4) * wave * 0.22 * Math.sin(Math.PI * t);
      positions.push(x, y, z);
      const base = new THREE.Color(baseColor || (trueDaisy ? '#f7f5df' : shape === 'daisy' || shape === 'ray' ? '#f2dfbd' : '#f5e7dc'));
      const tip = new THREE.Color(edgeColor || (trueDaisy ? '#fffdf8' : shape === 'daisy' || shape === 'ray' ? '#fffdf8' : '#fffaf1'));
      const color = base.lerp(tip, 0.18 + 0.7 * t).lerp(new THREE.Color('#ffffff'), Math.pow(Math.abs(v), 5) * 0.055);
      colors.push(color.r, color.g, color.b);
      uvs.push(t, j / cols);
    }
  }
  for (let i = 0; i < rows; i += 1) for (let j = 0; j < cols; j += 1) {
    const a = i * (cols + 1) + j; const b = a + cols + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  // Thin, softly curved laminae read more naturally than the hard stitched
  // edges of a closed shell on every instanced petal.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function addStem(root, config, plant = root) {
  const material = new THREE.MeshStandardMaterial({ color: config.stem || '#66845c', roughness: 0.68 });
  const daisy = config.id === 'daisy';
  const endY = config.headY || (daisy ? 3.35 : 2.48);
  const stemScale = daisy ? 1 : (endY - 0.92) / (2.48 - 0.92);
  const curve = new THREE.CatmullRomCurve3(daisy ? [
    new THREE.Vector3(0, 0.92, 0), new THREE.Vector3((config.bend || -0.13) * 0.34, 1.55, 0),
    new THREE.Vector3((config.bend || -0.13) * 0.72, 2.48, 0), new THREE.Vector3(config.headLeanX || -0.13, endY, 0),
  ] : [
    new THREE.Vector3(0, 0.92, 0), new THREE.Vector3(config.bend || -0.06, 0.92 + 0.44 * stemScale, 0.02),
    new THREE.Vector3((config.bend || -0.06) * -0.35, 0.92 + 1.03 * stemScale, -0.03), new THREE.Vector3(0, endY, 0),
  ]);
  let geometry;
  if (config.id === 'daisy') {
    const segments = 36; const radialSegments = 12; const frames = curve.computeFrenetFrames(segments, false); const vertices = []; const indices = [];
    for (let row = 0; row <= segments; row += 1) {
      const t = row / segments; const point = curve.getPointAt(t); const radius = (config.stemRadius || 0.035) * (daisy ? 1 - 0.34 * t : 0.72 + 0.28 * (1 - t));
      for (let side = 0; side <= radialSegments; side += 1) {
        const angle = side / radialSegments * Math.PI * 2; const ridge = 1 + Math.sin(angle * 7 + t * 9) * 0.009;
        const offset = frames.normals[row].clone().multiplyScalar(Math.cos(angle) * radius * ridge).addScaledVector(frames.binormals[row], Math.sin(angle) * radius * ridge);
        vertices.push(point.x + offset.x, point.y + offset.y, point.z + offset.z);
      }
    }
    for (let row = 0; row < segments; row += 1) for (let side = 0; side < radialSegments; side += 1) {
      const a = row * (radialSegments + 1) + side; const b = a + radialSegments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  } else geometry = new THREE.TubeGeometry(curve, 32, config.stemRadius || 0.045, 9, false);
  const stem = new THREE.Mesh(geometry, material); stem.castShadow = true; plant.add(stem);
  tracked(root, geometry, material); root.userData.windMaterials.push(material);
  return curve;
}

function addLeaves(root, config, plant = root) {
  const material = new THREE.MeshStandardMaterial({ color: config.leaf || '#648458', roughness: 0.77, side: THREE.DoubleSide });
  const veinMaterial = new THREE.LineBasicMaterial({ color: '#91a67c', transparent: true, opacity: 0.52 });
  for (let i = 0; i < (config.leaves || 3); i += 1) {
    const length = (config.leafLength || 0.82) * (1 - (i % 2) * 0.13);
    // A leaf is a shallow, cambered surface rather than a flat cut-out. The
    // raised midrib and softly tapered tip catch the fill light like foliage.
    const rows = 24; const cols = 12; const width = config.leafWidth || 0.2;
    const positions = []; const uvs = []; const indices = [];
    for (let row = 0; row <= rows; row += 1) {
      const t = row / rows;
      const serration = config.id === 'daisy' ? 1 + Math.sin(t * 42) * 0.014 * THREE.MathUtils.smoothstep(t, 0.08, 0.24) * (1 - THREE.MathUtils.smoothstep(t, 0.8, 0.98)) : 1;
      const lobes = config.leafLobes && config.id === 'daisy'
        ? 0.82 + 0.18 * Math.pow(Math.abs(Math.cos(t * Math.PI * 3)), 1.2)
        : 1;
      const profile = Math.pow(Math.sin(Math.PI * t), 0.78) * (0.88 + 0.12 * t) * serration * lobes;
      for (let col = 0; col <= cols; col += 1) {
        const across = col / cols * 2 - 1;
        const x = across * width * profile + Math.sin(t * Math.PI) * 0.035;
        const y = t * length;
        const z = (config.id === 'daisy' ? 0.026 : 0.065) * Math.sin(Math.PI * t) * (1 - across * across) + (config.id === 'daisy' ? 0.006 : 0.018) * across * Math.sin(Math.PI * t);
        positions.push(x, y, z); uvs.push(col / cols, t);
      }
    }
    for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
      const a = row * (cols + 1) + col; const b = a + cols + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const leaf = new THREE.Mesh(geometry, material);
    const side = i % 2 ? 1 : -1;
    const daisyOffsets = [[0, 0.97, 0], [0, 0.99, 0], [0, 1.01, 0], [0, 1.03, 0]];
    leaf.position.set(
      config.id === 'daisy' ? daisyOffsets[i][0] : side * (0.1 + (i % 3) * 0.045),
      config.id === 'daisy' ? daisyOffsets[i][1] : 1.08 + i * 0.35,
      config.id === 'daisy' ? daisyOffsets[i][2] : 0,
    );
    if (config.id === 'daisy') {
      // Three compact, shallow-lobed leaves fan from the stem base while
      // staying inside the pot rim. Mostly radial tilt prevents a crumpled rosette.
      leaf.rotation.set(-0.08, i * Math.PI / 2, 1.05 + (i % 2) * 0.08);
    } else leaf.rotation.set(-0.18, i * 1.85, side * (0.72 + (i % 2) * 0.2));
    leaf.castShadow = true; plant.add(leaf); tracked(root, geometry);
    const veinPoints = [];
    const surfaceZ = (t, across) => (config.id === 'daisy' ? 0.026 : 0.065) * Math.sin(Math.PI * t) * (1 - across * across) + (config.id === 'daisy' ? 0.006 : 0.018) * across * Math.sin(Math.PI * t) + 0.004;
    for (let point = 0; point <= 12; point += 1) {
      const t = 0.04 + point / 12 * 0.9;
      veinPoints.push(new THREE.Vector3(Math.sin(t * Math.PI) * 0.035, t * length, surfaceZ(t, 0) + 0.012));
    }
    const branchPoints = [];
    for (let branch = 1; branch <= 3; branch += 1) {
      const t = branch * 0.21;
      for (const side of [-1, 1]) {
        const across = side * 0.72;
        branchPoints.push(
          new THREE.Vector3(Math.sin(t * Math.PI) * 0.035, t * length, surfaceZ(t, 0) + 0.012),
          new THREE.Vector3(across * width * Math.pow(Math.sin(Math.PI * Math.min(t + 0.13, 0.96)), 0.78) + Math.sin((t + 0.13) * Math.PI) * 0.035, (t + 0.13) * length, surfaceZ(t + 0.13, across) + 0.012),
        );
      }
    }
    const veinGeometry = new THREE.BufferGeometry().setFromPoints(veinPoints);
    const vein = new THREE.Line(veinGeometry, veinMaterial); leaf.add(vein); tracked(root, veinGeometry, veinMaterial);
    const branchGeometry = new THREE.BufferGeometry().setFromPoints(branchPoints);
    const branches = new THREE.LineSegments(branchGeometry, veinMaterial); leaf.add(branches); tracked(root, branchGeometry);
  }
}

function addPot(root) {
  const potMaterial = new THREE.MeshPhysicalMaterial({ color: '#caa890', roughness: 0.26, clearcoat: 0.62, clearcoatRoughness: 0.24 });
  const points = [new THREE.Vector2(0.47, 0.08), new THREE.Vector2(0.65, 0.13), new THREE.Vector2(0.74, 0.93), new THREE.Vector2(0.69, 1.0), new THREE.Vector2(0.59, 0.96), new THREE.Vector2(0.58, 0.88)];
  const potGeometry = new THREE.LatheGeometry(points, 56); const pot = new THREE.Mesh(potGeometry, potMaterial); pot.castShadow = pot.receiveShadow = true; root.add(pot); tracked(root, potGeometry, potMaterial);
  const rimGeometry = new THREE.TorusGeometry(0.67, 0.058, 12, 64); const rim = new THREE.Mesh(rimGeometry, potMaterial); rim.rotation.x = Math.PI / 2; rim.position.y = 0.95; root.add(rim); tracked(root, rimGeometry);
  const soilGeometry = new THREE.CylinderGeometry(0.58, 0.58, 0.055, 40); const soilMaterial = new THREE.MeshStandardMaterial({ color: '#594a3a', roughness: 1 }); const soil = new THREE.Mesh(soilGeometry, soilMaterial); soil.position.y = 0.9; root.add(soil); tracked(root, soilGeometry, soilMaterial);
  const saucerGeometry = new THREE.CylinderGeometry(0.8, 0.73, 0.11, 44); const saucer = new THREE.Mesh(saucerGeometry, potMaterial); saucer.position.y = -0.025; root.add(saucer); tracked(root, saucerGeometry);
}

function addFlowerHead(root, config, initialOpen, plant = root) {
  // Petals are soft and matte in real light; low roughness was making them
  // look like glossy molded plastic under the studio lights.
  const isDaisy = config.id === 'daisy';
  const layers = []; const petalMaterial = isDaisy ? new THREE.MeshPhysicalMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 0.76, metalness: 0,
    sheen: 0.18, sheenColor: '#fff7e9', transmission: 0.012, thickness: 0.08,
    ...getPetalSurfaceMaps(), bumpScale: 0.003,
  }) : new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 0.96, metalness: 0,
    ...getPetalSurfaceMaps(), bumpScale: 0.009,
  });
  if (isDaisy) {
    petalMaterial.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.90, 0.96, 0.94), 0.12);',
      );
    };
    petalMaterial.customProgramCacheKey = () => 'daisy-petal-soft-underside-v2';
  } else if (config.undersideColor) {
    const underside = new THREE.Color(config.undersideColor);
    const undersideRgb = [underside.r, underside.g, underside.b].map((channel) => channel.toFixed(3)).join(', ');
    petalMaterial.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${undersideRgb}), 0.24);`,
      );
    };
    petalMaterial.customProgramCacheKey = () => `flower-underside-${config.undersideColor}`;
  }
  const centerMaterial = isDaisy
    ? new THREE.MeshPhysicalMaterial({ color: config.center || '#f2c844', roughness: 0.74, sheen: 0.16 })
    : new THREE.MeshStandardMaterial({ color: config.center || '#c38c37', roughness: 0.72 });
  const flowerParent = new THREE.Group();
  const headY = isDaisy ? 0 : (config.headY ?? 2.52);
  if (isDaisy) {
    flowerParent.position.set(config.headLeanX || -0.13, config.headY || 3.35, 0);
    flowerParent.scale.setScalar(config.headScale || 0.85);
    // Face the daisy slightly toward the viewer so its radial head reads as a
    // flower disk instead of a narrow fan when viewed from the default camera.
    flowerParent.rotation.set(0.9, 0, 0.045);
  } else {
    flowerParent.position.y = headY;
    // Face the flower head toward the viewer so the petals read as a bloom,
    // while leaving the stem and foliage upright.
    flowerParent.rotation.x = config.headPitch ?? 0.78;
  }
  plant.add(flowerParent);
  let bud = null; let sepals = null; let clusterBuds = null; let seeds = null; let seedGeometry = null; let seedMaterial = null; let seedBaseMatrices = null;
  if (isDaisy) {
    const budGeometry = new THREE.SphereGeometry(config.budRadius || 0.2, 28, 20);
    const budMaterial = new THREE.MeshStandardMaterial({ color: '#86a66e', roughness: 0.88 });
    bud = new THREE.Mesh(budGeometry, budMaterial); bud.position.set(0, 0.018, 0); bud.castShadow = true; flowerParent.add(bud); tracked(root, budGeometry, budMaterial);

    // Individual sepals wrap the green bud when closed, then fold back as
    // the white ray florets emerge. A single instanced draw call serves all.
    const rows = 24; const cols = 12; const positions = []; const uvs = []; const indices = [];
    for (let row = 0; row <= rows; row += 1) {
      const t = row / rows;
      for (let col = 0; col <= cols; col += 1) {
        const across = col / cols * 2 - 1;
        const width = 0.105 * Math.pow(Math.sin(Math.PI * t), 0.62) * (1 - 0.14 * t);
        positions.push(across * width * 0.66, 0.021 * Math.sin(Math.PI * t) * (1 - across * across), t * 0.24);
        uvs.push(col / cols, t);
      }
    }
    for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
      const a = row * (cols + 1) + col; const b = a + cols + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const sepalGeometry = new THREE.BufferGeometry();
    sepalGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    sepalGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    sepalGeometry.setIndex(indices); sepalGeometry.computeVertexNormals();
    const sepalMaterial = new THREE.MeshStandardMaterial({ color: '#668455', roughness: 0.82, side: THREE.DoubleSide });
    sepals = new THREE.InstancedMesh(sepalGeometry, sepalMaterial, config.sepalCount || 8);
    sepals.instanceMatrix.setUsage(THREE.DynamicDrawUsage); flowerParent.add(sepals); tracked(root, sepalGeometry, sepalMaterial);
  } else if (config.template === 'cluster' || config.template === 'spike') {
    const count = config.floretCount || 28; const radius = config.clusterRadius || 0.34;
    const geometry = new THREE.SphereGeometry(config.budRadius || 0.075, 10, 8);
    const material = new THREE.MeshStandardMaterial({ color: '#94a96c', roughness: 0.88, transparent: true, depthWrite: false });
    clusterBuds = new THREE.InstancedMesh(geometry, material, count); clusterBuds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dummy = new THREE.Object3D(); const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i += 1) {
      const y = 1 - 2 * (i + 0.5) / count; const ring = Math.sqrt(1 - y * y); const angle = i * golden;
      if (config.template === 'spike') {
        const along = (i + 0.5) / count;
        const taper = Math.sqrt(1 - along * 0.78);
        dummy.position.set(Math.cos(angle) * radius * taper, (along - 0.5) * 1.14, Math.sin(angle) * radius * taper);
        dummy.scale.setScalar(0.72 + taper * 0.28);
      } else {
        dummy.position.set(Math.cos(angle) * ring * radius, y * radius * 0.7, Math.sin(angle) * ring * radius);
        dummy.scale.setScalar(1 - Math.abs(y) * 0.12);
      }
      dummy.updateMatrix(); clusterBuds.setMatrixAt(i, dummy.matrix);
    }
    flowerParent.add(clusterBuds); tracked(root, geometry, material);
  } else if (config.template) {
    const geometry = new THREE.SphereGeometry(config.budRadius || 0.19, 20, 14);
    const material = new THREE.MeshStandardMaterial({ color: '#91a86d', roughness: 0.86 });
    bud = new THREE.Mesh(geometry, material); bud.position.set(0, 0.015, 0); bud.castShadow = false;
    flowerParent.add(bud); tracked(root, geometry, material);
  }
  (config.layers || []).forEach((layer, layerIndex) => {
    const geometry = makePetalGeometry({ length: layer.length, width: layer.width, shape: config.shape, tipShape: config.tipShape, baseColor: config.template ? config.petalBaseColor : undefined, edgeColor: config.template ? config.petalEdgeColor : undefined, curl: layer.curl ?? config.curl, wave: config.wave, trueDaisy: isDaisy && !config.template });
    const cluster = config.template === 'cluster' || config.template === 'spike'; const floretPetals = layer.count;
    const instanceCount = cluster ? floretPetals * (config.floretCount || 28) : layer.count;
    const mesh = new THREE.InstancedMesh(geometry, petalMaterial, instanceCount); mesh.castShadow = false; mesh.receiveShadow = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dummy = new THREE.Object3D();
    const update = (amount) => {
      const eased = isDaisy
        ? THREE.MathUtils.smoothstep(amount, layer.delay || 0, 0.98)
        : THREE.MathUtils.smoothstep(THREE.MathUtils.clamp((amount - (layer.delay || 0)) / (1 - (layer.delay || 0)), 0, 1), 0, 1);
      for (let i = 0; i < instanceCount; i += 1) {
        const petalIndex = cluster ? i % floretPetals : i;
        const clusterIndex = cluster ? Math.floor(i / floretPetals) : 0;
        const phase = (petalIndex / floretPetals) * Math.PI * 2 + (layer.phase || 0) + layerIndex * 0.27;
        // Each ray responds at a slightly different time and rests at its own
        // angle. That breaks the pinwheel symmetry when the flower opens.
        const petalDelay = (Math.sin(i * 4.71 + layerIndex * 2.3) * 0.5 + 0.5) * (isDaisy ? 0.1 : 0.13);
        const petalOpen = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp((eased - petalDelay) / (1 - petalDelay), 0, 1), 0, 1);
        const organicPitch = Math.sin(phase * 2.1 + 0.7) * (isDaisy ? 0.035 : 0.115) + Math.cos(phase * 3.2) * (isDaisy ? 0.018 : 0.055);
        const wobble = Math.sin(i * 8.11 + layerIndex * 2.2) * (isDaisy ? 0.012 : 0.045);
        let openPitch = (layer.pitch ?? 0.05) + organicPitch;
        let closedPitch = isDaisy ? 0.38 : -0.86;
        if (config.shape === 'tulip') { openPitch = -0.62 + Math.sin(petalIndex * 4.4) * 0.06 + organicPitch * 0.5; closedPitch = -0.95; }
        if (config.shape === 'lily') { openPitch = (layer.pitch ?? 0.28) + organicPitch * 0.7; closedPitch = -1.02; }
        if (config.shape === 'sunflower' || config.shape === 'daisy') { openPitch = (layer.pitch ?? -0.08) + organicPitch; closedPitch = -0.88; }
        if (config.template === 'bowl') { openPitch = -0.62 + organicPitch * 0.4; closedPitch = -0.98; }
        if (config.template === 'bell') { openPitch = 0.28 + organicPitch * 0.45; closedPitch = -0.8; }
        if (config.template === 'swirl5') { openPitch = -0.02 + (petalIndex / floretPetals) * 0.16 + organicPitch * 0.5; closedPitch = -0.7; }
        if (config.template === 'cluster') { openPitch = 0.12 + organicPitch * 0.3; closedPitch = -0.5; }
        if (config.template === 'spike') { openPitch = 0.2 + organicPitch * 0.25; closedPitch = -0.45; }
        const pitch = THREE.MathUtils.lerp(closedPitch, openPitch, petalOpen) + wobble;
        const petalYaw = phase + Math.sin(petalIndex * 3.71 + layerIndex) * 0.052;
        const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), petalYaw);
        const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
        const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(phase * 1.7) * (config.template === 'swirl5' ? 0.18 : 0.075));
        const centerRadius = config.centerRadius || 0.15;
        const rootRadius = centerRadius * (layerIndex === 0 ? 0.72 : 0.38);
        const daisyExtension = isDaisy ? Math.pow(petalOpen, 0.72) : 0;
        const bloomAmount = cluster ? THREE.MathUtils.smoothstep(amount, 0.08, 0.98) : (daisyExtension || petalOpen);
        const radial = THREE.MathUtils.lerp(isDaisy ? 0.001 : config.template ? 0.08 : 0.3, 1, bloomAmount);
        const naturalSize = 1 + Math.sin(petalIndex * 12.7 + layerIndex + clusterIndex * 2.91) * (isDaisy ? 0.075 : 0.12);
        // Let daisy rays emerge at the disk rim. Placing their bases underneath
        // the dome can expose a dark sliver where the two meshes intersect.
        const petalRoot = isDaisy ? THREE.MathUtils.lerp(centerRadius * 0.98, centerRadius * 1.02, daisyExtension) : rootRadius;
        if (cluster) {
          const floretCount = config.floretCount || 28; const clusterRadius = config.clusterRadius || 0.34; const golden = Math.PI * (3 - Math.sqrt(5));
          const sphereY = 1 - 2 * (clusterIndex + 0.5) / floretCount; const ring = Math.sqrt(1 - sphereY * sphereY); const sphereAngle = clusterIndex * golden;
          const along = (clusterIndex + 0.5) / floretCount;
          const taper = Math.sqrt(1 - along * 0.78);
          const normal = config.template === 'spike'
            ? new THREE.Vector3(Math.cos(sphereAngle) * 0.42, 0.76, Math.sin(sphereAngle) * 0.42).normalize()
            : new THREE.Vector3(Math.cos(sphereAngle) * ring, sphereY, Math.sin(sphereAngle) * ring);
          dummy.position.set(
            config.template === 'spike' ? normal.x * clusterRadius * taper : normal.x * clusterRadius,
            config.template === 'spike' ? (along - 0.5) * 1.14 : normal.y * clusterRadius * 0.7,
            config.template === 'spike' ? normal.z * clusterRadius * taper : normal.z * clusterRadius,
          );
          const align = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
          dummy.quaternion.copy(align).multiply(yaw).multiply(tilt).multiply(roll);
        } else {
          dummy.position.set(Math.sin(petalYaw) * petalRoot, (1 - petalOpen) * 0.15 - layerIndex * 0.018, Math.cos(petalYaw) * petalRoot);
          dummy.quaternion.copy(yaw).multiply(tilt).multiply(roll);
        }
        const baseScale = 0.92 + Math.sin(petalIndex * 4) * (isDaisy ? 0.09 : 0.055);
        dummy.scale.set(baseScale * naturalSize * radial, 0.9 + petalOpen * 0.1, radial * naturalSize);
        dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, new THREE.Color(layer.color || config.color).offsetHSL(0, 0, Math.sin(petalIndex * 12.989 + clusterIndex + layerIndex) * 0.028));
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    update(initialOpen); flowerParent.add(mesh); tracked(root, geometry); layers.push(update);
  });
  const centerGeometry = config.centerRadius > 0.36 || isDaisy ? new THREE.SphereGeometry(config.centerRadius || 0.24, 40, 28) : new THREE.SphereGeometry(config.centerRadius || 0.24, 28, 18);
  const center = new THREE.Mesh(centerGeometry, centerMaterial); center.position.set(0, (config.centerY || 0.02), 0); center.scale.y = config.centerScaleY || 0.72; center.castShadow = true; flowerParent.add(center); tracked(root, centerGeometry);
  if (config.template === 'cluster' || config.template === 'spike') center.visible = false;
  if (config.seedCount) {
    seedGeometry = new THREE.SphereGeometry(config.seedSize || 0.018, isDaisy ? 8 : 6, isDaisy ? 6 : 5); seedMaterial = isDaisy
      ? new THREE.MeshBasicMaterial({ color: '#fff8dc' })
      : new THREE.MeshStandardMaterial({ color: config.seedColor || '#795235', roughness: 0.82 });
    seeds = new THREE.InstancedMesh(seedGeometry, seedMaterial, config.seedCount); seeds.castShadow = false; seeds.receiveShadow = false; seeds.instanceMatrix.setUsage(THREE.DynamicDrawUsage); const dummy = new THREE.Object3D(); const golden = Math.PI * (3 - Math.sqrt(5));
    seedBaseMatrices = new Float32Array(config.seedCount * 16);
    for (let i = 0; i < config.seedCount; i += 1) {
      const headRadius = config.centerRadius * (isDaisy ? 1.08 : 1); const radius = headRadius * Math.sqrt((i + 0.5) / config.seedCount); const angle = i * golden;
      const centerYScale = config.centerScaleY || 0.72;
      const surfaceY = (config.centerY || 0.02) + headRadius * centerYScale * Math.sqrt(Math.max(0, 1 - (radius / headRadius) ** 2));
      const size = 0.72 + (i % 4) * 0.11;
      dummy.position.set(Math.cos(angle) * radius, surfaceY + (config.seedSize || 0.018) * 0.5 + (isDaisy ? 0.006 : 0), Math.sin(angle) * radius);
      dummy.rotation.set(0, angle, Math.sin(i * 2.17) * 0.16);
      dummy.scale.set(size * 0.78, size * 0.62, size * 1.12);
      dummy.updateMatrix(); seeds.setMatrixAt(i, dummy.matrix); seedBaseMatrices.set(dummy.matrix.elements, i * 16);
      const radialTint = isDaisy ? THREE.MathUtils.smoothstep(radius / headRadius, 0.58, 1) : 0;
      const seedColor = isDaisy
        ? new THREE.Color('#ffe16b').lerp(new THREE.Color('#e3ad31'), radialTint).offsetHSL(0, 0, Math.sin(i * 4.73) * 0.012)
        : new THREE.Color(config.seedColor || '#795235').offsetHSL(0, 0, Math.sin(i * 4.73) * 0.055);
      seeds.setColorAt(i, seedColor);
    }
    if (seeds.instanceColor) seeds.instanceColor.needsUpdate = true;
    flowerParent.add(seeds); tracked(root, seedGeometry, seedMaterial);
  }
  if (config.spots) {
    const spotGeometry = new THREE.SphereGeometry(0.018, 6, 5); const spotMaterial = new THREE.MeshStandardMaterial({ color: '#713f44', roughness: 0.65 });
    for (let petal = 0; petal < 6; petal += 1) for (let dot = 0; dot < 4; dot += 1) {
      const spot = new THREE.Mesh(spotGeometry, spotMaterial); const a = petal * Math.PI / 3; const r = 0.22 + dot * 0.045;
      spot.position.set(Math.sin(a) * r, 0.22 - dot * 0.025, Math.cos(a) * r); flowerParent.add(spot); tracked(root, spotGeometry);
    }
  }
  if (config.stamenCount) {
    const stalkGeometry = new THREE.CylinderGeometry(config.stamenRadius || 0.012, config.stamenRadius || 0.012, config.stamenLength || 0.34, 7);
    const stalkMaterial = new THREE.MeshStandardMaterial({ color: config.stamenColor || '#d6a044', roughness: 0.55 });
    const antherGeometry = new THREE.SphereGeometry(config.antherSize || 0.045, 10, 8);
    const antherMaterial = new THREE.MeshStandardMaterial({ color: config.antherColor || '#bd7536', roughness: 0.48 });
    const stalks = new THREE.InstancedMesh(stalkGeometry, stalkMaterial, config.stamenCount);
    const anthers = new THREE.InstancedMesh(antherGeometry, antherMaterial, config.stamenCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < config.stamenCount; i += 1) {
      const angle = i * Math.PI * 2 / config.stamenCount;
      const radius = config.stamenRadiusFromCenter || 0.105;
      const x = Math.cos(angle) * radius; const z = Math.sin(angle) * radius;
      dummy.position.set(x, (config.centerY || 0.02) + (config.stamenLength || 0.34) / 2, z); dummy.rotation.set(0, 0, Math.cos(angle) * 0.12); dummy.updateMatrix(); stalks.setMatrixAt(i, dummy.matrix);
      dummy.position.y += (config.stamenLength || 0.34) / 2 + 0.025; dummy.scale.setScalar(1); dummy.updateMatrix(); anthers.setMatrixAt(i, dummy.matrix);
    }
    flowerParent.add(stalks, anthers); tracked(root, stalkGeometry, stalkMaterial); tracked(root, antherGeometry, antherMaterial);
  }
  const setBloom = (amount) => {
    layers.forEach((update) => update(amount));
    if (bud) {
      const opening = THREE.MathUtils.smoothstep(amount, 0.055, 0.5);
      const scale = Math.max(0.001, 1 - opening);
      bud.scale.setScalar(scale);
      bud.visible = amount < 0.998;
      // The calyx should frame the closed bud, then tuck out of sight beneath
      // the rays as they open. Leaving full-sized sepals through the whole
      // transition makes green tips poke through the daisy's yellow disk.
      const calyxFade = 1 - THREE.MathUtils.smoothstep(amount, 0.16, 0.48);
      if (sepals) sepals.visible = calyxFade > 0.001;
      const dummy = new THREE.Object3D();
      for (let i = 0; sepals && i < sepals.count; i += 1) {
        const angle = i / sepals.count * Math.PI * 2 + (i % 2) * 0.13;
        const openPitch = 1.72 + Math.sin(i * 5.1) * 0.08;
        const closedPitch = -0.18 + Math.sin(i * 5.1) * 0.045;
        const pitch = THREE.MathUtils.lerp(closedPitch, openPitch, opening);
        const tuckedRadius = THREE.MathUtils.lerp(0.085, 0.045, opening);
        dummy.position.set(Math.sin(angle) * tuckedRadius, -0.035 - opening * 0.035, Math.cos(angle) * tuckedRadius);
        dummy.rotation.set(pitch, angle, Math.sin(i * 8.3) * 0.08);
        dummy.scale.setScalar((1 - opening * 0.25) * calyxFade);
        dummy.updateMatrix(); sepals.setMatrixAt(i, dummy.matrix);
      }
      if (sepals) sepals.instanceMatrix.needsUpdate = true;
      else bud.visible = amount < 0.998;
    }
    if (clusterBuds) {
      const clusterReveal = 1 - THREE.MathUtils.smoothstep(amount, 0.22, 0.84);
      clusterBuds.material.opacity = clusterReveal;
      clusterBuds.visible = clusterReveal > 0.001;
    }
    if (isDaisy) {
      const centerReveal = THREE.MathUtils.smoothstep(amount, 0.28, 0.68);
      const centerSize = THREE.MathUtils.lerp(0.001, 1, centerReveal);
      const diskScale = isDaisy ? 1.08 : 1;
      center.scale.set(centerSize * diskScale, (config.centerScaleY || 0.76) * centerSize, centerSize * diskScale);
      if (seeds) {
        const seedReveal = THREE.MathUtils.smoothstep(amount, 0.34, 0.8);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < seeds.count; i += 1) {
          dummy.matrix.fromArray(seedBaseMatrices, i * 16);
          dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
          dummy.scale.multiplyScalar(seedReveal);
          dummy.updateMatrix(); seeds.setMatrixAt(i, dummy.matrix);
        }
        seeds.instanceMatrix.needsUpdate = true;
      }
    } else if (config.template && config.template !== 'cluster' && config.template !== 'spike') {
      const reveal = THREE.MathUtils.smoothstep(amount, 0.32, 0.78);
      const scale = THREE.MathUtils.lerp(0.001, 1, reveal);
      center.scale.set(scale, (config.centerScaleY || 0.72) * scale, scale);
    }
  };
  setBloom(initialOpen);
  return setBloom;
}

export function createBotanical(THREE_NS, config, { initialOpen = config.open ?? 0.78, wind = true } = {}) {
  const root = new THREE.Group(); root.name = `Procedural ${config.id}`;
  root.userData.geometries = []; root.userData.materials = new Set(); root.userData.textures = new Set(); root.userData.windMaterials = []; root.userData.windEnabled = wind;
  addPot(root); const plant = new THREE.Group(); plant.name = 'Wind-responsive flower rig'; root.add(plant);
  const stemCurve = addStem(root, config, plant); addLeaves(root, config, plant);
  if (config.thorns) {
    const material = new THREE.MeshStandardMaterial({ color: '#76905f', roughness: 0.8 }); tracked(root, null, material);
    for (let i = 0; i < 5; i += 1) { const geometry = new THREE.ConeGeometry(0.035, 0.15, 6); const thorn = new THREE.Mesh(geometry, material); thorn.position.set((i % 2 ? 0.065 : -0.065), 1.2 + i * 0.22, 0); thorn.rotation.z = i % 2 ? -0.8 : 0.8; plant.add(thorn); tracked(root, geometry); }
  }
  const setOpen = addFlowerHead(root, config, initialOpen, plant);
  root.userData.setOpen = setOpen; root.userData.stemCurve = stemCurve; root.userData.plantRig = plant;
  root.userData.dispose = () => { root.userData.geometries.forEach((item) => item.dispose()); root.userData.materials.forEach((item) => item.dispose()); root.userData.textures.forEach((item) => item.dispose()); };
  return root;
}

export function disposeBotanical(root) { root?.userData.dispose?.(); }
