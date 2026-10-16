import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Sun,
  Moon,
  CloudSun,
  Sunset,
  Volume2,
  VolumeX,
  Sparkles,
  Info,
  Maximize2,
  RotateCcw,
  Flower2,
  Eye,
  Sliders,
} from 'lucide-react';
import { FlowerSpecies } from '../types';

interface Garden3DViewProps {
  speciesList: FlowerSpecies[];
  onSelectSpecies: (species: FlowerSpecies) => void;
  onAskChatbot: (question: string) => void;
}

export const Garden3DView: React.FC<Garden3DViewProps> = ({
  speciesList,
  onSelectSpecies,
  onAskChatbot,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'sunset' | 'night' | 'dawn'>('day');
  const [selectedFlower, setSelectedFlower] = useState<{
    id: string;
    name: string;
    scientific: string;
    meaning: string;
    care: string;
    speciesId: string;
  } | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);
  const [bloomProgress, setBloomProgress] = useState<number>(1);
  const [windSpeed, setWindSpeed] = useState<number>(1);

  // Audio Context ref for ambient nature synth
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioGainRef = useRef<GainNode | null>(null);

  // References to 3D scene elements to manipulate in real-time
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const flowerGroupsRef = useRef<THREE.Group[]>([]);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const firefliesRef = useRef<THREE.Points | null>(null);

  // Sound generator using Web Audio API (ambient wind breeze synth)
  const toggleAudio = () => {
    if (isAudioMuted) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioCtxRef.current) {
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;

          // White noise buffer for gentle wind
          const bufferSize = ctx.sampleRate * 2;
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
          }

          const whiteNoise = ctx.createBufferSource();
          whiteNoise.buffer = noiseBuffer;
          whiteNoise.loop = true;

          // Gentle low-pass filter
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(320, ctx.currentTime);

          const gainNode = ctx.createGain();
          gainNode.gain.setValueAtTime(0.04, ctx.currentTime);
          audioGainRef.current = gainNode;

          whiteNoise.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(ctx.destination);
          whiteNoise.start();
        } else if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }

        if (audioGainRef.current && audioCtxRef.current) {
          audioGainRef.current.gain.setValueAtTime(0.05, audioCtxRef.current.currentTime);
        }
        setIsAudioMuted(false);
      } catch (e) {
        console.warn('Audio synthesis not supported or blocked:', e);
      }
    } else {
      if (audioGainRef.current && audioCtxRef.current) {
        audioGainRef.current.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
      }
      setIsAudioMuted(true);
    }
  };

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Update lighting and atmosphere based on time of day
  useEffect(() => {
    if (!sceneRef.current || !dirLightRef.current || !hemiLightRef.current) return;
    const scene = sceneRef.current;
    const dir = dirLightRef.current;
    const hemi = hemiLightRef.current;

    if (timeOfDay === 'day') {
      scene.background = new THREE.Color(0xd9ecf2);
      scene.fog = new THREE.FogExp2(0xd9ecf2, 0.022);
      dir.color.set(0xfff8eb);
      dir.intensity = 1.6;
      dir.position.set(12, 18, 10);
      hemi.color.set(0xecf8ff);
      hemi.groundColor.set(0x384a32);
      hemi.intensity = 0.8;
      if (firefliesRef.current) firefliesRef.current.visible = false;
    } else if (timeOfDay === 'sunset') {
      scene.background = new THREE.Color(0x3d263b);
      scene.fog = new THREE.FogExp2(0x3d263b, 0.025);
      dir.color.set(0xff8844);
      dir.intensity = 1.4;
      dir.position.set(18, 6, 8);
      hemi.color.set(0xffaa77);
      hemi.groundColor.set(0x2a1d26);
      hemi.intensity = 0.6;
      if (firefliesRef.current) firefliesRef.current.visible = true;
    } else if (timeOfDay === 'night') {
      scene.background = new THREE.Color(0x0a0f1d);
      scene.fog = new THREE.FogExp2(0x0a0f1d, 0.03);
      dir.color.set(0x6688cc);
      dir.intensity = 0.5;
      dir.position.set(-8, 12, -6);
      hemi.color.set(0x1a2644);
      hemi.groundColor.set(0x05080e);
      hemi.intensity = 0.4;
      if (firefliesRef.current) firefliesRef.current.visible = true;
    } else if (timeOfDay === 'dawn') {
      scene.background = new THREE.Color(0xd8d3cf);
      scene.fog = new THREE.FogExp2(0xd8d3cf, 0.028);
      dir.color.set(0xffd5b8);
      dir.intensity = 1.2;
      dir.position.set(-14, 8, 10);
      hemi.color.set(0xffece0);
      hemi.groundColor.set(0x2d3a29);
      hemi.intensity = 0.7;
      if (firefliesRef.current) firefliesRef.current.visible = false;
    }
  }, [timeOfDay]);

  // Main Three.js Scene Setup
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xd9ecf2);
    scene.fog = new THREE.FogExp2(0xd9ecf2, 0.022);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 6, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // 2. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.04; // Don't dip below ground
    controls.minDistance = 3;
    controls.maxDistance = 26;
    controls.target.set(0, 1.2, 0);

    // 3. Lighting (PBR Studio: Key Directional + Hemisphere Fill + Ambient)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xecf8ff, 0x384a32, 0.8);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    const dirLight = new THREE.DirectionalLight(0xfff8eb, 1.6);
    dirLight.position.set(12, 18, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 40;
    dirLight.shadow.camera.left = -10;
    dirLight.shadow.camera.right = 10;
    dirLight.shadow.camera.top = 10;
    dirLight.shadow.camera.bottom = -10;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);
    dirLightRef.current = dirLight;

    // 4. Greenhouse Floor & Raised Stone Planter Bed
    const floorGeo = new THREE.PlaneGeometry(60, 60);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x223026,
      roughness: 0.9,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Garden wooden deck platform
    const platformGeo = new THREE.CylinderGeometry(8.5, 9.0, 0.3, 48);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x5a4838,
      roughness: 0.75,
      metalness: 0.05,
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = 0.15;
    platform.receiveShadow = true;
    scene.add(platform);

    // Soil inner bed
    const soilGeo = new THREE.CylinderGeometry(7.8, 7.8, 0.32, 48);
    const soilMat = new THREE.MeshStandardMaterial({
      color: 0x2c1f14,
      roughness: 0.95,
      metalness: 0.02,
    });
    const soil = new THREE.Mesh(soilGeo, soilMat);
    soil.position.y = 0.17;
    soil.receiveShadow = true;
    scene.add(soil);

    // Decorative glass dome ribs (Greenhouse architecture)
    const domeRibs = new THREE.Group();
    const ribMat = new THREE.MeshStandardMaterial({
      color: 0x1d382b,
      metalness: 0.6,
      roughness: 0.3,
    });
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const ribGeo = new THREE.TorusGeometry(8.5, 0.06, 8, 36, Math.PI);
      const rib = new THREE.Mesh(ribGeo, ribMat);
      rib.position.y = 0.3;
      rib.rotation.y = angle;
      domeRibs.add(rib);
    }
    scene.add(domeRibs);

    // 5. Build Composite 3D Flower Models (3-12 parts per flower)
    const flowerGroups: THREE.Group[] = [];
    flowerGroupsRef.current = flowerGroups;

    // Helper: Create a Pot
    const createPot = (radius = 0.7, height = 0.9, color = 0xb45309) => {
      const potGroup = new THREE.Group();
      const potGeo = new THREE.CylinderGeometry(radius * 1.1, radius * 0.75, height, 24);
      const potMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });
      const pot = new THREE.Mesh(potGeo, potMat);
      pot.castShadow = true;
      pot.receiveShadow = true;
      pot.position.y = height / 2;
      potGroup.add(pot);

      // Pot rim
      const rimGeo = new THREE.TorusGeometry(radius * 1.15, 0.06, 8, 24);
      const rim = new THREE.Mesh(rimGeo, potMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = height;
      potGroup.add(rim);

      // Pot soil inside
      const potSoilGeo = new THREE.CircleGeometry(radius * 1.05, 18);
      const potSoilMat = new THREE.MeshStandardMaterial({ color: 0x1f140e, roughness: 0.95 });
      const potSoil = new THREE.Mesh(potSoilGeo, potSoilMat);
      potSoil.rotation.x = -Math.PI / 2;
      potSoil.position.y = height - 0.02;
      potGroup.add(potSoil);

      return potGroup;
    };

    // A. 3D Hoa Hồng (Rose) Model: Multilayered spiraling petals, stem, thorns, leaves
    const createRose = (x: number, z: number) => {
      const group = new THREE.Group();
      group.position.set(x, 0.3, z);
      group.userData = {
        id: 'roses',
        name: 'Hoa Hồng Đỏ',
        scientific: 'Rosa spp.',
        meaning: 'Tình yêu say đắm, sự đam mê và vẻ đẹp thanh cao quý phái.',
        care: 'Cần ít nhất 6 giờ nắng mỗi ngày, tưới vào sáng sớm, bón phân hữu cơ định kỳ 2 tuần/lần.',
        speciesId: 'roses',
      };

      const pot = createPot(0.65, 0.85, 0x8b3a1a);
      group.add(pot);

      // Stem (curved tube)
      const stemCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.85, 0),
        new THREE.Vector3(0.08, 1.6, 0.05),
        new THREE.Vector3(-0.04, 2.3, -0.03),
        new THREE.Vector3(0, 2.8, 0),
      ]);
      const stemGeo = new THREE.TubeGeometry(stemCurve, 20, 0.05, 8, false);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.6 });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.castShadow = true;
      group.add(stem);

      // Thorns
      for (let t = 0; t < 4; t++) {
        const thornGeo = new THREE.ConeGeometry(0.035, 0.1, 6);
        const thornMat = new THREE.MeshStandardMaterial({ color: 0x4a2a1a, roughness: 0.7 });
        const thorn = new THREE.Mesh(thornGeo, thornMat);
        thorn.position.set(0.05, 1.2 + t * 0.35, 0.02);
        thorn.rotation.z = Math.PI / 2.5;
        group.add(thorn);
      }

      // Leaves (serrated ovals)
      const leafGeo = new THREE.ConeGeometry(0.22, 0.45, 4);
      leafGeo.scale(1, 0.15, 1);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x1e5022, roughness: 0.5 });
      const leaf1 = new THREE.Mesh(leafGeo, leafMat);
      leaf1.position.set(0.28, 1.5, 0.15);
      leaf1.rotation.set(0.4, 0.2, -0.6);
      leaf1.castShadow = true;
      group.add(leaf1);

      const leaf2 = new THREE.Mesh(leafGeo, leafMat);
      leaf2.position.set(-0.25, 2.0, -0.1);
      leaf2.rotation.set(-0.3, -0.4, 0.7);
      leaf2.castShadow = true;
      group.add(leaf2);

      // Calyx (sepals)
      const sepalMat = new THREE.MeshStandardMaterial({ color: 0x2e6b29, roughness: 0.6 });
      for (let s = 0; s < 5; s++) {
        const sepalGeo = new THREE.ConeGeometry(0.08, 0.3, 4);
        const sepal = new THREE.Mesh(sepalGeo, sepalMat);
        const a = (s * Math.PI * 2) / 5;
        sepal.position.set(Math.cos(a) * 0.12, 2.76, Math.sin(a) * 0.12);
        sepal.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
        group.add(sepal);
      }

      // Petal Layers (concentric swirling tiers)
      const head = new THREE.Group();
      head.position.set(0, 2.9, 0);
      const petalMat = new THREE.MeshStandardMaterial({
        color: 0xbe123c, // Rich red
        roughness: 0.45,
        metalness: 0.08,
      });

      // Outer petals
      for (let p = 0; p < 8; p++) {
        const ang = (p * Math.PI * 2) / 8;
        const pGeo = new THREE.CylinderGeometry(0.2, 0.08, 0.4, 8, 1, true, 0, Math.PI);
        const pMesh = new THREE.Mesh(pGeo, petalMat);
        pMesh.position.set(Math.cos(ang) * 0.22, 0.1, Math.sin(ang) * 0.22);
        pMesh.rotation.y = -ang + Math.PI / 2;
        pMesh.rotation.x = 0.35;
        pMesh.castShadow = true;
        head.add(pMesh);
      }

      // Middle petals
      for (let p = 0; p < 6; p++) {
        const ang = (p * Math.PI * 2) / 6 + 0.4;
        const pGeo = new THREE.CylinderGeometry(0.15, 0.06, 0.35, 8, 1, true, 0, Math.PI);
        const pMesh = new THREE.Mesh(pGeo, petalMat);
        pMesh.position.set(Math.cos(ang) * 0.12, 0.18, Math.sin(ang) * 0.12);
        pMesh.rotation.y = -ang + Math.PI / 2;
        pMesh.rotation.x = 0.2;
        pMesh.castShadow = true;
        head.add(pMesh);
      }

      // Center bud
      const budGeo = new THREE.SphereGeometry(0.12, 12, 12);
      const budMat = new THREE.MeshStandardMaterial({ color: 0x9f1239, roughness: 0.4 });
      const bud = new THREE.Mesh(budGeo, budMat);
      bud.position.y = 0.22;
      head.add(bud);

      group.add(head);
      scene.add(group);
      flowerGroups.push(group);
      return group;
    };

    // B. 3D Hoa Hướng Dương (Sunflower) Model
    const createSunflower = (x: number, z: number) => {
      const group = new THREE.Group();
      group.position.set(x, 0.3, z);
      group.userData = {
        id: 'sunflowers',
        name: 'Hoa Hướng Dương',
        scientific: 'Helianthus annuus',
        meaning: 'Niềm tin, hy vọng, lòng trung kiên và nguồn năng lượng mặt trời ấm áp.',
        care: 'Cần đất tơi xốp giàu dinh dưỡng, 7-8 giờ nắng trực tiếp mỗi ngày, chịu hạn tốt khi trưởng thành.',
        speciesId: 'sunflowers',
      };

      const pot = createPot(0.75, 0.95, 0x78350f);
      group.add(pot);

      // Sturdy stalk
      const stalkGeo = new THREE.CylinderGeometry(0.08, 0.1, 3.4, 16);
      const stalkMat = new THREE.MeshStandardMaterial({ color: 0x3d702e, roughness: 0.7 });
      const stalk = new THREE.Mesh(stalkGeo, stalkMat);
      stalk.position.y = 0.95 + 1.7;
      stalk.castShadow = true;
      group.add(stalk);

      // Broad heart leaves
      const leafGeo = new THREE.ConeGeometry(0.4, 0.7, 4);
      leafGeo.scale(1, 0.12, 1);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6024, roughness: 0.6 });
      const l1 = new THREE.Mesh(leafGeo, leafMat);
      l1.position.set(0.45, 1.8, 0.2);
      l1.rotation.set(0.3, 0.5, -0.6);
      l1.castShadow = true;
      group.add(l1);

      const l2 = new THREE.Mesh(leafGeo, leafMat);
      l2.position.set(-0.45, 2.4, -0.15);
      l2.rotation.set(-0.2, -0.4, 0.6);
      l2.castShadow = true;
      group.add(l2);

      // Head: Seed Disc + Radiating Ray Florets
      const head = new THREE.Group();
      head.position.set(0, 4.3, 0);
      head.rotation.x = 0.25; // Turned toward sun

      // Disc
      const discGeo = new THREE.CylinderGeometry(0.55, 0.52, 0.15, 24);
      const discMat = new THREE.MeshStandardMaterial({
        color: 0x3d2112,
        roughness: 0.95,
        bumpScale: 0.05,
      });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.rotation.x = Math.PI / 2;
      disc.castShadow = true;
      head.add(disc);

      // 20 Petals
      const petalGeo = new THREE.ConeGeometry(0.18, 0.7, 4);
      petalGeo.scale(1, 0.15, 1);
      const petalMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.4,
        metalness: 0.05,
      });

      for (let p = 0; p < 20; p++) {
        const ang = (p * Math.PI * 2) / 20;
        const petal = new THREE.Mesh(petalGeo, petalMat);
        petal.position.set(Math.cos(ang) * 0.75, Math.sin(ang) * 0.75, 0);
        petal.rotation.z = ang - Math.PI / 2;
        petal.castShadow = true;
        head.add(petal);
      }

      group.add(head);
      scene.add(group);
      flowerGroups.push(group);
      return group;
    };

    // C. 3D Hoa Tulip Model
    const createTulip = (x: number, z: number) => {
      const group = new THREE.Group();
      group.position.set(x, 0.3, z);
      group.userData = {
        id: 'tulips',
        name: 'Hoa Tulip Hà Lan',
        scientific: 'Tulipa gesneriana',
        meaning: 'Sự hoàn hảo, quý phái, thanh lịch và cuộc sống vĩnh cửu.',
        care: 'Ưa khí hậu ôn đới 15-20°C, củ cần ủ lạnh trước khi ươm, đất cát pha thoát nước cực tốt.',
        speciesId: 'tulips',
      };

      const pot = createPot(0.6, 0.8, 0x475569);
      group.add(pot);

      // Stem
      const stemGeo = new THREE.CylinderGeometry(0.04, 0.05, 2.2, 12);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.5 });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.8 + 1.1;
      stem.castShadow = true;
      group.add(stem);

      // Lanceolate long leaves
      const leafGeo = new THREE.CylinderGeometry(0.02, 0.18, 1.6, 6, 1, false, 0, Math.PI);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.55 });
      const leaf1 = new THREE.Mesh(leafGeo, leafMat);
      leaf1.position.set(0.12, 1.4, 0.08);
      leaf1.rotation.set(0.1, 0.2, -0.25);
      group.add(leaf1);

      const leaf2 = new THREE.Mesh(leafGeo, leafMat);
      leaf2.position.set(-0.12, 1.2, -0.05);
      leaf2.rotation.set(-0.15, -0.3, 0.3);
      group.add(leaf2);

      // Cup-shaped Bell Petals (6 overlapping petals)
      const head = new THREE.Group();
      head.position.set(0, 3.0, 0);
      const petalMat = new THREE.MeshStandardMaterial({
        color: 0xec4899, // Bright pink/magenta
        roughness: 0.3,
        metalness: 0.1,
      });

      for (let p = 0; p < 6; p++) {
        const ang = (p * Math.PI * 2) / 6;
        const pGeo = new THREE.CylinderGeometry(0.24, 0.12, 0.65, 8, 1, true, 0, Math.PI * 0.8);
        const pMesh = new THREE.Mesh(pGeo, petalMat);
        pMesh.position.set(Math.cos(ang) * 0.15, 0.2, Math.sin(ang) * 0.15);
        pMesh.rotation.y = -ang + Math.PI / 2;
        pMesh.rotation.x = 0.15;
        pMesh.castShadow = true;
        head.add(pMesh);
      }

      group.add(head);
      scene.add(group);
      flowerGroups.push(group);
      return group;
    };

    // D. 3D Cúc Họa Mi (Daisy) Model
    const createDaisy = (x: number, z: number) => {
      const group = new THREE.Group();
      group.position.set(x, 0.3, z);
      group.userData = {
        id: 'daisy',
        name: 'Cúc Họa Mi',
        scientific: 'Bellis perennis',
        meaning: 'Sự ngây thơ, thuần khiết, tình yêu âm thầm và nét đẹp mộc mạc dịu dàng.',
        care: 'Ưa thời tiết se lạnh đầu đông (tháng 11), ánh nắng nhẹ dịu, tưới sát gốc và đất thoát nước tốt.',
        speciesId: 'daisy',
      };

      const pot = createPot(0.65, 0.75, 0x10b981);
      group.add(pot);

      // Multiple daisy stems in a cluster
      const clusterMat = new THREE.MeshStandardMaterial({ color: 0x2e8540, roughness: 0.6 });
      const whitePetalMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.3 });
      const yellowEyeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.8 });

      const offsets = [
        { x: 0, z: 0, h: 2.2 },
        { x: 0.18, z: 0.12, h: 1.9 },
        { x: -0.16, z: 0.1, h: 1.8 },
      ];

      offsets.forEach((off) => {
        const stemGeo = new THREE.CylinderGeometry(0.03, 0.04, off.h - 0.75, 8);
        const stem = new THREE.Mesh(stemGeo, clusterMat);
        stem.position.set(off.x, 0.75 + (off.h - 0.75) / 2, off.z);
        group.add(stem);

        const flowerHead = new THREE.Group();
        flowerHead.position.set(off.x, off.h, off.z);

        // Center eye
        const eyeGeo = new THREE.SphereGeometry(0.14, 12, 12);
        eyeGeo.scale(1, 0.4, 1);
        const eye = new THREE.Mesh(eyeGeo, yellowEyeMat);
        flowerHead.add(eye);

        // 16 Petals
        for (let i = 0; i < 16; i++) {
          const a = (i * Math.PI * 2) / 16;
          const pGeo = new THREE.BoxGeometry(0.08, 0.02, 0.35);
          const petal = new THREE.Mesh(pGeo, whitePetalMat);
          petal.position.set(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25);
          petal.rotation.y = -a + Math.PI / 2;
          flowerHead.add(petal);
        }

        group.add(flowerHead);
      });

      scene.add(group);
      flowerGroups.push(group);
      return group;
    };

    // E. 3D Hoa Bồ Công Anh (Dandelion) Model
    const createDandelion = (x: number, z: number) => {
      const group = new THREE.Group();
      group.position.set(x, 0.3, z);
      group.userData = {
        id: 'dandelion',
        name: 'Hoa Bồ Công Anh',
        scientific: 'Taraxacum officinale',
        meaning: 'Tự do, ước mơ bay xa, sức sống mãnh liệt và bài thuốc đông y quý thanh nhiệt.',
        care: 'Rất dễ sống, chịu hạn cao, thích nghi mọi loại đất, rễ và lá đều có thể phơi khô làm trà.',
        speciesId: 'dandelion',
      };

      const pot = createPot(0.6, 0.7, 0x64748b);
      group.add(pot);

      // Stem
      const stemGeo = new THREE.CylinderGeometry(0.035, 0.045, 1.8, 8);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.6 });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.7 + 0.9;
      group.add(stem);

      // Rosette jagged leaves at base
      for (let l = 0; l < 5; l++) {
        const ang = (l * Math.PI * 2) / 5;
        const leafGeo = new THREE.ConeGeometry(0.2, 0.7, 3);
        leafGeo.scale(1, 0.08, 1);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.7 });
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.set(Math.cos(ang) * 0.35, 0.75, Math.sin(ang) * 0.35);
        leaf.rotation.set(0.6 * Math.sin(ang), 0, -0.6 * Math.cos(ang));
        group.add(leaf);
      }

      // Fluffy Seed Ball (Pappus globe)
      const head = new THREE.Group();
      head.position.set(0, 2.5, 0);

      const centerBallGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const centerMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.9 });
      const center = new THREE.Mesh(centerBallGeo, centerMat);
      head.add(center);

      // Procedural fuzzy spikes
      const spikeGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.45, 4);
      const fluffMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.8,
        transparent: true,
        opacity: 0.85,
      });

      for (let i = 0; i < 48; i++) {
        const phi = Math.acos(-1 + (2 * i) / 48);
        const theta = Math.sqrt(48 * Math.PI) * phi;
        const spike = new THREE.Mesh(spikeGeo, fluffMat);
        const dir = new THREE.Vector3(
          Math.cos(theta) * Math.sin(phi),
          Math.sin(theta) * Math.sin(phi),
          Math.cos(phi)
        );
        spike.position.copy(dir.clone().multiplyScalar(0.25));
        spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        head.add(spike);
      }

      group.add(head);
      scene.add(group);
      flowerGroups.push(group);
      return group;
    };

    // Spawn 5 Highlight Flowers in a semicircular garden layout
    createRose(-3.5, 0.5);
    createSunflower(-1.8, -1.8);
    createTulip(0, -2.5);
    createDaisy(1.8, -1.8);
    createDandelion(3.5, 0.5);

    // 6. Glowing Fireflies Particle System (Visible in Sunset / Night)
    const fireflyCount = 90;
    const fireflyGeo = new THREE.BufferGeometry();
    const fireflyPos = new Float32Array(fireflyCount * 3);
    for (let i = 0; i < fireflyCount * 3; i += 3) {
      fireflyPos[i] = (Math.random() - 0.5) * 14;
      fireflyPos[i + 1] = 0.5 + Math.random() * 5;
      fireflyPos[i + 2] = (Math.random() - 0.5) * 14;
    }
    fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPos, 3));

    // Create glowing circle canvas texture for firefly
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(250, 250, 150, 1)');
      grad.addColorStop(0.3, 'rgba(180, 255, 100, 0.7)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
    }
    const fireflyTexture = new THREE.CanvasTexture(canvas);

    const fireflyMat = new THREE.PointsMaterial({
      size: 0.35,
      map: fireflyTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const fireflies = new THREE.Points(fireflyGeo, fireflyMat);
    fireflies.visible = false;
    scene.add(fireflies);
    firefliesRef.current = fireflies;

    // 7. Raycasting for flower selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(flowerGroups, true);

      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && !obj.userData?.name && obj.parent) {
          obj = obj.parent;
        }
        if (obj && obj.userData?.name) {
          setSelectedFlower(obj.userData as any);
        }
      }
    };

    container.addEventListener('pointerdown', handlePointerDown);

    // 8. 60 FPS Render Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Gentle natural wind sway on all flowers
      flowerGroups.forEach((fg, idx) => {
        const sway = Math.sin(t * 1.5 * windSpeed + idx * 1.2) * 0.04 * windSpeed;
        fg.rotation.z = sway;
        fg.rotation.x = Math.cos(t * 1.2 * windSpeed + idx) * 0.02 * windSpeed;
      });

      // Animate fireflies floating
      if (fireflies.visible) {
        const positions = fireflyGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < fireflyCount * 3; i += 3) {
          positions[i + 1] += Math.sin(t * 2 + i) * 0.006;
          positions[i] += Math.cos(t * 1.5 + i) * 0.005;
        }
        fireflyGeo.attributes.position.needsUpdate = true;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // 9. Handle Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointerdown', handlePointerDown);
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="space-y-6 pb-16">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Không Gian 3D &bull; Three.js Studio PBR + Raycasting</span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-900">
            Vườn Hoa 3D — Nhà Kính Sinh Thái
          </h1>
          <p className="text-sm text-stone-600 max-w-2xl">
            Tương tác xoay 360°, phóng to/thu nhỏ, đổi thời gian trong ngày (bình minh, trưa nắng, hoàng hôn, đêm sao) 
            và chạm vào từng đóa hoa 3D để khám phá giải phẫu học thực vật.
          </p>
        </div>

        {/* Ambient Nature Sound Toggle */}
        <button
          onClick={toggleAudio}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
            !isAudioMuted
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
          }`}
        >
          {!isAudioMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          <span>{!isAudioMuted ? 'Âm thanh gió tự nhiên: Bật' : 'Bật âm thanh thiên nhiên'}</span>
        </button>
      </div>

      {/* 3D Viewport Box */}
      <div className="relative rounded-3xl overflow-hidden border border-stone-200 shadow-xl bg-stone-900 h-[560px] sm:h-[620px] select-none">
        {/* Three.js Canvas Container */}
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Floating Top Controls Toolbar */}
        <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
          {/* Time of Day Switcher */}
          <div className="flex items-center gap-1 bg-stone-900/80 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 pointer-events-auto shadow-lg">
            {[
              { id: 'dawn', label: 'Bình minh', icon: CloudSun },
              { id: 'day', label: 'Trưa nắng', icon: Sun },
              { id: 'sunset', label: 'Hoàng hôn', icon: Sunset },
              { id: 'night', label: 'Đêm sao', icon: Moon },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = timeOfDay === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTimeOfDay(t.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-stone-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Help Hint */}
          <div className="hidden sm:flex items-center gap-2 bg-stone-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-stone-300 text-xs pointer-events-auto">
            <Info className="w-3.5 h-3.5 text-emerald-400" />
            <span>Kéo chuột để xoay &bull; Lăn chuột để phóng to &bull; Chạm hoa để xem</span>
          </div>
        </div>

        {/* Bottom Wind Speed Slider Dock */}
        <div className="absolute bottom-4 left-4 bg-stone-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-white text-xs flex items-center gap-3 pointer-events-auto shadow-lg">
          <span className="text-stone-300">Gió vườn:</span>
          <input
            type="range"
            min="0"
            max="3"
            step="0.5"
            value={windSpeed}
            onChange={(e) => setWindSpeed(parseFloat(e.target.value))}
            className="w-20 accent-emerald-500 cursor-pointer"
          />
        </div>

        {/* Selected Flower Card Overlay */}
        {selectedFlower && (
          <div className="absolute bottom-4 right-4 max-w-sm w-full bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-emerald-200/90 shadow-2xl space-y-3 pointer-events-auto animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                Mô hình 3D PBR
              </span>
              <button
                onClick={() => setSelectedFlower(null)}
                className="text-stone-400 hover:text-stone-700 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <h3 className="font-serif font-bold text-lg text-stone-900">
                {selectedFlower.name}
              </h3>
              <p className="text-xs italic text-stone-500 font-serif">
                {selectedFlower.scientific}
              </p>
            </div>

            <p className="text-xs text-stone-600 line-clamp-2">
              <strong>Ý nghĩa:</strong> {selectedFlower.meaning}
            </p>

            <div className="p-2.5 rounded-xl bg-stone-50 text-[11px] text-stone-700 border border-stone-100">
              {selectedFlower.care}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  const sp = speciesList.find((s) => s.id === selectedFlower.speciesId);
                  if (sp) onSelectSpecies(sp);
                }}
                className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold cursor-pointer text-center"
              >
                Xem chi tiết bách khoa
              </button>
              <button
                onClick={() =>
                  onAskChatbot(
                    `Cô làm vườn ơi, hãy cho tôi biết mẹo chăm sóc hoa ${selectedFlower.name}?`
                  )
                }
                className="py-1.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-semibold cursor-pointer text-center"
              >
                Hỏi AI
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
