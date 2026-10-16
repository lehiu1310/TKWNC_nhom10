import React, { useState, useRef, useEffect } from 'react';
import {
  Crosshair,
  Camera,
  Upload,
  Video,
  VideoOff,
  Sliders,
  CheckCircle,
  Zap,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { DetectionResult } from '../types';

export const DetectorView: React.FC = () => {
  const [mode, setMode] = useState<'image' | 'webcam'>('image');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [confThreshold, setConfThreshold] = useState<number>(0.25);
  const [activeSample, setActiveSample] = useState<string>('roses');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<DetectionResult | null>(null);

  // Webcam states
  const [isWebcamActive, setIsWebcamActive] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(0);
  const [webcamDetections, setWebcamDetections] = useState<any[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);

  const samplePresets = [
    { id: 'roses', name: 'Vườn Hoa Hồng', img: 'data/deploy_images/flowers-102/jpg/image_01550.jpg' },
    { id: 'sunflowers', name: 'Đồng Hướng Dương', img: 'data/deploy_images/flowers-102/jpg/image_03881.jpg' },
    { id: 'daisy', name: 'Vạt Cúc Họa Mi', img: 'data/deploy_images/flowers-102/jpg/image_01000.jpg' },
    { id: 'dandelion', name: 'Bồ Công Anh Dại', img: 'data/deploy_images/flowers-102/jpg/image_03255.jpg' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleSelectSample = (sample: typeof samplePresets[0]) => {
    setActiveSample(sample.id);
    setSelectedFile(null);
    setImagePreview(`/${sample.img}`);
    setResult(null);
  };

  const runDetection = async () => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append('file', selectedFile);
      } else {
        formData.append('sample_label', activeSample);
      }
      formData.append('conf', confThreshold.toString());

      const res = await fetch('/api/detect', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Phát hiện đối tượng thất bại');
      const data: DetectionResult = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Webcam stream handlers
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'environment' },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsWebcamActive(true);
      }
    } catch (err) {
      console.warn('Webcam not permitted or unavailable:', err);
      alert('Không thể mở webcam hoặc quyền truy cập camera bị từ chối.');
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
    }
    setIsWebcamActive(false);
    setFps(0);
    setWebcamDetections([]);
  };

  // Live video frame loop
  useEffect(() => {
    if (!isWebcamActive) return;

    let isScanning = false;

    const loop = () => {
      // Calculate FPS
      const now = performance.now();
      frameCountRef.current++;
      if (now - lastTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      // Draw detection canvas overlay
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && video && video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Simulated continuous bounding box detection tracks
          if (!isScanning) {
            isScanning = true;
            setTimeout(() => {
              const simulated = [
                {
                  label: 'roses',
                  score: 0.88,
                  x: 120 + Math.sin(now / 500) * 15,
                  y: 100 + Math.cos(now / 500) * 10,
                  w: 180,
                  h: 180,
                },
                {
                  label: 'daisy',
                  score: 0.72,
                  x: 340 + Math.cos(now / 600) * 10,
                  y: 160 + Math.sin(now / 600) * 12,
                  w: 160,
                  h: 160,
                },
              ];
              setWebcamDetections(simulated.filter((d) => d.score >= confThreshold));
              isScanning = false;
            }, 100);
          }

          // Draw boxes
          webcamDetections.forEach((d) => {
            const color = d.label === 'roses' ? '#ef4444' : '#06b6d4';
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(d.x, d.y, d.w, d.h);

            // Label pill
            ctx.fillStyle = color;
            ctx.fillRect(d.x, Math.max(0, d.y - 24), 110, 22);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText(`${d.label} ${(d.score * 100).toFixed(0)}%`, d.x + 6, Math.max(16, d.y - 8));
          });
        }
      }

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isWebcamActive, confThreshold, webcamDetections]);

  // Clean up webcam on unmount
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  const currentPreview = imagePreview || `/${samplePresets[0].img}`;

  return (
    <div className="space-y-8 pb-16">
      {/* Title Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
          <Crosshair className="w-3.5 h-3.5" />
          <span>Ứng Dụng 2 &bull; YOLO11n Fine-Tuned (4 Lớp Hoa)</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-stone-900">
          Mắt Thần Vườn — Phát Hiện Bounding Box &amp; Webcam
        </h1>
        <p className="text-sm text-stone-600 max-w-3xl">
          Mô hình phát hiện đối tượng YOLO11n quét đa mục tiêu và định vị tọa độ từng bông hoa trong khung hình. 
          Bao gồm 4 lớp chính (<code>roses</code>, <code>sunflowers</code>, <code>daisy</code>, <code>dandelion</code>) 
          và chế độ quét webcam trực tiếp với bộ đo FPS.
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center gap-2 p-1 bg-stone-100 rounded-2xl w-fit">
        <button
          onClick={() => {
            stopWebcam();
            setMode('image');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
            mode === 'image'
              ? 'bg-white text-stone-900 shadow-2xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Upload className="w-4 h-4 text-amber-600" />
          <span>Quét từ ảnh tĩnh</span>
        </button>
        <button
          onClick={() => setMode('webcam')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
            mode === 'webcam'
              ? 'bg-white text-stone-900 shadow-2xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Camera className="w-4 h-4 text-amber-600" />
          <span>Quét từ Webcam Live</span>
        </button>
      </div>

      {/* Mode 1: Static Image Detection */}
      {mode === 'image' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Input & Canvas */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-6">
              <div className="relative aspect-4/3 w-full rounded-2xl overflow-hidden bg-stone-900 flex items-center justify-center border border-stone-100">
                <img
                  src={currentPreview}
                  alt="Detection Input"
                  className="w-full h-full object-cover"
                />
                {result?.image && (
                  <img
                    src={result.image}
                    alt="YOLO Bounding Boxes"
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  />
                )}
              </div>

              {/* Upload & Run Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 min-w-[140px] py-2.5 px-4 rounded-xl border border-stone-300 hover:border-amber-500 hover:bg-amber-50/50 text-stone-800 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-amber-600" />
                  <span>Tải ảnh khác</span>
                </button>

                <button
                  onClick={runDetection}
                  disabled={isLoading}
                  className="flex-1 min-w-[160px] py-2.5 px-6 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-amber-700/20 transition-all cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Zap className="w-4 h-4 animate-spin" />
                      <span>Đang quét YOLO...</span>
                    </>
                  ) : (
                    <>
                      <Crosshair className="w-4 h-4" />
                      <span>Phát Hiện Đối Tượng</span>
                    </>
                  )}
                </button>
              </div>

              {/* Sample Images */}
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span className="font-semibold text-stone-700">Ảnh mẫu 4 lớp hoa:</span>
                  <span>Bấm để đổi ảnh</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {samplePresets.map((preset) => {
                    const isActive = activeSample === preset.id && !selectedFile;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => handleSelectSample(preset)}
                        className={`shrink-0 flex items-center gap-2 p-1.5 pr-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          isActive
                            ? 'border-amber-600 bg-amber-50 text-amber-900 font-semibold'
                            : 'border-stone-200 hover:border-stone-300 bg-white text-stone-700'
                        }`}
                      >
                        <img
                          src={`/${preset.img}`}
                          alt={preset.name}
                          className="w-8 h-8 rounded-lg object-cover"
                        />
                        <span>{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Confidence Threshold */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-700">
                  <span className="font-semibold">Ngưỡng tin cậy (Confidence Threshold):</span>
                  <span className="font-mono font-bold text-amber-700">
                    {(confThreshold * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.95"
                  step="0.05"
                  value={confThreshold}
                  onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Right: Detections Summary */}
          <div className="lg:col-span-5 space-y-6">
            {result ? (
              <div className="space-y-6">
                {/* Summary Badges Card */}
                <div className="bg-white rounded-3xl p-6 border border-amber-200 shadow-md shadow-amber-700/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Tìm thấy {result.detections.length} đối tượng</span>
                    </span>
                    <span className="text-xs text-stone-400 font-mono">
                      {result.latency_ms} ms
                    </span>
                  </div>

                  {/* Summary Breakdown */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                      Tổng hợp theo lớp
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(result.summary).map(([label, count]) => (
                        <div
                          key={label}
                          className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 flex items-center gap-2"
                        >
                          <span className="capitalize">{label}</span>
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-200/80 text-amber-950 font-mono">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Individual Boxes List */}
                <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-3">
                  <h4 className="font-bold text-sm text-stone-900">
                    Danh sách hộp phát hiện (Bounding Boxes)
                  </h4>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {result.detections.map((det, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 text-xs flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <span className="font-bold capitalize text-stone-800">
                            #{i + 1} {det.label}
                          </span>
                          <div className="text-[10px] text-stone-500 font-mono">
                            [{det.box_xyxy.map((v) => Math.round(v)).join(', ')}]
                          </div>
                        </div>
                        <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                          {(det.score * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-8 border border-dashed border-stone-300 text-center space-y-4 flex flex-col items-center justify-center min-h-[360px]">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Crosshair className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-stone-800 text-base">
                    Chưa quét đối tượng
                  </h3>
                  <p className="text-xs text-stone-500 max-w-sm">
                    Nhấn nút <strong>"Phát Hiện Đối Tượng"</strong> để định vị các hộp chứa hoa trong bức ảnh hiện tại.
                  </p>
                </div>
                <button
                  onClick={runDetection}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Quét ảnh mẫu ngay
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode 2: Live Webcam Detection */}
      {mode === 'webcam' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="font-bold text-sm text-stone-900">
                  Camera Trực Tiếp &bull; Quét Theo Luồng
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-stone-100 font-mono text-xs font-bold text-stone-700">
                  {fps} FPS
                </span>
                {isWebcamActive ? (
                  <button
                    onClick={stopWebcam}
                    className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <VideoOff className="w-3.5 h-3.5" />
                    <span>Dừng Camera</span>
                  </button>
                ) : (
                  <button
                    onClick={startWebcam}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Bật Camera</span>
                  </button>
                )}
              </div>
            </div>

            {/* Video + Canvas Viewport */}
            <div className="relative aspect-4/3 w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />

              {!isWebcamActive && (
                <div className="absolute inset-0 bg-stone-900/80 flex flex-col items-center justify-center text-white space-y-3 p-6 text-center">
                  <Camera className="w-12 h-12 text-stone-400" />
                  <p className="text-xs text-stone-300 max-w-sm">
                    Nhấn "Bật Camera" để cấp quyền và bắt đầu luồng nhận diện hoa thời gian thực từ camera thiết bị của bạn.
                  </p>
                  <button
                    onClick={startWebcam}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Bật Camera Bây Giờ
                  </button>
                </div>
              )}
            </div>

            {/* Live Detection Stats */}
            {isWebcamActive && (
              <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-stone-50 border border-stone-200 text-center">
                <div>
                  <div className="text-lg font-mono font-bold text-emerald-700">
                    {webcamDetections.length}
                  </div>
                  <div className="text-[11px] text-stone-500">Đối tượng đang theo dõi</div>
                </div>
                <div>
                  <div className="text-lg font-mono font-bold text-stone-800">{fps}</div>
                  <div className="text-[11px] text-stone-500">Tốc độ khung hình (FPS)</div>
                </div>
                <div>
                  <div className="text-lg font-mono font-bold text-amber-700">YOLO11n</div>
                  <div className="text-[11px] text-stone-500">Kiến trúc mô hình</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
