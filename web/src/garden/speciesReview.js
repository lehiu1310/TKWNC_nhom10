import * as THREE from 'three';
import species from '../../../data/species.json';
import params from '../../../data/flower_params.json';
import { API_BASE } from '../api.js';
import { createFlower, createSpeciesConfig, disposeFlower } from './species/index.js';

const pageSize = 21;
const queryParams = new URLSearchParams(location.search);
const page = Math.max(0, Number(queryParams.get('page') || 0));
const denseMode = queryParams.has('dense');
if (denseMode) document.body.classList.add('dense');
const records = species.slice(page * pageSize, (page + 1) * pageSize);
const byId = new Map(params.species.map((entry) => [entry.id, entry]));
const grid = document.querySelector('#grid');
const plants = [];
const slots = [];
const fallbackCount = params.species.filter((entry) => entry.fallback_photo).length;
let loadedImages = 0, missingImages = 0, colorMismatches = 0;

document.querySelector('#title').textContent = `Duyệt mô hình · trang ${page + 1}`;
document.querySelector('#summary').textContent = `${records.length} loài · ${species.length} tổng · ${species.length - fallbackCount} mô hình / ${fallbackCount} ảnh thật ưu tiên · Gemini ${params.gemini_suggestions} · ảnh thật cạnh mô hình`;
const denseSuffix = denseMode ? '&dense=1' : '';
document.querySelector('#prev').href = `?page=${Math.max(0, page - 1)}${denseSuffix}`;
document.querySelector('#next').href = `?page=${Math.min(Math.ceil(species.length / pageSize) - 1, page + 1)}${denseSuffix}`;

for (const record of records) {
  const suggestion = byId.get(record.id);
  const config = createSpeciesConfig(record);
  const card = document.createElement('article'); card.className = 'card';
  const title = document.createElement('h2'); title.textContent = record.name_vi;
  const subtitle = document.createElement('small'); subtitle.innerHTML = `<span class="swatch" style="--swatch:${record.color || '#a0a080'}"></span>${record.name_en || record.id} · ${suggestion?.template || 'chưa có mẫu'}`;
  const chip = document.createElement('span'); chip.className = 'chip';
  if (suggestion?.fallback_photo || suggestion?.confidence < 0.55) { chip.className += ' risk'; chip.textContent = `ẢNH THẬT · ${(suggestion.confidence * 100).toFixed(0)}%`; }
  else { chip.textContent = `MÔ HÌNH · ${(suggestion.confidence * 100).toFixed(0)}%`; }
  const slot = document.createElement('div'); slot.className = 'model-slot';
  const image = document.createElement('img'); image.className = 'photo'; image.alt = `${record.name_vi}, ảnh dữ liệu tham khảo`; image.loading = 'eager'; image.decoding = 'async';
  const missing = document.createElement('div'); missing.className = 'missing'; missing.hidden = true; missing.textContent = 'API ảnh không có sẵn';
  image.src = `${API_BASE}/api/species/${encodeURIComponent(record.id)}/image`;
  image.onerror = () => { missingImages += 1; image.hidden = true; missing.hidden = false; chip.className += ' bad'; chip.textContent += ' · thiếu ảnh'; document.body.dataset.missingImages = String(missingImages); };
  image.onload = () => {
    loadedImages += 1;
    const colorDistance = comparePhotoHue(image, record.color);
    if (colorDistance !== null && colorDistance > 58) { colorMismatches += 1; image.dataset.colorMismatch = 'true'; chip.className = 'chip bad'; chip.textContent += ' · màu lệch'; }
    document.body.dataset.loadedImages = String(loadedImages);
    document.body.dataset.colorMismatches = String(colorMismatches);
  };
  card.append(title, subtitle, chip, slot, image, missing); grid.append(card);
  const model = createFlower(THREE, record.id, { initialOpen: 1, wind: false }, record);
  plants.push(model); slots.push({ slot, model });
}

function comparePhotoHue(image, hex) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  try {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 48;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, 48, 48);
    const pixels = context.getImageData(8, 8, 32, 32).data;
    const buckets = new Map();
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i] / 255, g = pixels[i + 1] / 255, b = pixels[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
      if (delta < 0.12 || max < 0.18) continue;
      let hue = max === r ? 60 * (((g - b) / delta) % 6) : max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4);
      if (hue < 0) hue += 360;
      const bucket = Math.round(hue / 12) * 12;
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    }
    if (!buckets.size) return null;
    const photoHue = [...buckets].sort((a, b) => b[1] - a[1])[0][0];
    const color = new THREE.Color(hex); const hsl = {}; color.getHSL(hsl);
    const dataHue = hsl.h * 360; const difference = Math.abs(photoHue - dataHue);
    return Math.min(difference, 360 - difference);
  } catch { return null; }
}

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1)); renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
grid.append(renderer.domElement);
const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight('#fffaf1', '#728064', 1.7));
const key = new THREE.DirectionalLight('#fff0d8', 1.8); key.position.set(-3, 7, 5); scene.add(key);
const fill = new THREE.DirectionalLight('#f3dce5', 0.7); fill.position.set(4, 4, -3); scene.add(fill);
slots.forEach(({ model }) => scene.add(model));
const cameras = slots.map(() => new THREE.PerspectiveCamera(40, 1, 0.1, 40));

function render() {
  const gridBounds = grid.getBoundingClientRect();
  const width = Math.max(1, grid.clientWidth), height = Math.max(1, grid.clientHeight);
  renderer.setSize(width, height, false); renderer.setScissorTest(true); renderer.clear(true, true, true);
  slots.forEach(({ slot, model }, index) => {
    const rect = slot.getBoundingClientRect(); const x = rect.left - gridBounds.left; const y = gridBounds.bottom - rect.bottom;
    renderer.setViewport(x, y, rect.width, rect.height); renderer.setScissor(x, y, rect.width, rect.height); renderer.clearDepth();
    slots.forEach((item, plantIndex) => { item.model.visible = plantIndex === index; });
    const camera = cameras[index]; camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix();
    const bounds = new THREE.Box3().setFromObject(model); const size = bounds.getSize(new THREE.Vector3()); const center = bounds.getCenter(new THREE.Vector3());
    const vfov = THREE.MathUtils.degToRad(camera.fov); const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const distance = Math.max(size.y / (2 * Math.tan(vfov / 2)), Math.hypot(size.x, size.z) / (2 * Math.tan(hfov / 2))) * 1.18;
    const direction = new THREE.Vector3(0.28, 0.28, 1).normalize(); camera.position.copy(center).addScaledVector(direction, distance); camera.lookAt(center);
    renderer.render(scene, camera);
  });
  renderer.setScissorTest(false);
}

const observer = new ResizeObserver(() => requestAnimationFrame(render)); observer.observe(grid);
window.addEventListener('pagehide', () => { observer.disconnect(); plants.forEach(disposeFlower); renderer.dispose(); });
requestAnimationFrame(render);
