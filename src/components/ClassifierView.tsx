import React, { useState, useRef } from 'react';
import {
  Upload,
  Search,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sliders,
  RotateCcw,
  BookOpen,
  Bot,
  Zap,
} from 'lucide-react';
import { FlowerSpecies, ClassificationResult } from '../types';

interface ClassifierViewProps {
  speciesList: FlowerSpecies[];
  onSelectSpecies: (species: FlowerSpecies) => void;
  onAskChatbot: (question: string) => void;
  initialSpeciesId?: string | null;
}

export const ClassifierView: React.FC<ClassifierViewProps> = ({
  speciesList,
  onSelectSpecies,
  onAskChatbot,
  initialSpeciesId,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [topK, setTopK] = useState<number>(3);
  const [explainGradCam, setExplainGradCam] = useState<boolean>(true);
  const [activePreset, setActivePreset] = useState<string>(initialSpeciesId || 'roses');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [viewMode, setViewMode] = useState<'overlay' | 'heatmap' | 'original'>('overlay');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sample presets for instant testing
  const samplePresets = [
    { id: 'roses', name: 'Hoa Hồng', img: 'data/deploy_images/flowers-102/jpg/image_01550.jpg' },
    { id: 'sunflowers', name: 'Hướng Dương', img: 'data/deploy_images/flowers-102/jpg/image_03881.jpg' },
    { id: 'tulips', name: 'Hoa Tulip', img: 'data/deploy_images/flowers-102/jpg/image_06390.jpg' },
    { id: 'daisy', name: 'Cúc Họa Mi', img: 'data/deploy_images/flowers-102/jpg/image_01000.jpg' },
    { id: 'dandelion', name: 'Bồ Công Anh', img: 'data/deploy_images/flowers-102/jpg/image_03255.jpg' },
    { id: 'lotus', name: 'Hoa Sen', img: 'data/deploy_images/flowers-102/jpg/image_04747.jpg' },
    { id: 'bougainvillea', name: 'Hoa Giấy', img: 'data/deploy_images/flowers-102/jpg/image_06778.jpg' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setResult(null);
    }
  };

  const handleSelectPreset = (preset: typeof samplePresets[0]) => {
    setActivePreset(preset.id);
    setSelectedFile(null);
    setImagePreview(`/${preset.img}`);
    setResult(null);
  };

  const runClassification = async () => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append('file', selectedFile);
      } else {
        // Pass sample species hint
        formData.append('sample_species', activePreset);
      }
      formData.append('top_k', topK.toString());
      formData.append('explain', explainGradCam ? 'true' : 'false');

      const res = await fetch('/api/classify', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Phân loại thất bại: HTTP ${res.status}`);
      }

      const data: ClassificationResult = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Run on mount if initialSpeciesId was passed
  React.useEffect(() => {
    if (initialSpeciesId) {
      const found = samplePresets.find((p) => p.id === initialSpeciesId);
      if (found) {
        handleSelectPreset(found);
      }
    }
  }, [initialSpeciesId]);

  const currentPreview = imagePreview || `/${samplePresets[0].img}`;
  const matchedSpecies = result?.top_species
    ? result.top_species
    : speciesList.find((s) => s.id === result?.predictions[0]?.label);

  return (
    <div className="space-y-8 pb-16">
      {/* Title Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
          <Search className="w-3.5 h-3.5" />
          <span>Ứng Dụng 1 &bull; ResNet-18 (103 Nhãn)</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-stone-900">
          Kính Lúp Hoa — Phân Loại &amp; Grad-CAM
        </h1>
        <p className="text-sm text-stone-600 max-w-3xl">
          Tải ảnh hoa chụp từ điện thoại hoặc chọn ảnh mẫu để mạng nơ-ron tích chập ResNet-18 suy luận top loài khả dĩ nhất. 
          Bản đồ nhiệt Grad-CAM giúp minh bạch vùng điểm ảnh mà mô hình căn cứ để đưa ra kết luận.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Image Input & Controls */}
        <div className="lg:col-span-6 space-y-6">
          {/* Main Upload / View Box */}
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-6">
            <div className="relative aspect-4/3 w-full rounded-2xl overflow-hidden bg-stone-900 flex items-center justify-center border border-stone-100">
              {/* Display Image */}
              {viewMode === 'heatmap' && result?.grad_cam ? (
                <img
                  src={result.grad_cam}
                  alt="Grad-CAM Heatmap"
                  className="w-full h-full object-contain"
                />
              ) : viewMode === 'overlay' && result?.grad_cam ? (
                <div className="relative w-full h-full">
                  <img
                    src={currentPreview}
                    alt="Flower Preview"
                    className="w-full h-full object-cover"
                  />
                  <img
                    src={result.grad_cam}
                    alt="Grad-CAM Overlay"
                    className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-75"
                  />
                </div>
              ) : (
                <img
                  src={currentPreview}
                  alt="Flower Preview"
                  className="w-full h-full object-cover"
                />
              )}

              {/* View mode toggle overlay if Grad-CAM available */}
              {result?.grad_cam && (
                <div className="absolute bottom-3 left-3 right-3 bg-black/75 backdrop-blur-md rounded-xl p-1.5 flex items-center justify-between text-xs text-white">
                  <span className="text-[11px] font-medium text-stone-300 pl-2">
                    Chế độ xem:
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setViewMode('overlay')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] transition-colors cursor-pointer ${
                        viewMode === 'overlay'
                          ? 'bg-emerald-600 text-white font-semibold'
                          : 'text-stone-300 hover:text-white'
                      }`}
                    >
                      Lồng ghép
                    </button>
                    <button
                      onClick={() => setViewMode('heatmap')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] transition-colors cursor-pointer ${
                        viewMode === 'heatmap'
                          ? 'bg-emerald-600 text-white font-semibold'
                          : 'text-stone-300 hover:text-white'
                      }`}
                    >
                      Nhiệt JET
                    </button>
                    <button
                      onClick={() => setViewMode('original')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] transition-colors cursor-pointer ${
                        viewMode === 'original'
                          ? 'bg-emerald-600 text-white font-semibold'
                          : 'text-stone-300 hover:text-white'
                      }`}
                    >
                      Gốc
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Upload & Choose Actions */}
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
                className="flex-1 min-w-[140px] py-2.5 px-4 rounded-xl border border-stone-300 hover:border-emerald-500 hover:bg-emerald-50/50 text-stone-800 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>Tải ảnh từ máy</span>
              </button>

              <button
                onClick={runClassification}
                disabled={isLoading}
                className="flex-1 min-w-[160px] py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Zap className="w-4 h-4 animate-spin" />
                    <span>Đang suy luận...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Phân Loại Ngay</span>
                  </>
                )}
              </button>
            </div>

            {/* Presets Grid */}
            <div className="space-y-2 pt-2 border-t border-stone-100">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span className="font-semibold text-stone-700">Ảnh mẫu thử nghiệm:</span>
                <span>Bấm để đổi ảnh</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {samplePresets.map((preset) => {
                  const isActive = activePreset === preset.id && !selectedFile;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className={`shrink-0 flex items-center gap-2 p-1.5 pr-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isActive
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
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

            {/* Config Sliders */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-stone-500" />
                  <span>Tham số suy luận</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between text-xs text-stone-600 mb-1">
                    <span>Số nhãn Top-K:</span>
                    <span className="font-mono font-bold text-stone-900">{topK}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={topK}
                    onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-2 pt-3">
                  <input
                    type="checkbox"
                    id="gradcam_check"
                    checked={explainGradCam}
                    onChange={(e) => setExplainGradCam(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 accent-emerald-600 cursor-pointer"
                  />
                  <label
                    htmlFor="gradcam_check"
                    className="text-xs text-stone-700 font-medium cursor-pointer select-none"
                  >
                    Bật giải thích Grad-CAM
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Inference Results */}
        <div className="lg:col-span-6 space-y-6">
          {result ? (
            <div className="space-y-6">
              {/* Primary Prediction Card */}
              <div className="bg-white rounded-3xl p-6 border border-emerald-200 shadow-md shadow-emerald-700/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {result.confident ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Độ tin cậy cao</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Khuyến nghị kiểm tra thêm</span>
                      </span>
                    )}
                    <span className="text-xs text-stone-400 font-mono">
                      {result.latency_ms} ms
                    </span>
                  </div>
                  <span className="text-2xl font-serif font-black text-emerald-700">
                    {(result.predictions[0]?.score * 100).toFixed(1)}%
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-serif font-bold text-stone-900">
                    {result.predictions[0]?.name_vi || result.predictions[0]?.label}
                  </h3>
                  <p className="text-xs italic text-stone-500 font-serif">
                    {matchedSpecies?.scientific_name || result.predictions[0]?.label} &bull;{' '}
                    {matchedSpecies?.family || 'Thực vật hạt kín'}
                  </p>
                </div>

                {matchedSpecies && (
                  <p className="text-xs text-stone-600 line-clamp-3 bg-stone-50 p-3 rounded-xl border border-stone-100">
                    {matchedSpecies.description}
                  </p>
                )}

                {/* Quick actions for this flower */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100">
                  {matchedSpecies && (
                    <button
                      onClick={() => onSelectSpecies(matchedSpecies)}
                      className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-stone-600" />
                      <span>Xem cẩm nang loài này</span>
                    </button>
                  )}
                  <button
                    onClick={() =>
                      onAskChatbot(
                        `Loài hoa ${result.predictions[0]?.name_vi || result.predictions[0]?.label} cần chăm sóc và tưới nước như thế nào?`
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Bot className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Hỏi Cô làm vườn về loài này</span>
                  </button>
                </div>
              </div>

              {/* Top-K Predictions List */}
              <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-4">
                <h4 className="font-bold text-sm text-stone-900">
                  Phân bố xác suất Top-{result.predictions.length} loài
                </h4>

                <div className="space-y-3">
                  {result.predictions.map((pred, i) => {
                    const percent = (pred.score * 100).toFixed(1);
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-stone-800">
                            {i + 1}. {pred.name_vi || pred.label}{' '}
                            <span className="text-stone-400 font-normal">
                              ({pred.label})
                            </span>
                          </span>
                          <span className="font-mono font-bold text-stone-700">
                            {percent}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              i === 0
                                ? 'bg-emerald-600'
                                : i === 1
                                ? 'bg-teal-500'
                                : 'bg-stone-400'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grad-CAM Explanation Details */}
              {result.grad_cam && (
                <div className="bg-amber-50/60 rounded-3xl p-5 border border-amber-200/80 text-xs text-amber-900 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-amber-950">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Ý nghĩa bản đồ nhiệt Grad-CAM:</span>
                  </div>
                  <p className="leading-relaxed">
                    Vùng màu <strong>đỏ và vàng</strong> thể hiện các đặc trưng hình học (cánh hoa, nhụy, cấu trúc đĩa hoa) 
                    mà lớp tích chập cuối cùng (<code>layer4</code> của ResNet-18) kích hoạt mạnh nhất để đưa ra nhãn{' '}
                    <strong>{result.predictions[0]?.name_vi}</strong>.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Empty State */
            <div className="bg-white rounded-3xl p-8 border border-dashed border-stone-300 text-center space-y-4 flex flex-col items-center justify-center min-h-[380px]">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Search className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-stone-800 text-base">
                  Chưa có kết quả phân loại
                </h3>
                <p className="text-xs text-stone-500 max-w-sm">
                  Hãy bấm nút <strong>"Phân Loại Ngay"</strong> ở bên trái hoặc chọn một loài hoa trong thanh ảnh mẫu để tiến hành suy luận thị giác.
                </p>
              </div>
              <button
                onClick={runClassification}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                Chạy thử ảnh hiện tại
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
