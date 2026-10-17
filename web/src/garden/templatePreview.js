import * as THREE from 'three';
import { createBotanical } from './species/flowerParts.js';
import { createTemplateConfig, flowerTemplatePresets } from './species/flowerTemplates.js';

const grid = document.querySelector('#grid');
const sliderButtons = [...document.querySelectorAll('[data-open]')];
const stateLabel = document.querySelector('#state-label');
const plants = [];
const cameras = [];

flowerTemplatePresets.forEach((preset, index) => {
  const card = document.createElement('section');
  card.className = 'card';
  card.dataset.template = preset.id;
  card.setAttribute('aria-label', `${preset.label} · ${preset.id}`);
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = preset.label;
  card.append(label);
  grid.append(card);

  const config = createTemplateConfig(preset.id);
  const plant = createBotanical(THREE, config, { initialOpen: 0, wind: false });
  plant.visible = index === 0;
  plant.name = preset.id;
  plants.push({ root: plant, setOpen: plant.userData.setOpen });

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 35);
  camera.position.set(1.45, 4.3, 6.45);
  camera.lookAt(0, 2.15, 0);
  cameras.push(camera);
});

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight('#fffaf0', '#839173', 1.8));
scene.add(new THREE.AmbientLight('#fff7ec', 0.45));
const key = new THREE.DirectionalLight('#fff1d9', 2.1); key.position.set(-3, 7, 5); scene.add(key);
const fill = new THREE.DirectionalLight('#f3dce5', 0.8); fill.position.set(4, 4, -3); scene.add(fill);
plants.forEach(({ root }) => scene.add(root));

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
grid.append(renderer.domElement);

let bloom = 0;
function render() {
  const gridBounds = grid.getBoundingClientRect();
  const width = Math.max(1, Math.floor(grid.clientWidth));
  const height = Math.max(1, Math.floor(grid.clientHeight));
  renderer.setSize(width, height, false);
  renderer.setScissorTest(true);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, true);

  [...grid.querySelectorAll('.card')].forEach((card, index) => {
    const rect = card.getBoundingClientRect();
    const x = rect.left - gridBounds.left;
    const y = gridBounds.bottom - rect.bottom;
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    renderer.clearDepth();
    plants.forEach(({ root }, plantIndex) => { root.visible = plantIndex === index; });
    cameras[index].aspect = w / h;
    cameras[index].updateProjectionMatrix();
    renderer.render(scene, cameras[index]);
  });
  renderer.setScissorTest(false);
  document.documentElement.dataset.previewDrawCalls = String(renderer.info.render.calls);
}

function setBloom(value) {
  bloom = value;
  plants.forEach(({ setOpen }) => setOpen(bloom));
  sliderButtons.forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.open) === bloom)));
  stateLabel.textContent = `Độ nở ${Math.round(bloom * 100)}% · ảnh chụp mô hình trực tiếp`;
  requestAnimationFrame(render);
}

sliderButtons.forEach((button) => button.addEventListener('click', () => setBloom(Number(button.dataset.open))));
const resizeObserver = new ResizeObserver(() => requestAnimationFrame(render));
resizeObserver.observe(grid);
render();

window.addEventListener('pagehide', () => {
  resizeObserver.disconnect();
  plants.forEach(({ root }) => root.userData.dispose?.());
  renderer.dispose();
});
