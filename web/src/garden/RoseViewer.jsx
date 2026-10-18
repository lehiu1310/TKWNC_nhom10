import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createFlower, disposeFlower } from './species/index.js';
import { getPetalGeometryCacheStats } from './species/flowerParts.js';

// A slightly elevated, closer view shows the flower head instead of its
// underside, while keeping the whole potted plant in frame.
const defaultView = { position: new THREE.Vector3(2.05, 4.8, 4.95), target: new THREE.Vector3(0, 1.82, 0) };
const daisyView = { position: new THREE.Vector3(2.05, 5.05, 6.0), target: new THREE.Vector3(0, 2.1, 0) };

function useSeenHint() {
  const [visible, setVisible] = useState(() => {
    try { return !sessionStorage.getItem('flower-pot-viewer-hint-seen'); } catch { return true; }
  });
  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setTimeout(() => {
      setVisible(false);
      try { sessionStorage.setItem('flower-pot-viewer-hint-seen', '1'); } catch { /* storage can be disabled */ }
    }, 5200);
    return () => window.clearTimeout(timer);
  }, [visible]);
  const dismiss = () => {
    setVisible(false);
    try { sessionStorage.setItem('flower-pot-viewer-hint-seen', '1'); } catch { /* storage can be disabled */ }
  };
  return [visible, dismiss];
}

function addWind(material) {
  const previousCompile = material.onBeforeCompile;
  const previousCacheKey = material.customProgramCacheKey?.() || '';
  material.onBeforeCompile = (shader) => {
    previousCompile?.call(material, shader);
    shader.uniforms.uFlowerTime = { value: 0 };
    shader.uniforms.uFlowerWind = { value: 0 };
    const commonChunk = shader.vertexShader.includes('#include <common>') ? '#include <common>' : '#include <uv_pars_vertex>';
    shader.vertexShader = shader.vertexShader.replace(commonChunk, `${commonChunk}\nuniform float uFlowerTime;\nuniform float uFlowerWind;`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.x += sin(uFlowerTime + position.y * 2.2) * uFlowerWind * max(position.y, 0.0) * 0.045;');
    material.userData.flowerShader = shader;
  };
  material.customProgramCacheKey = () => `${previousCacheKey}|flower-pot-wind-v3`;
}

function contactShadowTexture(strength = 1) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d'); const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 125);
  gradient.addColorStop(0, `rgba(51,42,36,${0.24 * strength})`); gradient.addColorStop(.48, `rgba(51,42,36,${0.1 * strength})`); gradient.addColorStop(1, 'rgba(51,42,36,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

function makeModel(id, record, open, windEnabled) {
  const root = createFlower(THREE, id, { initialOpen: open, wind: windEnabled }, record);
  root.userData.windEnabled = windEnabled;
  for (const material of root.userData.windMaterials || []) addWind(material);
  root.traverse((object) => {
    if (object.isMesh) { object.castShadow = object.castShadow !== false; object.receiveShadow = object.receiveShadow !== false; }
  });
  return root;
}

export default function RoseViewer({ speciesId, speciesRecord, open, windEnabled, resetKey, speciesName, scientificName = '' }) {
  const hostRef = useRef(null);
  const sceneRef = useRef(null);
  const [error, setError] = useState(false);
  const [hintVisible, dismissHint] = useSeenHint();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const compact = window.matchMedia('(max-width: 700px)').matches || window.matchMedia('(pointer: coarse)').matches;
    let renderer; let frame = 0; let visible = !document.hidden; let inViewport = true; let lastRender = 0;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 70);
    const view = speciesId === 'daisy' ? daisyView : defaultView;
    camera.position.copy(view.position);
    scene.add(new THREE.HemisphereLight('#fffaf1', '#718367', 1.28));
    scene.add(new THREE.AmbientLight('#fff8f2', 0.34));
    const keyLight = new THREE.DirectionalLight('#fff0d8', 1.65); keyLight.position.set(-4, 8, 5); keyLight.castShadow = !compact;
    keyLight.shadow.mapSize.set(1024, 1024); keyLight.shadow.camera.near = .5; keyLight.shadow.camera.far = 18;
    keyLight.shadow.camera.left = -4; keyLight.shadow.camera.right = 4; keyLight.shadow.camera.top = 6; keyLight.shadow.camera.bottom = -3; keyLight.shadow.bias = -.00015; keyLight.shadow.radius = 4; scene.add(keyLight);
    const model = makeModel(speciesId, speciesRecord, open, windEnabled); scene.add(model);
    const shadowMap = contactShadowTexture(speciesId === 'daisy' ? 1.16 : 1);
    const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 4.3), new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, toneMapped: false }));
    contactShadow.rotation.x = -Math.PI / 2; contactShadow.position.y = .008; contactShadow.renderOrder = 1; scene.add(contactShadow);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: '#fffaf2', transparent: true, opacity: .1, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.045; ground.receiveShadow = true; scene.add(ground);

    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !compact, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.5));
      renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight), false); renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.04; renderer.shadowMap.enabled = false; keyLight.castShadow = false;
      const initialPixelRatio = renderer.getPixelRatio();
      const gl = renderer.getContext();
      const debugRenderer = gl.getExtension('WEBGL_debug_renderer_info');
      const gpuRenderer = debugRenderer ? gl.getParameter(debugRenderer.UNMASKED_RENDERER_WEBGL) : 'unavailable';
      host.dataset.gardenGpuRenderer = gpuRenderer;
      renderer.domElement.setAttribute('aria-label', `Mô hình 3D ${speciesName} trong chậu`); host.appendChild(renderer.domElement);
      const controls = new OrbitControls(camera, renderer.domElement); controls.target.copy(view.target); controls.enableDamping = !reducedMotion; controls.dampingFactor = .075;
      controls.minDistance = 4.6; controls.maxDistance = 16; controls.minPolarAngle = .2; controls.maxPolarAngle = 1.43;
      controls.autoRotate = false; controls.addEventListener('start', () => { if (sceneRef.current) sceneRef.current.interactionUntil = performance.now() + 1200; dismissHint(); schedule(); }); controls.update();

      const fitCamera = () => {
        // A resize can happen long after a species swap. Use the current plant,
        // not the model captured when the scene was first initialized.
        const currentActive = sceneRef.current?.active || active;
        const rememberedOpen = currentActive.open;
        currentActive.root.userData.setOpen(1);
        // InstancedMesh bounds are cached, but petal matrices change with the
        // opening slider. Recompute them before fitting so an open bloom can't
        // be clipped using the much smaller bud bounds.
        currentActive.root.traverse((object) => {
          if (object.isInstancedMesh) {
            object.computeBoundingBox();
            object.computeBoundingSphere();
          }
        });
        const bounds = new THREE.Box3().setFromObject(currentActive.root);
        currentActive.root.userData.setOpen(rememberedOpen);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const verticalHalf = THREE.MathUtils.degToRad(camera.fov * 0.5);
        const horizontalHalf = Math.atan(Math.tan(verticalHalf) * camera.aspect);
        const projectedWidth = Math.hypot(size.x, size.z);
        const projectedHeight = size.y + projectedWidth * 0.48;
        const distance = Math.max(
          projectedHeight / (2 * Math.tan(verticalHalf)),
          projectedWidth / (2 * Math.tan(horizontalHalf)),
        ) * 1.34;
        const currentView = sceneRef.current?.view || view;
        const direction = currentView.position.clone().sub(currentView.target).normalize();
        controls.target.copy(center);
        camera.position.copy(center).addScaledVector(direction, distance);
        camera.lookAt(center);
        controls.update();
      };
      const resize = () => {
        const w = Math.max(1, host.clientWidth); const h = Math.max(1, host.clientHeight);
        camera.aspect = w / h; camera.updateProjectionMatrix();
        fitCamera(); renderer.setSize(w, h, false);
        schedule();
      };
      const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
      const intersection = new IntersectionObserver(([entry]) => { inViewport = entry.isIntersecting; if (inViewport && !document.hidden) schedule(); else { cancelAnimationFrame(frame); frame = 0; } }); intersection.observe(host);
      const onVisibility = () => { visible = !document.hidden; if (visible && inViewport) schedule(); else { cancelAnimationFrame(frame); frame = 0; } };
      const onContextLost = (event) => { event.preventDefault(); setError(true); };
      renderer.domElement.addEventListener('webglcontextlost', onContextLost);
      document.addEventListener('visibilitychange', onVisibility);

      const active = { root: model, id: speciesId, open, dispose: disposeFlower };
      const animate = (time) => {
        frame = 0; if (!visible || !inViewport) return;
        const stateAtFrameStart = sceneRef.current;
        const explicitWind = stateAtFrameStart?.windEnabled ?? windEnabled;
        // Keep wind motion at display refresh rate; adaptive resolution below
        // protects slower GPUs without making the flower visibly stutter.
        const frameInterval = explicitWind ? 1000 / 60 : (reducedMotion ? 100 : 1000 / 60);
        if (time - lastRender < frameInterval) {
          const pending = sceneRef.current;
          if (pending && (pending.windEnabled || time < pending.interactionUntil)) schedule();
          return;
        }
        lastRender = time;
        const current = sceneRef.current?.active || active;
        if (current.root.userData.plantRig) {
          // prefers-reduced-motion keeps wind off by default; an explicit click
          // on the wind control is a user override and should visibly work.
          const wind = current.root.userData.windEnabled;
          // Small, visibly readable stem sway; previous 0.008 rad was almost
          // imperceptible at normal viewing distance.
          current.root.userData.plantRig.rotation.z = wind ? Math.sin(time * .00048) * .024 : 0;
          current.root.userData.plantRig.rotation.x = wind ? Math.sin(time * .00037 + .8) * .008 : 0;
        }
        if (current.root.userData.windEnabled) {
          for (const material of current.root.userData.windMaterials || []) {
            const shader = material.userData.flowerShader;
            if (shader) { shader.uniforms.uFlowerTime.value = time * .001; shader.uniforms.uFlowerWind.value = 1.05; }
          }
        }
        controls.update(); renderer.render(scene, camera);
        host.dataset.gardenDrawCalls = String(renderer.info.render.calls);
        host.dataset.gardenPixelRatio = String(renderer.getPixelRatio());
        host.dataset.gardenGeometries = String(renderer.info.memory.geometries);
        host.dataset.gardenTextures = String(renderer.info.memory.textures);
        const petalCache = getPetalGeometryCacheStats();
        host.dataset.gardenPetalGeometryCache = String(petalCache.entries);
        host.dataset.gardenPetalGeometryReferences = String(petalCache.activeReferences);
        const stats = sceneRef.current;
        if (stats) {
          stats.fpsFrames += 1;
          const fpsNow = Date.now();
          if (fpsNow - stats.lastFpsAt > 650) {
            if (fpsNow < (stats.fpsWarmupUntil || 0)) {
              stats.fpsFrames = 0; stats.lastFpsAt = fpsNow;
            } else {
              stats.fps = Math.round(stats.fpsFrames * 1000 / (fpsNow - stats.lastFpsAt)); stats.fpsFrames = 0; stats.lastFpsAt = fpsNow; host.dataset.gardenFps = String(stats.fps);
              const activelyAnimating = current.root.userData.windEnabled || performance.now() < stats.interactionUntil;
              if (stats.fps < 30 && activelyAnimating && stats.qualityStep < 2) {
                // Keep the user-requested motion; reduce resolution in two
                // bounded steps if it cannot sustain the 30 FPS target.
                const targets = compact ? [1.0, 0.8] : [0.9, 0.75];
                const lowerPixelRatio = Math.min(renderer.getPixelRatio(), targets[stats.qualityStep]);
                stats.qualityStep += 1;
                renderer.setPixelRatio(lowerPixelRatio);
                renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight), false);
                host.dataset.gardenQuality = `adaptive-${stats.qualityStep}`;
                host.dataset.gardenPixelRatio = String(lowerPixelRatio);
                stats.lastFpsAt = Date.now(); stats.fpsFrames = 0;
              }
            }
          }
        }
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          window.__flowerViewerStats = {
            fps: stats?.fps || 0,
            drawCalls: renderer.info.render.calls,
            pixelRatio: renderer.getPixelRatio(),
            geometries: renderer.info.memory.geometries,
            textures: renderer.info.memory.textures,
            gpuRenderer,
            petalCache: getPetalGeometryCacheStats(),
          };
        }
        const state = sceneRef.current;
        if (state && (state.windEnabled || time < state.interactionUntil)) schedule();
      };
      function schedule() { if (!frame && visible && inViewport) frame = requestAnimationFrame(animate); }

      resize(); sceneRef.current = { scene, camera, controls, renderer, active, view, fitCamera, schedule, resizeObserver, intersection, onVisibility, onContextLost, shadowMap, contactShadow, ground, lastFpsAt: Date.now(), fpsFrames: 0, reducedMotion, compact, initialPixelRatio, qualityStep: 0, windEnabled, interactionUntil: 0 };
      schedule(); host.dataset.gardenRenderer = 'flower-pot';

      return () => {
        cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', onVisibility);
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost); resizeObserver.disconnect(); intersection.disconnect(); controls.dispose();
        disposeFlower(sceneRef.current?.active?.root || model);
        shadowMap.dispose(); contactShadow.geometry.dispose(); contactShadow.material.dispose(); ground.geometry.dispose(); ground.material.dispose(); renderer.dispose(); renderer.domElement.remove(); sceneRef.current = null;
      };
    } catch (caught) {
      console.error('Không dựng được mô hình hoa:', caught); setError(true); disposeFlower(model); renderer?.dispose(); renderer?.domElement.remove();
      return undefined;
    }
  // Scene initialization is intentionally one-shot; species swaps happen in the next effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const current = sceneRef.current; if (!current || current.active.id === speciesId) return;
    const nextRoot = makeModel(speciesId, speciesRecord, open, windEnabled);
    const next = { root: nextRoot, id: speciesId, open, dispose: disposeFlower };
    current.scene.remove(current.active.root); current.active.dispose(current.active.root);
    current.scene.add(nextRoot);
    current.active = next;
    current.view = speciesId === 'daisy' ? daisyView : defaultView;
    current.controls.target.copy(current.view.target); current.camera.position.copy(current.view.position); current.fitCamera(); current.controls.update(); current.schedule();
  }, [speciesId, speciesRecord]);

  useEffect(() => {
    const canvas = hostRef.current?.querySelector('canvas');
    canvas?.setAttribute('aria-label', `Mô hình 3D ${speciesName} dựng bằng hình học`);
  }, [speciesName]);

  useEffect(() => {
    const current = sceneRef.current; if (!current) return;
    current.active.open = open;
    current.active.root.userData.setOpen(open);
    current.schedule();
  }, [open]);

  useEffect(() => {
    const current = sceneRef.current; if (!current) return;
    current.windEnabled = windEnabled;
    current.active.root.userData.windEnabled = windEnabled;
    if (windEnabled) { current.lastFpsAt = Date.now(); current.fpsFrames = 0; current.fpsWarmupUntil = current.lastFpsAt + 1000; }
    if (!windEnabled && current.qualityStep > 0) {
      current.renderer.setPixelRatio(current.initialPixelRatio);
      current.renderer.setSize(Math.max(1, hostRef.current.clientWidth), Math.max(1, hostRef.current.clientHeight), false);
      current.qualityStep = 0;
      hostRef.current.dataset.gardenQuality = 'sharp-still';
      hostRef.current.dataset.gardenPixelRatio = String(current.renderer.getPixelRatio());
    }
    current.schedule();
  }, [windEnabled]);

  useEffect(() => {
    const current = sceneRef.current; if (!current || resetKey === 0) return;
    current.controls.target.copy(current.view.target); current.camera.position.copy(current.view.position); current.fitCamera(); current.controls.update(); current.schedule();
  }, [resetKey]);

  const displayScientificName = scientificName || speciesName || speciesId;
  return <div className={`rose-viewer${error ? ' rose-viewer-error' : ''}`} ref={hostRef}>
    {error && <div className="rose-viewer-fallback"><p>Thiết bị chưa dựng được mô hình 3D cho {speciesName.toLowerCase()}.</p></div>}
    {hintVisible && !error && <div className="rose-viewer-hint"><span>✧</span> Kéo để xoay · Cuộn để phóng to</div>}
    <div className="rose-viewer-caption"><span>{displayScientificName.toUpperCase()}</span><b>{speciesName} · mô hình 3D dựng bằng hình học</b></div>
  </div>;
}
