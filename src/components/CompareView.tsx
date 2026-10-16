import React, { useState } from 'react';
import {
  GitCompare,
  Sun,
  Droplets,
  Calendar,
  Layers,
  Sparkles,
  Heart,
  X,
  Plus,
} from 'lucide-react';
import { FlowerSpecies } from '../types';

interface CompareViewProps {
  speciesList: FlowerSpecies[];
  onSelectSpecies: (species: FlowerSpecies) => void;
}

export const CompareView: React.FC<CompareViewProps> = ({
  speciesList,
  onSelectSpecies,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(['roses', 'sunflowers']);

  const selectedSpecies = selectedIds
    .map((id) => speciesList.find((s) => s.id === id))
    .filter(Boolean) as FlowerSpecies[];

  const handleAddFlower = (id: string) => {
    if (selectedIds.length < 3 && !selectedIds.includes(id)) {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleRemoveFlower = (id: string) => {
    if (selectedIds.length > 1) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Title Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
          <GitCompare className="w-3.5 h-3.5" />
          <span>Đối Chiếu Thực Vật Học &bull; Ma Trận So Sánh Đa Chiều</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-stone-900">
          So Sánh Các Loài Hoa
        </h1>
        <p className="text-sm text-stone-600 max-w-3xl">
          Đặt cạnh nhau từ 2 đến 3 loài hoa trong số 103 loài để đối chiếu chi tiết về đặc tính sinh thái, 
          nhu cầu tưới tiêu, ánh sáng, mùa hoa nở và ý nghĩa biểu tượng.
        </p>
      </div>

      {/* Selectors Bar */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-stone-700">Đang so sánh:</span>
          {selectedSpecies.map((sp) => (
            <div
              key={sp.id}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-semibold flex items-center gap-2"
            >
              <span>{sp.name_vi}</span>
              {selectedIds.length > 1 && (
                <button
                  onClick={() => handleRemoveFlower(sp.id)}
                  className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {selectedIds.length < 3 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500">Thêm loài hoa:</span>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleAddFlower(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-800 text-xs font-medium cursor-pointer"
            >
              <option value="" disabled>
                + Chọn thêm hoa...
              </option>
              {speciesList
                .filter((s) => !selectedIds.includes(s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name_vi} ({s.id})
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* Side-by-Side Comparison Matrix */}
      <div className={`grid grid-cols-1 md:grid-cols-${selectedSpecies.length} gap-6`}>
        {selectedSpecies.map((sp) => (
          <div
            key={sp.id}
            className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-xs flex flex-col justify-between"
          >
            <div>
              {/* Photo */}
              <div className="relative aspect-16/10 bg-stone-900 overflow-hidden">
                <img
                  src={`/${sp.image}`}
                  alt={sp.name_vi}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=600&auto=format&fit=crop';
                  }}
                />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] font-mono text-white">
                  {sp.id}
                </div>
              </div>

              {/* Header Info */}
              <div className="p-5 border-b border-stone-100 space-y-1">
                <h3 className="font-serif font-bold text-xl text-stone-900">{sp.name_vi}</h3>
                <p className="text-xs italic text-stone-500 font-serif">
                  {sp.scientific_name}
                </p>
                <p className="text-[11px] text-stone-400">Họ: {sp.family}</p>
              </div>

              {/* Spec Comparison Items */}
              <div className="p-5 space-y-4 text-xs">
                {/* Meaning */}
                <div className="space-y-1 bg-amber-50/60 p-3 rounded-xl border border-amber-100">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-amber-600" />
                    <span>Ý nghĩa biểu tượng:</span>
                  </span>
                  <p className="text-amber-950 text-[11px] leading-relaxed">{sp.meaning}</p>
                </div>

                {/* Sunlight */}
                <div className="space-y-1">
                  <span className="font-bold text-stone-800 flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>Ánh sáng:</span>
                  </span>
                  <p className="text-stone-600 text-[11px]">{sp.sunlight}</p>
                </div>

                {/* Watering */}
                <div className="space-y-1">
                  <span className="font-bold text-stone-800 flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-blue-500" />
                    <span>Tưới nước:</span>
                  </span>
                  <p className="text-stone-600 text-[11px]">{sp.watering}</p>
                </div>

                {/* Blooming Season */}
                <div className="space-y-1">
                  <span className="font-bold text-stone-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-purple-500" />
                    <span>Mùa nở hoa:</span>
                  </span>
                  <p className="text-stone-600 text-[11px]">{sp.blooming_season}</p>
                </div>

                {/* Soil */}
                <div className="space-y-1">
                  <span className="font-bold text-stone-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Đất trồng:</span>
                  </span>
                  <p className="text-stone-600 text-[11px]">{sp.soil}</p>
                </div>

                {/* Care Guide */}
                <div className="space-y-1 pt-1 border-t border-stone-100">
                  <span className="font-bold text-stone-800">Mẹo chăm sóc:</span>
                  <p className="text-stone-600 text-[11px] leading-relaxed">{sp.care_guide}</p>
                </div>
              </div>
            </div>

            <div className="p-4 pt-0">
              <button
                onClick={() => onSelectSpecies(sp)}
                className="w-full py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-medium transition-colors cursor-pointer text-center"
              >
                Xem chi tiết bách khoa
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
