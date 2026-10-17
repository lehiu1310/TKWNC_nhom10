import * as THREE from 'three';
import { roseConfig } from './rose.config.js';
import { getPetalSurfaceMaps } from './petalSurface.js';

function petalGeometry(length, width, phase, baseHex, tipHex) {
  // The 3D canvas runs continuously for orbit/wind, so keep petal tessellation
  // lean enough for integrated GPUs while preserving the rounded silhouette.
  const rows = 16;
  const columns = 12;
  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const base = new THREE.Color(baseHex);
  const tip = new THREE.Color(tipHex);
  const mid = base.clone().lerp(tip, 0.54);
  const edge = tip.clone().lerp(new THREE.Color('#fff0e9'), 0.18);

  for (let row = 0; row <= rows; row += 1) {
    const t = row / rows;
    const endWidth = 0.14 + 0.86 * Math.pow(Math.sin(Math.PI * t * 0.82), 0.6);
    for (let column = 0; column <= columns; column += 1) {
      const v = column / columns * 2 - 1;
      const edgeWave = Math.sin(t * Math.PI * 2.2 + phase + v * 2.4) * Math.pow(Math.abs(v), 3) * 0.022 * t;
      const rimCurl = Math.pow(Math.abs(v), 3.2) * (0.035 * t + 0.018 * Math.sin(t * Math.PI));
      const cup = (1 - v * v) * (0.09 + 0.2 * t) + rimCurl + edgeWave;
      const longitudinalRipple = Math.sin(v * Math.PI * 2.2) * 0.02 * Math.sin(t * Math.PI);
      const longitudinalBend = Math.sin(t * Math.PI) * 0.075;
      const roundedTip = Math.pow(Math.abs(v), 2) * 0.24 * width * endWidth * THREE.MathUtils.smoothstep(t, 0.62, 1);
      positions.push(v * width * endWidth, cup + longitudinalRipple + longitudinalBend, t * length - roundedTip);
      uvs.push(t, column / columns);

      const gradient = THREE.MathUtils.smoothstep(t, 0.02, 0.92);
      const petalColor = gradient < 0.55
        ? base.clone().lerp(mid, gradient / 0.55)
        : mid.clone().lerp(edge, (gradient - 0.55) / 0.45);
      const edgeLight = Math.pow(Math.abs(v), 3) * 0.045;
      petalColor.lerp(new THREE.Color('#fff0e9'), edgeLight);
      colors.push(petalColor.r, petalColor.g, petalColor.b);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  // A second, very slightly offset skin gives the petal a thin, soft edge.
  const surfaceVertexCount = positions.length / 3;
  const frontIndexCount = indices.length;
  for (let vertex = 0; vertex < surfaceVertexCount; vertex += 1) {
    const offset = vertex * 3;
    positions.push(positions[offset], positions[offset + 1] - 0.006, positions[offset + 2]);
    colors.push(colors[offset], colors[offset + 1], colors[offset + 2]);
    uvs.push(uvs[vertex * 2], uvs[vertex * 2 + 1]);
  }
  for (let index = 0; index < frontIndexCount; index += 3) {
    indices.push(indices[index] + surfaceVertexCount, indices[index + 2] + surfaceVertexCount, indices[index + 1] + surfaceVertexCount);
  }
  const stitch = (a, b) => indices.push(a, b, b + surfaceVertexCount, a, b + surfaceVertexCount, a + surfaceVertexCount);
  for (let column = 0; column < columns; column += 1) {
    stitch(column, column + 1);
    const lastRow = rows * (columns + 1) + column;
    stitch(lastRow + 1, lastRow);
  }
  for (let row = 0; row < rows; row += 1) {
    const left = row * (columns + 1);
    const right = left + columns;
    stitch(left + columns + 1, left);
    stitch(right, right + columns + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function makeVeinTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = '#a5a5a5';
  context.fillRect(0, 0, 128, 128);
  context.strokeStyle = '#858585';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(64, 126);
  context.quadraticCurveTo(61, 60, 63, 2);
  context.stroke();
  context.lineWidth = 1;
  for (let i = 1; i < 9; i += 1) {
    const y = 118 - i * 13;
    const taper = i / 9;
    for (const sign of [-1, 1]) {
      context.beginPath();
      context.moveTo(63, y + 5);
      context.quadraticCurveTo(64 + sign * 18 * taper, y - 2, 64 + sign * 45 * taper, y - 8);
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  return texture;
}

function buildPetalLayer(config, index, material, openAmount) {
  const geometry = petalGeometry(config.length, config.width, index * 0.4, config.base, config.tip);
  const petals = new THREE.InstancedMesh(geometry, material, config.petals);
  petals.castShadow = false;
  petals.receiveShadow = false;
  petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy = new THREE.Object3D();
  const colors = ['#fffaf6', '#fff5f2', '#fffdf8', '#fff1ef'];
  for (let petal = 0; petal < config.petals; petal += 1) {
    const angle = petal * Math.PI * 2 / config.petals + config.phase + index * 0.21 + Math.sin(petal * 12.9898 + index * 4.17) * 0.055;
    petals.setColorAt(petal, new THREE.Color(colors[(petal + index) % colors.length]));
    dummy.userData = { petal, angle };
  }
  const update = (bloom) => {
    const layerOpen = THREE.MathUtils.clamp((bloom - config.delay) / (1 - config.delay), 0, 1);
    const eased = layerOpen * layerOpen * (3 - 2 * layerOpen);
    for (let petal = 0; petal < config.petals; petal += 1) {
      const variation = Math.sin(petal * 12.9898 + index * 4.17);
      const angle = petal * Math.PI * 2 / config.petals + config.phase + index * 0.21 + variation * 0.055;
      const tilt = THREE.MathUtils.lerp(-0.72 + config.tilt, config.tilt + variation * 0.045, eased);
      const radialScale = THREE.MathUtils.lerp(0.33, 1, eased);
      const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      const curl = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt);
      const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), variation * 0.08);
      yaw.multiply(curl).multiply(roll);
      const scale = new THREE.Vector3(0.94 + (variation + 1) * 0.055, 0.82 + eased * 0.18, radialScale * (0.95 + (variation + 1) * 0.06));
      const rise = (1 - eased) * config.length * 0.18;
      dummy.position.set(0, 2.48 + config.y + rise + variation * 0.025, 0);
      dummy.quaternion.copy(yaw);
      dummy.scale.copy(scale);
      dummy.updateMatrix();
      petals.setMatrixAt(petal, dummy.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;
  };
  update(openAmount);
  return { mesh: petals, geometry, update };
}

function makeLeafGeometry(length, width, serration = 0) {
  const points = [];
  const steps = 24;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const tooth = serration ? Math.sin(t * Math.PI * 14) * 0.009 : 0;
    const halfWidth = Math.sin(Math.PI * t) * width * (1 + tooth);
    points.push(new THREE.Vector2(halfWidth, t * length));
  }
  for (let index = steps; index >= 0; index -= 1) {
    const t = index / steps;
    const tooth = serration ? Math.sin(t * Math.PI * 14) * 0.009 : 0;
    const halfWidth = -Math.sin(Math.PI * t) * width * (1 + tooth);
    points.push(new THREE.Vector2(halfWidth, t * length));
  }
  const shape = new THREE.Shape(points);
  const geometry = new THREE.ShapeGeometry(shape, 16);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    pos.setZ(i, Math.sin(Math.PI * y / length) * (0.06 - Math.abs(x) * 0.12));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createLeafCluster(THREE, parent, veinMaterial, centerY, side, index) {
  const group = new THREE.Group();
    group.position.set(side * (0.12 + (index % 2) * 0.05), centerY, 0);
  group.rotation.y = side * (0.42 + index * 0.09);
  const leafletGeometry = makeLeafGeometry(0.58 - (index % 2) * 0.06, 0.14 + (index % 3) * 0.012, 1);
  const leafletMaterial = new THREE.MeshStandardMaterial({ color: ['#46694b', '#5d8057', '#799364'][index % 3], roughness: 0.72, side: THREE.DoubleSide });
  leafletMaterial.name = 'rose foliage wind';
  for (let leaflet = 0; leaflet < 5; leaflet += 1) {
    const angle = (leaflet - 2) * 0.36;
    const mesh = new THREE.Mesh(leafletGeometry, leafletMaterial);
    mesh.position.set((leaflet - 2) * 0.07 + Math.sin(angle) * 0.06, Math.cos(angle) * 0.045, leaflet * 0.025);
    mesh.rotation.set(-0.2 - Math.abs(leaflet - 2) * 0.05, angle, -side * 0.7 + (leaflet - 2) * 0.28);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const vein = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0.015), new THREE.Vector3(0, 0.58, 0.015)), 10, 0.007, 5, false), veinMaterial);
  group.add(vein);
  parent.add(group);
  return { group, leafletGeometry, leafletMaterial, veinGeometry: vein.geometry };
}

export function createRose(THREE, { initialOpen = 0.84, wind = true } = {}) {
  const root = new THREE.Group();
  root.name = 'Procedural rose';
  const plantRig = new THREE.Group(); plantRig.name = 'Wind-responsive rose stem and bloom'; root.add(plantRig);
  const disposables = [];
  const petalMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff', vertexColors: true, side: THREE.DoubleSide, roughness: 0.94, metalness: 0,
    ...getPetalSurfaceMaps(), bumpScale: 0.009,
  });
  const sepalsMaterial = new THREE.MeshStandardMaterial({ color: '#50704b', roughness: 0.73, side: THREE.DoubleSide });
  const stemMaterial = new THREE.MeshStandardMaterial({ color: '#496c47', roughness: 0.66 });
  stemMaterial.name = 'rose stem wind';
  const thornMaterial = new THREE.MeshStandardMaterial({ color: '#688552', roughness: 0.78 });
  const leafVeinMaterial = new THREE.MeshStandardMaterial({ color: '#afbd87', roughness: 0.7 });
  const layers = roseConfig.petalLayers.map((layer, index) => buildPetalLayer(layer, index, petalMaterial, initialOpen));
  layers.forEach((layer) => { plantRig.add(layer.mesh); disposables.push(layer.geometry, layer.mesh); });

  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.98, 0), new THREE.Vector3(-0.07, 1.38, 0.015),
    new THREE.Vector3(0.05, 1.9, -0.035), new THREE.Vector3(0.015, 2.48, 0),
  ]);
  const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 36, 0.044, 10, false), stemMaterial);
  stem.castShadow = true;
  stem.receiveShadow = true;
  plantRig.add(stem);
  disposables.push(stem.geometry);

  for (let thorn = 0; thorn < 7; thorn += 1) {
    const t = 0.12 + thorn * 0.105;
    const point = stemCurve.getPoint(t);
    const tangent = stemCurve.getTangent(t);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.19, 6), thornMaterial);
    spike.position.copy(point).add(new THREE.Vector3(thorn % 2 ? 0.068 : -0.068, 0.045, 0));
    spike.rotation.z = thorn % 2 ? -0.82 : 0.82;
    spike.quaternion.multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent));
    spike.castShadow = true;
    plantRig.add(spike);
    disposables.push(spike.geometry);
  }

  const foliage = [];
  for (let index = 0; index < 2; index += 1) {
    foliage.push(createLeafCluster(THREE, plantRig, leafVeinMaterial, 1.12 + index * 0.5, index % 2 ? -1 : 1, index));
  }
  foliage.forEach(({ leafletGeometry, leafletMaterial, veinGeometry }) => {
    disposables.push(leafletGeometry, veinGeometry);
  });

  const sepalGeometry = makeLeafGeometry(0.52, 0.12, 0);
  disposables.push(sepalGeometry);
  for (let index = 0; index < 5; index += 1) {
    const sepal = new THREE.Mesh(sepalGeometry, sepalsMaterial);
    sepal.position.set(0, 2.34, 0);
    sepal.rotation.y = index * Math.PI * 2 / 5;
    sepal.rotation.x = 1.1;
    sepal.castShadow = true;
    plantRig.add(sepal);
  }

  const receptacle = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 16), new THREE.MeshStandardMaterial({ color: '#b54f63', roughness: 0.52 }));
  receptacle.position.set(0, 2.53, 0);
  receptacle.scale.set(1, 0.43, 1);
  plantRig.add(receptacle);
  disposables.push(receptacle.geometry);
  const spiralPoints = [];
  for (let point = 0; point <= 32; point += 1) {
    const t = point / 32;
    const angle = t * Math.PI * 3.2 + 0.4;
    const radius = 0.12 * (1 - t) + 0.012;
    spiralPoints.push(new THREE.Vector3(Math.cos(angle) * radius, 2.72 + t * 0.12, Math.sin(angle) * radius));
  }
  const heartMaterial = new THREE.MeshStandardMaterial({ color: '#8e1733', roughness: 0.48 });
  const heart = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiralPoints), 64, 0.031, 8, false), heartMaterial);
  plantRig.add(heart);
  disposables.push(heart.geometry);

  const bud = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 12), new THREE.MeshStandardMaterial({ color: '#c95168', roughness: 0.78 }));
  bud.position.set(0, 2.6, 0);
  plantRig.add(bud);
  disposables.push(bud.geometry);

  const potMaterial = new THREE.MeshPhysicalMaterial({ color: '#d5b9a4', roughness: 0.23, clearcoat: 0.72, clearcoatRoughness: 0.2 });
  const potPoints = [
    new THREE.Vector2(0.48, 0.08), new THREE.Vector2(0.66, 0.12),
    new THREE.Vector2(0.74, 0.94), new THREE.Vector2(0.69, 1.02),
    new THREE.Vector2(0.6, 0.98), new THREE.Vector2(0.59, 0.89),
  ];
  const pot = new THREE.Mesh(new THREE.LatheGeometry(potPoints, 64), potMaterial);
  pot.castShadow = true;
  pot.receiveShadow = true;
  root.add(pot);
  const potRim = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.065, 14, 72), potMaterial);
  potRim.rotation.x = Math.PI / 2;
  potRim.position.y = 0.96;
  root.add(potRim);
  const potFoot = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.045, 12, 64), potMaterial);
  potFoot.rotation.x = Math.PI / 2;
  potFoot.position.y = 0.09;
  root.add(potFoot);
  disposables.push(pot.geometry, potRim.geometry, potFoot.geometry);

  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.59, 0.59, 0.055, 48), new THREE.MeshStandardMaterial({ color: '#594b3b', roughness: 1 }));
  soil.position.y = 0.91;
  root.add(soil);
  disposables.push(soil.geometry);
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.73, 0.12, 48), potMaterial);
  saucer.position.y = -0.025;
  saucer.castShadow = true;
  root.add(saucer);
  disposables.push(saucer.geometry);

  const setOpen = (value) => {
    const amount = THREE.MathUtils.clamp(value, 0, 1);
    layers.forEach((layer) => layer.update(amount));
    const budScale = Math.max(0.001, 1 - THREE.MathUtils.smoothstep(amount, 0.08, 0.48));
    bud.scale.setScalar(budScale);
    receptacle.visible = amount > 0.32;
  };
  setOpen(initialOpen);
  root.userData.setOpen = setOpen;
  root.userData.layers = layers;
  root.userData.windEnabled = wind;
  root.userData.plantRig = plantRig;
  root.userData.disposables = disposables;
  root.userData.materials = [...new Set([petalMaterial, sepalsMaterial, stemMaterial, thornMaterial, leafVeinMaterial, potMaterial, soil.material, receptacle.material, heartMaterial, bud.material, ...foliage.map((item) => item.leafletMaterial)])];
  root.userData.windMaterials = [stemMaterial, leafVeinMaterial, ...foliage.map((item) => item.leafletMaterial)];
  return root;
}

export function disposeRose(rose) {
  if (!rose) return;
  rose.userData.disposables?.forEach((item) => item.dispose?.());
  rose.userData.materials?.forEach((item) => item.dispose?.());
}
