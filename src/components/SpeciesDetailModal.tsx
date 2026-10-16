import React from 'react';
import {
  X,
  Sun,
  Droplets,
  Calendar,
  Layers,
  Sparkles,
  Search,
  ImageIcon,
  Bot,
  MapPin,
  Heart,
} from 'lucide-react';
import { FlowerSpecies } from '../types';

interface SpeciesDetailModalProps {
  species: FlowerSpecies | null;
  onClose: () => void;
  onClassify: (speciesId: string) => void;
  onSearchGallery: (speciesId: string) => void;
  onAskBot: (question: string) => void;
}

export const SpeciesDetailModal: React.FC<SpeciesDetailModalProps> = ({
  species,
  onClose,
  onClassify,
  onSearchGallery,
  onAskBot,
}) => {
  if (!species) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-0 my-8 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Modal Header with Image */}
        <div className="relative aspect-16/9 bg-stone-900 overflow-hidden">
          <img
            src={`/${species.image}`}
            alt={species.name_vi}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=600&auto=format&fit=crop';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Title on Image */}
          <div className="absolute bottom-4 left-6 right-6 text-white space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                {species.id}
              </span>
              <span className="text-xs text-stone-300 font-serif italic">
                {species.scientific_name}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold">
              {species.name_vi}
            </h2>
            <p className="text-xs text-stone-200 font-light">
              Tên tiếng Anh: <strong>{species.name_en}</strong> &bull; Họ: {species.family}
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Meaning / Symbolism Box */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3 text-xs text-amber-950">
            <Heart className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-900">Ý nghĩa &amp; Biểu tượng:</span>
              <p className="leading-relaxed">{species.meaning}</p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-stone-900">Mô tả đặc điểm</h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              {species.description}
            </p>
          </div>

          {/* Cultivation Specs Grid */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm text-stone-900">
              Yêu cầu sinh thái &amp; Cẩm nang chăm sóc
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 flex items-start gap-2.5">
                <Sun className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-800">Ánh sáng:</span>
                  <p className="text-stone-600">{species.sunlight}</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 flex items-start gap-2.5">
                <Droplets className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-800">Tưới nước:</span>
                  <p className="text-stone-600">{species.watering}</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 flex items-start gap-2.5">
                <Layers className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-800">Đất trồng:</span>
                  <p className="text-stone-600">{species.soil}</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-800">Mùa nở hoa:</span>
                  <p className="text-stone-600">{species.blooming_season}</p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-950 space-y-1">
              <span className="font-bold">Kỹ thuật chăm sóc đặc biệt:</span>
              <p className="leading-relaxed">{species.care_guide}</p>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                onClassify(species.id);
                onClose();
              }}
              className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Thử phân loại loài này</span>
            </button>
            <button
              onClick={() => {
                onSearchGallery(species.id);
                onClose();
              }}
              className="px-3 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Xem ảnh trong Album</span>
            </button>
            <button
              onClick={() => {
                onAskBot(`Cách chăm sóc và đặc điểm sinh trưởng của ${species.name_vi}?`);
                onClose();
              }}
              className="px-3 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Hỏi Cô làm vườn</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
